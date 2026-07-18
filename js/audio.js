/**
 * False Memory — AudioManager
 * Глобальный аудио-движок на основе нативного HTMLAudioElement.
 * Все громкости умножаются на window.G_Settings.volume.
 */

window.AudioManager = (() => {

  // ─── Вспомогательные функции ────────────────────────────────────────────────

  /** Возвращает текущую мастер-громкость из настроек (0–1). */
  function masterVolume() {
    return (window.G_Settings && typeof window.G_Settings.volume === 'number')
      ? Math.max(0, Math.min(1, window.G_Settings.volume))
      : 1;
  }

  /**
   * Создаёт Audio-объект с заданными параметрами.
   * @param {string} src    - путь к .mp3-файлу
   * @param {number} volume - базовая громкость (0–1), масштабируется на masterVolume()
   * @param {boolean} loop  - зациклить?
   */
  function createAudio(src, volume = 1, loop = false) {
    const audio = new Audio(src);
    audio.loop   = loop;
    audio.volume = volume * masterVolume();
    return audio;
  }

  /**
   * Запускает воспроизведение; поглощает ошибки автоплея и отсутствия файла.
   * @param {HTMLAudioElement} audio
   */
  function safePlay(audio) {
    if (!audio) return;
    audio.volume = (audio._baseVolume ?? 1) * masterVolume();

    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(err => {
        // NotAllowedError  — браузер заблокировал автоплей (ок, ждём жеста)
        // NotSupportedError — файл не найден или формат не поддерживается
        if (err.name !== 'AbortError') {
          console.warn(`[AudioManager] play() blocked: ${err.name} — ${audio.src}`);
        }
      });
    }
  }

  // ─── Состояние ──────────────────────────────────────────────────────────────

  let _ambient  = null;   // HTMLAudioElement для фонового эмбиента
  let _glitch   = null;   // HTMLAudioElement для треска «Осознания»
  let _steps    = null;   // HTMLAudioElement для зацикленных шагов

  // ─── Публичный API ──────────────────────────────────────────────────────────

  return {

    // ── Эмбиент ─────────────────────────────────────────────────────────────

    /**
     * Загружает и запускает фоновый эмбиент.
     * Повторно вызов безопасен: если уже играет — ничего не делает.
     */
    startAmbient() {
      if (_ambient && !_ambient.paused) return;

      try {
        _ambient = createAudio('assets/sounds/ambient.mp3', 0.5, true);
        _ambient._baseVolume = 0.5;
        safePlay(_ambient);
      } catch (err) {
        console.warn('[AudioManager] startAmbient error:', err);
      }
    },

    /**
     * Заглушка: в будущем изменит скорость / громкость эмбиента под уровень паранойи.
     * @param {number} paranoiaLevel - 0 (спокойно) … 1 (максимальный страх)
     */
    updateAmbient(paranoiaLevel) {
      if (!_ambient) return;
      // TODO: e.g. _ambient.playbackRate = 1 + paranoiaLevel * 0.3;
      //            _ambient.volume = (0.4 + paranoiaLevel * 0.3) * masterVolume();
    },

    // ── Шаги (зацикленные, пока игрок движется) ──────────────────────────────

    /**
     * Запускает зацикленный звук шагов. Повторный вызов до stopFootsteps()
     * безопасен — ничего не делает, если уже играет.
     */
    playFootsteps() {
      if (_steps && !_steps.paused) return;

      try {
        if (!_steps) {
          _steps = createAudio('assets/sounds/step.mp3', 0.6, true);
          _steps._baseVolume = 0.6;
        }
        safePlay(_steps);
      } catch (err) {
        console.warn('[AudioManager] playFootsteps error:', err);
      }
    },

    /**
     * Останавливает зацикленный звук шагов (игрок остановился).
     */
    stopFootsteps() {
      if (!_steps || _steps.paused) return;

      try {
        _steps.pause();
        _steps.currentTime = 0;
      } catch (err) {
        console.warn('[AudioManager] stopFootsteps error:', err);
      }
    },

    // ── Треск «Осознания» ───────────────────────────────────────────────────

    /**
     * Запускает зацикленный треск (нажата кнопка «Осознание»).
     * Повторный вызов до stopGlitch() безопасен.
     */
    playGlitch() {
      if (_glitch && !_glitch.paused) return;

      try {
        if (!_glitch) {
          _glitch = createAudio('assets/sounds/glitch.mp3', 0.7, true);
          _glitch._baseVolume = 0.7;
        }
        _glitch.currentTime = 0;
        safePlay(_glitch);
      } catch (err) {
        console.warn('[AudioManager] playGlitch error:', err);
      }
    },

    /**
     * Останавливает треск (отпущена кнопка «Осознание»).
     */
    stopGlitch() {
      if (!_glitch || _glitch.paused) return;

      try {
        _glitch.pause();
        _glitch.currentTime = 0;
      } catch (err) {
        console.warn('[AudioManager] stopGlitch error:', err);
      }
    },

    // ── Победный звук ───────────────────────────────────────────────────────

    /**
     * Один раз воспроизводит звук успешного сброса аномалии.
     */
    playFlashSuccess() {
      try {
        const success = createAudio('assets/sounds/success.mp3', 1.0);
        success._baseVolume = 1.0;
        safePlay(success);
      } catch (err) {
        console.warn('[AudioManager] playFlashSuccess error:', err);
      }
    },

    // ── Утилиты ─────────────────────────────────────────────────────────────

    /**
     * Пересчитывает громкость всех активных потоков.
     * Вызывай при изменении ползунка громкости в настройках.
     */
    refreshVolume() {
      if (_ambient) _ambient.volume = (_ambient._baseVolume ?? 0.5) * masterVolume();
      if (_glitch)  _glitch.volume  = (_glitch._baseVolume  ?? 0.7) * masterVolume();
      if (_steps)   _steps.volume   = (_steps._baseVolume   ?? 0.6) * masterVolume();
    },

    /**
     * Полная остановка всего аудио (например, при выходе из игры).
     */
    stopAll() {
      [_ambient, _glitch, _steps].forEach(audio => {
        if (!audio) return;
        try { audio.pause(); audio.currentTime = 0; } catch (_) {}
      });
    },
  };

})();
