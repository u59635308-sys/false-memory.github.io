// ============================================================
//  FALSE MEMORY — Main Entry Point
//  js/main.js
//
//  Depends on (load order in index.html):
//    js/levels.js     → window.LevelConfig
//    js/controls.js   → window.PlayerControls
//    js/anomalies.js  → window.AnomalyManager
//    js/audio.js      → window.AudioManager
//    js/ui.js         → DOM screens / buttons
//    js/main.js       → this file (scene, build, loop)
// ============================================================

// ----------------------------------------------------------
//  1. GLOBAL SETTINGS
// ----------------------------------------------------------
window.G_Settings = {
  sensitivity: 5,   // 1–10
  volume: 0.8,      // 0–1
  shadowQuality: 'high', // 'off' | 'low' | 'high'
};

// ----------------------------------------------------------
//  2. THREE.JS CORE OBJECTS (exposed globally — required by
//     controls.js / anomalies.js, которые читают window.scene & window.camera)
// ----------------------------------------------------------
window.scene    = null;
window.camera   = null;
window.renderer = null;

/** true → игровой цикл и ввод заморожены (например, экран Game Over) */
window.gamePaused = false;

let clock = null;

/** id двери, через который игрок прошёл последним (анти-дребезг триггера) */
let _lastTriggeredDoorId = null;


// ----------------------------------------------------------
//  3. SCENE INITIALISATION
// ----------------------------------------------------------
function initScene() {
  window.scene = new THREE.Scene();
  window.scene.fog = new THREE.FogExp2(0x1a1008, 0.07);

  window.camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.05,
    40
  );

  window.renderer = new THREE.WebGLRenderer({ antialias: true });
  window.renderer.setSize(window.innerWidth, window.innerHeight);
  window.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  window.renderer.outputColorSpace = THREE.SRGBColorSpace;
  window.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  window.renderer.toneMappingExposure = 0.75;

  // Мягкие тени от люстр — сильно добавляет объёма без больших затрат
  // (тени включены только у ключевых источников, см. buildRoomLight).
  // Реально влияющий флаг выставляется в applyShadowQuality() по настройке
  // window.G_Settings.shadowQuality, здесь только базовое состояние.
  window.renderer.shadowMap.enabled = window.G_Settings.shadowQuality !== 'off';
  window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  document.body.appendChild(window.renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffe8c0, 0.18);
  window.scene.add(ambient);

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  window.camera.aspect = window.innerWidth / window.innerHeight;
  window.camera.updateProjectionMatrix();
  window.renderer.setSize(window.innerWidth, window.innerHeight);
}


// ----------------------------------------------------------
//  4. APARTMENT GENERATION FROM LevelConfig
// ----------------------------------------------------------

const WALL_THICKNESS = 0.2;

// ── Оптимизация теней ───────────────────────────────────────────────────
// Map<roomId, PointLight> — чтобы включать тень только у комнаты игрока
const _roomLights = new Map();
let _shadowLightId = null;

// На мобильных/слабых устройствах карта теней меньше — заметно дешевле
const _isLowPowerDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

/**
 * Разрешение карты теней в пикселях для каждого уровня качества.
 * 'off'  — тени полностью выключены (shadowMap рендерера тоже выключается).
 * 'low'  — компактная карта, минимальная нагрузка на GPU/мобильные.
 * 'high' — чёткие мягкие тени для десктопа/мощных устройств.
 */
const SHADOW_MAP_SIZES = { off: 0, low: 256, high: _isLowPowerDevice ? 512 : 1024 };

let _shadowMapSize = SHADOW_MAP_SIZES[window.G_Settings.shadowQuality] || SHADOW_MAP_SIZES.high;

/**
 * Включает тень только у света комнаты, где сейчас находится игрок,
 * и выключает у всех остальных. Вызывается при переходах между комнатами
 * (см. AnomalyManager.onRoomTransition / _checkRoomTransition в main.js).
 * Если качество теней = 'off', тени не включаются нигде.
 */
function _updateActiveShadowLight(roomId) {
  if (_shadowLightId === roomId) return;

  const prevLight = _roomLights.get(_shadowLightId);
  if (prevLight) prevLight.castShadow = false;

  if (window.G_Settings.shadowQuality !== 'off') {
    const nextLight = _roomLights.get(roomId);
    if (nextLight) nextLight.castShadow = true;
  }

  _shadowLightId = roomId;
}

/**
 * Применяет выбранное в настройках качество теней:
 * переключает shadowMap рендерера целиком и пересоздаёт карту теней
 * у активного света комнаты под новое разрешение.
 * Вызывается при изменении select-shadows в UI (см. секцию 8).
 */
function applyShadowQuality(quality) {
  window.G_Settings.shadowQuality = quality;
  _shadowMapSize = SHADOW_MAP_SIZES[quality] || SHADOW_MAP_SIZES.high;

  const enabled = quality !== 'off';
  if (window.renderer) window.renderer.shadowMap.enabled = enabled;

  // Обновляем размер карты теней у всех источников (дешёво — их всего 4-5)
  // и переустанавливаем тень только на активной комнате игрока.
  for (const light of _roomLights.values()) {
    light.castShadow = false;
    light.shadow.mapSize.set(_shadowMapSize, _shadowMapSize);
    // Форсируем пересоздание карты теней при следующем кадре
    if (light.shadow.map) {
      light.shadow.map.dispose();
      light.shadow.map = null;
    }
  }

  if (enabled) {
    const current = _roomLights.get(_shadowLightId);
    if (current) current.castShadow = true;
  }
}

// ── Загрузчик текстур: PNG из assets/textures/, либо процедурный fallback ──
const _textureLoader = new THREE.TextureLoader();

/**
 * Рисует простую процедурную текстуру на canvas — используется как fallback,
 * когда реального файла в assets/textures/ ещё нет (чтобы игра не выглядела
 * пустой/серой до того, как пользователь добавит свои текстуры).
 * @param {string} kind - тип узора: 'wallpaper' | 'wallpaperWarm' | 'tiles' | 'tilesCool' | 'parquet' | 'plaster'
 */
function _proceduralTexture(kind) {
  const size = 1024; // выше разрешение — обои и пол выглядят чётче вблизи
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (kind === 'wallpaper' || kind === 'wallpaperWarm') {
    // ── Дамасские обои ────────────────────────────────────────────────
    // Спальня: глубокий тёмно-зелёный бутылочный цвет
    // Коридор: тёплый тёмно-бордовый
    const isWarm = kind === 'wallpaperWarm';
    const bg  = isWarm ? '#2e1a14' : '#1a2418';   // очень тёмный фон
    const fg  = isWarm ? '#5c2e22' : '#2d4028';   // орнамент чуть светлее фона
    const acc = isWarm ? '#7a3e2e' : '#3d5438';   // акцент узора
    const hi  = isWarm ? '#8f5038' : '#4c6a46';   // мягкий блик на орнаменте

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // Лёгкий вертикальный градиент — имитация неравномерного освещения
    // и естественного выцветания обоев сверху/снизу
    const vGrad = ctx.createLinearGradient(0, 0, 0, size);
    vGrad.addColorStop(0,   'rgba(0,0,0,0.12)');
    vGrad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    vGrad.addColorStop(1,   'rgba(0,0,0,0.18)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, size, size);

    // Тонкие вертикальные полосы — основа
    ctx.strokeStyle = fg;
    ctx.lineWidth = 3;
    for (let x = 0; x < size; x += 128) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Дамасский медальон в каждой ячейке
    const cell = 128;
    for (let gx = 0; gx < size; gx += cell) {
      for (let gy = 0; gy < size; gy += cell) {
        const cx = gx + cell / 2;
        const cy = gy + cell / 2;
        const r  = cell * 0.30;

        // Внешний ромб (самый тонкий, просто обводка)
        ctx.strokeStyle = acc;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx,       cy - r * 1.35);
        ctx.lineTo(cx + r,   cy);
        ctx.lineTo(cx,       cy + r * 1.35);
        ctx.lineTo(cx - r,   cy);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Заполненный внутренний ромб
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(cx,           cy - r);
        ctx.lineTo(cx + r * 0.6, cy);
        ctx.lineTo(cx,           cy + r);
        ctx.lineTo(cx - r * 0.6, cy);
        ctx.closePath();
        ctx.fill();

        // Тонкий блик по верхней грани внутреннего ромба — добавляет объём
        ctx.strokeStyle = hi;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy);
        ctx.lineTo(cx, cy - r);
        ctx.lineTo(cx + r * 0.6, cy);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 4 «лепестка» по диагонали
        ctx.fillStyle = acc;
        const lp = r * 0.22;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.ellipse(cx + sx * r * 0.72, cy + sy * r * 0.9, lp, lp * 1.5, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Маленький центральный круг
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // Тонкий крест между медальонами (на стыке ячеек)
        ctx.strokeStyle = acc;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(gx, cy); ctx.lineTo(gx + cell, cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, gy); ctx.lineTo(cx, gy + cell); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Зернистость ткани/бумаги обоев — тонкий шум поверх узора,
    // убирает «пластиковую» гладкость процедурного рисунка
    const wallGrainCount = Math.floor(size * size * 0.02);
    for (let i = 0; i < wallGrainCount; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = Math.random() * 0.05;
      ctx.fillStyle = Math.random() > 0.5
        ? `rgba(255,255,255,${v})`
        : `rgba(0,0,0,${v})`;
      ctx.fillRect(x, y, 1, 1);
    }

  } else if (kind === 'tiles') {
    // ── Кухонная плитка: кремово-бежевая с тёмными швами ─────────────
    ctx.fillStyle = '#d8cfc2';
    ctx.fillRect(0, 0, size, size);

    const tile = 256;
    // Лёгкая вариация цвета плиток + мягкий блик в углу каждой плитки
    for (let x = 0; x < size; x += tile) {
      for (let y = 0; y < size; y += tile) {
        const lightness = (Math.random() * 0.06 - 0.03);
        ctx.fillStyle = lightness > 0
          ? `rgba(255,255,255,${lightness})`
          : `rgba(0,0,0,${-lightness})`;
        ctx.fillRect(x + 6, y + 6, tile - 12, tile - 12);

        const glossGrad = ctx.createLinearGradient(x, y, x + tile, y + tile);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
        glossGrad.addColorStop(0.3, 'rgba(255,255,255,0)');
        ctx.fillStyle = glossGrad;
        ctx.fillRect(x + 6, y + 6, tile - 12, tile - 12);
      }
    }
    // Швы
    ctx.strokeStyle = '#8a8070';
    ctx.lineWidth = 8;
    for (let x = 0; x <= size; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    for (let y = 0; y <= size; y += tile) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }

  } else if (kind === 'tilesCool') {
    // ── Ванная: светло-голубая прямоугольная плитка метро ────────────
    ctx.fillStyle = '#c8d8df';
    ctx.fillRect(0, 0, size, size);

    const tw = 256;
    const th = 128;
    for (let row = 0; row < size / th; row++) {
      const offset = (row % 2 === 0) ? 0 : tw / 2;
      for (let col = -1; col < size / tw + 1; col++) {
        const x = col * tw + offset;
        const y = row * th;
        // лёгкая тонировка каждой плитки
        const v = Math.random() * 0.08;
        ctx.fillStyle = `rgba(255,255,255,${v})`;
        ctx.fillRect(x + 6, y + 6, tw - 12, th - 12);
      }
    }
    // Швы
    ctx.strokeStyle = '#8aabb8';
    ctx.lineWidth = 6;
    for (let row = 0; row <= size / th; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * th);
      ctx.lineTo(size, row * th);
      ctx.stroke();
    }
    for (let row = 0; row < size / th; row++) {
      const offset = (row % 2 === 0) ? 0 : tw / 2;
      for (let col = -1; col < size / tw + 2; col++) {
        ctx.beginPath();
        ctx.moveTo(col * tw + offset, row * th);
        ctx.lineTo(col * tw + offset, (row + 1) * th);
        ctx.stroke();
      }
    }

  } else if (kind === 'parquet') {
    // ── Тёмный паркет «ёлочка» ────────────────────────────────────────
    const colors = ['#5c3d1e', '#4e3318', '#6a4522', '#432c14'];
    const pw = 32;  // ширина дощечки (масштабировано под size=1024)
    const pl = 128; // длина дощечки

    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, size, size);

    /**
     * Рисует одну дощечку паркета с волокнами древесины и мягким
     * продольным бликом — вместо плоской заливки, как раньше.
     * Дощечка рисуется в локальных координатах (0,0)-(w,h), волокна
     * всегда идут вдоль длинной стороны w.
     */
    function drawPlank(w, h, baseColor) {
      ctx.save();
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);

      // Волокна дерева — несколько тонких изогнутых линий вдоль доски
      const fiberCount = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < fiberCount; i++) {
        const fy = (h / (fiberCount + 1)) * (i + 1) + (Math.random() - 0.5) * (h * 0.15);
        ctx.strokeStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.08})`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        ctx.moveTo(0, fy);
        // Лёгкая волнистость волокна
        ctx.bezierCurveTo(w * 0.3, fy + (Math.random() - 0.5) * 4, w * 0.7, fy + (Math.random() - 0.5) * 4, w, fy);
        ctx.stroke();
      }

      // Мягкий продольный блик по верхнему краю доски — имитация лакового покрытия
      const gloss = ctx.createLinearGradient(0, 0, 0, h);
      gloss.addColorStop(0,   'rgba(255,255,255,0.10)');
      gloss.addColorStop(0.35, 'rgba(255,255,255,0)');
      gloss.addColorStop(1,   'rgba(0,0,0,0.12)');
      ctx.fillStyle = gloss;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();
    }

    for (let y = -pl; y < size + pl; y += pw * 2) {
      for (let x = -pl; x < size + pl; x += pl) {
        const ci = Math.floor(Math.random() * colors.length);

        // Горизонтальная дощечка
        ctx.save();
        ctx.translate(x, y);
        drawPlank(pl, pw, colors[ci]);
        ctx.restore();

        // Вертикальная дощечка рядом (ёлочка) — волокна должны идти
        // вдоль её собственной длинной стороны, поэтому рисуем в
        // повёрнутой системе координат
        ctx.save();
        ctx.translate(x + pw, y - pw);
        ctx.translate(0, pl);
        ctx.rotate(-Math.PI / 2);
        drawPlank(pl, pw, colors[(ci + 1) % colors.length]);
        ctx.restore();
      }
    }
    // Швы поверх
    ctx.strokeStyle = 'rgba(20,10,5,0.55)';
    ctx.lineWidth = 3;
    for (let y = -pl; y < size + pl; y += pw * 2) {
      for (let x = -pl; x < size + pl; x += pl) {
        ctx.strokeRect(x, y, pl, pw);
        ctx.strokeRect(x + pw, y - pw, pw, pl);
      }
    }

  } else {
    // ── Потолок: штукатурка с лёгким шумом ────────────────────────────
    ctx.fillStyle = '#cec8be';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 12000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
      ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Создаёт MeshStandardMaterial для именованной поверхности (обои/пол/потолок).
 * Пытается загрузить реальный PNG из assets/textures/<name>.png; если файла
 * нет (или ещё не добавлен пользователем) — мгновенно применяет процедурный
 * узор-fallback, подобранный по смысловым словам в имени, так что сцена
 * никогда не остаётся пустой/без текстуры.
 * @param {string} name - например "wallpaper_bedroom", "floor_tiles_kitchen"
 * @param {{x:number,y:number}} repeat - повторений текстуры по UV
 */
function _createSurfaceMaterial(name, repeat) {
  let fallbackKind = 'plaster';
  if (name.includes('wallpaper')) fallbackKind = name.includes('hallway') ? 'wallpaperWarm' : 'wallpaper';
  else if (name.includes('tiles_bathroom') || name.includes('floor_tiles_bathroom')) fallbackKind = 'tilesCool';
  else if (name.includes('tiles')) fallbackKind = 'tiles';
  else if (name.includes('parquet') || name.startsWith('floor')) fallbackKind = 'parquet';
  else if (name.includes('ceiling')) fallbackKind = 'plaster';

  // Разная шероховатость под тип поверхности — паркет лакированный
  // (более гладкий, даёт блики от люстры), плитка слегка глянцевая,
  // обои и штукатурка остаются полностью матовыми.
  const ROUGHNESS_BY_KIND = {
    parquet: 0.42,
    tiles: 0.55,
    tilesCool: 0.5,
    wallpaper: 0.9,
    wallpaperWarm: 0.9,
    plaster: 0.92,
  };

  const material = new THREE.MeshStandardMaterial({
    map: _proceduralTexture(fallbackKind),
    roughness: ROUGHNESS_BY_KIND[fallbackKind] ?? 0.85,
  });
  if (repeat) material.map.repeat.set(repeat.x, repeat.y);

  // Пробуем подгрузить настоящий файл текстуры пользователя; если он есть —
  // подменяем map на загруженный, иначе остаёмся на процедурном fallback.
  _textureLoader.load(
    `assets/textures/${name}.png`,
    (loaded) => {
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      loaded.colorSpace = THREE.SRGBColorSpace;
      if (repeat) loaded.repeat.set(repeat.x, repeat.y);
      // Освобождаем GPU-память старой процедурной canvas-текстуры перед заменой
      if (material.map) material.map.dispose();
      material.map = loaded;
      material.needsUpdate = true;
    },
    undefined,
    () => { /* файла нет на диске — это ожидаемо, остаёмся на fallback-узоре */ }
  );

  return material;
}

/** Общие материалы — переиспользуются, чтобы не плодить лишние объекты */
const _materials = {
  // ── Материалы мебели ───────────────────────────────────────────
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.75, metalness: 0.02 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x8a6f5c, roughness: 0.95, metalness: 0.0 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.35, metalness: 0.8 }),
  // Полированная сталь для клинков ножей — светлее и более зеркальная,
  // чем обычный "metal", + небольшая эмиссия, чтобы лезвие читалось
  // как металл даже в тёмном освещении кухни, а не сливалось в чёрную полоску.
  steel: new THREE.MeshStandardMaterial({
    color: 0xe8ebee,
    roughness: 0.15,
    metalness: 0.95,
    emissive: 0x22262b,
    emissiveIntensity: 0.4,
  }),
  // Матовый тёмный титан — акцентный металл для сантехнических аксессуаров
  // (сушилка для полотенец и т.п.), по референсу CAIWEI Titanium&Air.
  titanium: new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.45, metalness: 0.75 }),
  // Тёплый белый матовый — фасады тумб/шкафчиков в ванной
  whiteMatte: new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.55, metalness: 0.05 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.08, metalness: 0.6 }),
  // ── Декоративные материалы для "оживления" интерьера ──────────────────
  plant: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.85, metalness: 0.0 }),      // листва растений
  plantPot: new THREE.MeshStandardMaterial({ color: 0x8a5a3f, roughness: 0.8, metalness: 0.0 }),    // терракотовый горшок
  paper: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9, metalness: 0.0 }),       // бумага/страницы книг
  ceramic: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5, metalness: 0.0 }),     // посуда, кружки, вазы

  // Material по умолчанию (используется если у детали/предмета не указан material)
  furniture: new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.8 }),

  frame: new THREE.MeshStandardMaterial({
    color: 0x2a2420,
    roughness: 0.6,
    side: THREE.DoubleSide,
  }),
};

/**
 * BUGFIX: id-ы предметов, чей material.color аномалия меняет НАПРЯМУЮ на
 * общем (переиспользуемом) материале — сейчас это только 'mirrorPortal'
 * (см. applyAnomalyToObject в anomalies.js). Для таких предметов
 * buildRoomFurniture() клонирует материал персонально, чтобы перекраска
 * не задевала остальные предметы, использующие тот же _materials.* инстанс.
 * Вычисляется автоматически из AnomalyDatabase — новые color-мутирующие
 * типы аномалий подхватятся сами, id вручную поддерживать не нужно.
 */
const AnomalyDatabaseTargetsWithColorMutation = new Set(
  (window.AnomalyDatabase || [])
    .filter((a) => a.type === 'mirrorPortal')
    .map((a) => a.targetId)
);

/**
 * Строит всю квартиру по window.LevelConfig.rooms:
 * пол, потолок, стены, мебель и точечный свет для каждой комнаты.
 */
function buildApartment() {
  const rooms = window.LevelConfig.rooms;

  for (const room of rooms) {
    buildRoomShell(room);
    buildRoomFurniture(room);
    buildRoomLight(room);
  }
}

/** Пол, потолок и периметральные стены одной комнаты */
function buildRoomShell(room) {
  const { width, length, height, center } = room;
  const tex = room.textures || {};

  // Материалы поверхностей — индивидуальные для каждой комнаты, текстура
  // повторяется пропорционально размеру комнаты, чтобы не выглядела размытой
  const floorMat   = _createSurfaceMaterial(tex.floor   || 'floor_parquet',    { x: width / 2,  y: length / 2 });
  const ceilingMat = _createSurfaceMaterial(tex.ceiling || 'ceiling_plaster',  { x: width / 2,  y: length / 2 });
  const wallMat    = _createSurfaceMaterial(tex.wall    || 'wallpaper_bedroom', { x: width / 2, y: height / 2 });

  // ── Пол ──────────────────────────────────────────────────
  const floorGeo = new THREE.BoxGeometry(width, WALL_THICKNESS, length);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(center.x, -WALL_THICKNESS / 2, center.z);
  floor.name = `${room.id}_floor`;
  floor.receiveShadow = true;
  window.scene.add(floor);

  // ── Потолок ──────────────────────────────────────────────
  const ceilingGeo = new THREE.BoxGeometry(width, WALL_THICKNESS, length);
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(center.x, height + WALL_THICKNESS / 2, center.z);
  ceiling.name = `${room.id}_ceiling`;
  ceiling.receiveShadow = true;
  window.scene.add(ceiling);

  // ── Стены (с проёмами под двери, согласно boundingBox из LevelConfig) ──
  for (const wall of room.walls) {
    const box = wall.boundingBox;
    const wWidth  = box.maxX - box.minX;
    const wLength = box.maxZ - box.minZ;
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;

    const wallGeo = new THREE.BoxGeometry(wWidth, height, wLength);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(cx, height / 2, cz);
    wallMesh.name = wall.id;
    wallMesh.receiveShadow = true;
    window.scene.add(wallMesh);
  }
}

/**
 * Возвращает материал мебели по имени из _materials,
 * с безопасным фолбэком на дефолтный furniture-материал.
 */
function _resolveMaterial(name) {
  return _materials[name] || _materials.furniture;
}

/**
 * Собирает один меш-деталь составного предмета мебели (parts[i])
 * и располагает его относительно item.position по offset.
 */
function _buildPart(part) {
  const geo = new THREE.BoxGeometry(
    part.size.width,
    part.size.height,
    part.size.depth
  );
  const mat = _resolveMaterial(part.material);
  const mesh = new THREE.Mesh(geo, mat);

  const offset = part.offset || { x: 0, y: 0, z: 0 };
  mesh.position.set(offset.x, offset.y, offset.z);
  if (part.rotationX) mesh.rotation.x = part.rotationX;
  if (part.rotationY) mesh.rotation.y = part.rotationY;
  if (part.rotationZ) mesh.rotation.z = part.rotationZ;

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/**
 * Строит фоторамку, которая идеально облегает реальное изображение без
 * зазоров и без обрезки: сначала ставится временный квадратный плейсхолдер
 * (нейтрально-серое полотно + тонкий багет), а после загрузки PNG из
 * item.textureFile геометрия фото и рамки пересчитывается под настоящие
 * пропорции картинки (image.naturalWidth / naturalHeight), сохраняя высоту
 * item.size.height и подбирая ширину пропорционально.
 */
function _buildPhotoFrame(item, roomId) {
  const group = new THREE.Group();

  const FRAME_BORDER = 0.045;
  const FRAME_DEPTH  = item.size.depth || 0.04;

  // Направление «вперёд» зависит от поворота рамки.
  // При rotationY=Math.PI (рамка на северной стене, смотрит на юг):
  // локальная ось +Z группы смотрит в стену, поэтому фото нужно на -Z
  const faceSign = (item.rotationY && Math.abs(item.rotationY - Math.PI) < 0.01) ? -1 : 1;
  const photoZ   = faceSign * (FRAME_DEPTH / 2 + 0.002);

  // ── Плейсхолдер на время загрузки ───────────────────────────────────────
  const placeholderMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
  const photoGeo = new THREE.PlaneGeometry(
    Math.max(item.size.width - FRAME_BORDER * 2, 0.05),
    Math.max(item.size.height - FRAME_BORDER * 2, 0.05)
  );
  const photoMesh = new THREE.Mesh(photoGeo, placeholderMat);
  photoMesh.position.z = photoZ;
  // Если смотрит назад — разворачиваем плоскость
  if (faceSign < 0) photoMesh.rotation.y = Math.PI;
  photoMesh.name = `${item.id}_photo`;
  group.add(photoMesh);

  // ── Багет — тонкая деревянная рамка по периметру фото ───────────────────
  const frameMat = _materials.wood;
  const outerW = item.size.width;
  const outerH = item.size.height;

  function makeBorderBar(w, h, x, y) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, FRAME_DEPTH), frameMat);
    bar.position.set(x, y, 0);
    return bar;
  }
  // Верх/низ багета на всю ширину, левая/правая — между ними (без перекрытия углов)
  group.add(makeBorderBar(outerW, FRAME_BORDER, 0,  (outerH - FRAME_BORDER) / 2));
  group.add(makeBorderBar(outerW, FRAME_BORDER, 0, -(outerH - FRAME_BORDER) / 2));
  group.add(makeBorderBar(FRAME_BORDER, outerH - FRAME_BORDER * 2,  (outerW - FRAME_BORDER) / 2, 0));
  group.add(makeBorderBar(FRAME_BORDER, outerH - FRAME_BORDER * 2, -(outerW - FRAME_BORDER) / 2, 0));

  group.position.set(item.position.x, item.position.y, item.position.z);
  if (item.rotationY) group.rotation.y = item.rotationY;

  group.name = item.id;
  group.userData.id = item.id;
  group.userData.roomId = roomId;

  // ── Загрузка реального PNG и подгонка пропорций ────────────────────────
  if (item.textureFile) {
    _textureLoader.load(
      item.textureFile,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        const img = loadedTex.image;
        const aspect = (img && img.width && img.height) ? img.width / img.height : (item.size.width / item.size.height);

        // Высота фото фиксирована под исходный слот рамки, ширина — пропорциональна реальному PNG
        const newPhotoH = item.size.height - FRAME_BORDER * 2;
        const newPhotoW = newPhotoH * aspect;

        photoMesh.geometry.dispose();
        photoMesh.geometry = new THREE.PlaneGeometry(newPhotoW, newPhotoH);
        // Освобождаем плейсхолдер-материал перед заменой на текстуру реального фото
        photoMesh.material.dispose();
        photoMesh.material = new THREE.MeshStandardMaterial({ map: loadedTex, roughness: 0.6 });
        photoMesh.position.z = photoZ; // переустанавливаем (на случай если сдвинулось)

        // Подгоняем ширину багета под новую ширину фото, не трогая высоту/глубину
        const newOuterW = newPhotoW + FRAME_BORDER * 2;
        const oldBars = group.children.filter(c => c !== photoMesh);
        oldBars.forEach((bar) => {
          group.remove(bar);
          bar.geometry.dispose();
        });
        group.add(makeBorderBar(newOuterW, FRAME_BORDER, 0,  (outerH - FRAME_BORDER) / 2));
        group.add(makeBorderBar(newOuterW, FRAME_BORDER, 0, -(outerH - FRAME_BORDER) / 2));
        group.add(makeBorderBar(FRAME_BORDER, outerH - FRAME_BORDER * 2,  (newOuterW - FRAME_BORDER) / 2, 0));
        group.add(makeBorderBar(FRAME_BORDER, outerH - FRAME_BORDER * 2, -(newOuterW - FRAME_BORDER) / 2, 0));
      },
      undefined,
      () => { /* PNG ещё не добавлен пользователем в assets/textures/ — остаёмся на плейсхолдере */ }
    );
  }

  return group;
}

/** Мебель и картины одной комнаты, расставленные по furniture[] */
function buildRoomFurniture(room) {
  for (const item of room.furniture) {

    // ── Фоторамка под пользовательский PNG — отдельная сборка с автоподгонкой ──
    if (item.mesh === 'PhotoFrame') {
      const frameGroup = _buildPhotoFrame(item, room.id);
      window.scene.add(frameGroup);
      continue;
    }

    // ── Составной предмет: собираем группу из нескольких деталей ─────
    if (Array.isArray(item.parts) && item.parts.length > 0) {
      const group = new THREE.Group();

      for (const part of item.parts) {
        const partMesh = _buildPart(part);
        group.add(partMesh);
      }

      group.position.set(item.position.x, item.position.y, item.position.z);
      if (item.rotationY) group.rotation.y = item.rotationY;

      // Критично: имя главной группы = id объекта, чтобы Raycaster аномалий мог его найти
      group.name = item.id;
      group.userData.id = item.id;
      group.userData.roomId = room.id;

      window.scene.add(group);
      continue;
    }

    // ── Простой предмет: один меш (старое поведение, сохранено) ──────
    let mesh;

    // BUGFIX: некоторые предметы (например bedroom_mirror — цель секретного
    // портала-зеркала) получают material.color.setHex() напрямую от
    // AnomalyManager (см. applyAnomalyToObject → case 'mirrorPortal').
    // Материалы в _materials — ОБЩИЕ инстансы, переиспользуемые десятками
    // предметов по всему дому (все "mirror", "wood" и т.д.) — если красить
    // общий инстанс, зеленеют все объекты с тем же material, не только
    // целевое зеркало. Поэтому для объектов, назначенных targetId у
    // аномалий, меняющих цвет материала, делаем персональный клон.
    const needsOwnMaterial = AnomalyDatabaseTargetsWithColorMutation.has(item.id);

    if (item.mesh === 'Plane') {
      const geo = new THREE.PlaneGeometry(item.size.width, item.size.height);
      let mat = item.material ? _resolveMaterial(item.material) : _materials.frame;
      if (needsOwnMaterial) mat = mat.clone();
      mesh = new THREE.Mesh(geo, mat);
    } else {
      // По умолчанию — Box (тумбы, рамки и т.п. без parts)
      const geo = new THREE.BoxGeometry(
        item.size.width,
        item.size.height,
        item.size.depth
      );
      let mat = item.material ? _resolveMaterial(item.material) : _materials.furniture;
      if (needsOwnMaterial) mat = mat.clone();
      mesh = new THREE.Mesh(geo, mat);
    }

    mesh.position.set(item.position.x, item.position.y, item.position.z);
    if (item.rotationY) mesh.rotation.y = item.rotationY;

    // Критично: имя меша = id объекта, чтобы Raycaster аномалий мог его найти
    mesh.name = item.id;
    mesh.userData.id = item.id;
    mesh.userData.roomId = room.id;

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    window.scene.add(mesh);
  }
}

/** Точечный свет комнаты + меш люстры на потолке (цвет берётся из room.lightColor) */
function buildRoomLight(room) {
  const { center, height } = room;
  const chandelierPos = room.chandelier || center;

  const light = new THREE.PointLight(room.lightColor, 0.9, 12, 2.0);
  light.position.set(chandelierPos.x, height - 0.35, chandelierPos.z);
  light.name = `${room.id}_light`;
  light.userData.id = `${room.id}_light`;
  light.userData.roomId = room.id;

  // ── Оптимизация: тень включена только у света комнаты, где ИГРОК
  // находится прямо сейчас (см. _updateActiveShadowLight в разделе 5).
  // PointLight с тенью рендерит сцену 6 раз (кубическая карта), поэтому
  // держать тени у всех комнат разом — самая частая причина просадок FPS.
  light.castShadow = false;
  light.shadow.mapSize.set(_shadowMapSize, _shadowMapSize);
  light.shadow.bias = -0.003;
  light.shadow.camera.near = 0.1;
  light.shadow.camera.far = 12;

  window.scene.add(light);
  _roomLights.set(room.id, light);

  // ── Меш люстры ─────────────────────────────────────────────────────────
  const chandelier = new THREE.Group();

  // Штанга крепления к потолку
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8),
    _materials.metal
  );
  mount.position.y = height - 0.11;
  chandelier.add(mount);

  // Декоративное кольцо
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.02, 8, 24),
    _materials.metal
  );
  ring.position.y = height - 0.24;
  ring.rotation.x = Math.PI / 2;
  chandelier.add(ring);

  // Плафон (конический абажур)
  const shadeGeo = new THREE.ConeGeometry(0.25, 0.28, 16, 1, true);
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf5e8c8,
    emissive: room.lightColor,
    emissiveIntensity: 0.25,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(shadeGeo, shadeMat);
  shade.position.y = height - 0.38;
  chandelier.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfff3cc,
      emissive: 0xfff3cc,
      emissiveIntensity: 0.4,
    })
  );
  bulb.position.y = height - 0.44;
  chandelier.add(bulb);

  chandelier.position.set(chandelierPos.x, 0, chandelierPos.z);
  chandelier.name = `${room.id}_chandelier`;
  window.scene.add(chandelier);

  // ── Настольные лампы: добавляем маленький PointLight для тумбочек/стола ──
  if (room.tableLamps) {
    for (const lamp of room.tableLamps) {
      const tl = new THREE.PointLight(0xffc860, 0.6, 2.2, 2.5);
      tl.position.set(lamp.x, lamp.y, lamp.z);
      window.scene.add(tl);
    }
  }
}


// ----------------------------------------------------------
//  5. START GAME
// ----------------------------------------------------------
function startGame() {
  console.log('[FalseMemory] startGame() вызван');

  initScene();
  buildApartment();

  // Тень нужна только у комнаты, где игрок находится прямо сейчас —
  // стартовая комната ("bedroom") получает её сразу, остальные — при переходе
  _updateActiveShadowLight('bedroom');

  // ── Стартовая позиция камеры ───────────────────────────────
  // Примечание: точная позиция (включая EYE_HEIGHT) и поворот камеры
  // выставляются внутри конструктора PlayerControls ниже — здесь их
  // дублировать не нужно, это раньше приводило к избыточной и вводящей
  // в заблуждение записи в camera.position перед немедленной перезаписью.

  // ── Аудио, управление, аномалии ─────────────────────────────
  window.AudioManager.startAmbient();
  window.controls = new window.PlayerControls(window.camera);

  if (window.AnomalyManager && typeof window.AnomalyManager.init === 'function') {
    window.AnomalyManager.init();
  }

  // ── Запуск игрового цикла ───────────────────────────────────
  clock = new THREE.Clock();
  requestAnimationFrame(gameLoop);
}


// ----------------------------------------------------------
//  5.5  NOCLIP MODE + BACKROOMS
// ----------------------------------------------------------

/** Ноуклип: флаг активного режима */
window.noclipActive = false;

/** Длина одного сегмента бэкрумс (повторяется бесконечно) */
const BACKROOMS_SEGMENT = 20;

/** Сколько сегментов отрисовано вперёд/назад от игрока */
const BACKROOMS_DRAW_DIST = 8;

/** Пул плиток пола бэкрумс */
const _backroomsFloors = [];

/** Счётчик сегментов для смещения */
let _backroomsOffset = 0;

/**
 * Освобождает GPU-ресурсы одного Object3D (geometry, material(ы), их текстуры).
 * Не трогает сцену/иерархию — только сами ресурсы. Безопасно вызывать на
 * объектах без geometry/material (Group, Light и т.п.).
 * @param {THREE.Object3D} obj
 */
function _disposeObject3D(obj) {
  if (obj.geometry) obj.geometry.dispose();

  if (obj.material) {
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of materials) {
      if (mat.map) mat.map.dispose();
      if (mat.emissiveMap) mat.emissiveMap.dispose();
      if (mat.normalMap) mat.normalMap.dispose();
      mat.dispose();
    }
  }
}

/**
 * Создаёт бесконечный коридор Backrooms:
 * - потолок с флуоресцентными лампами
 * - пол из 6 пользовательских текстур (photo_1..6)
 * - бесконечная прокрутка сегментами вдоль оси Z
 */
function _buildBackrooms() {
  // Чистим старую квартиру. Важно не только убрать объекты из сцены,
  // но и освободить их GPU-ресурсы (geometry/material/текстуры) —
  // иначе на мобильных GPU память копится и сцена может упасть/зависнуть.
  const toRemove = [];
  window.scene.traverse(obj => { if (obj !== window.scene) toRemove.push(obj); });
  toRemove.forEach(obj => {
    window.scene.remove(obj);
    _disposeObject3D(obj);
  });

  // Туман Backrooms — желтоватый
  window.scene.fog = new THREE.FogExp2(0x1a1800, 0.04);

  const roomW = 8; // ширина коридора
  const roomH = 2.5; // высота

  // ── Материалы ───────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xcfcb96, roughness: 0.9 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xd8d4a0, roughness: 0.95 });

  // 6 материалов пола — сразу создаём с fallback цветом, текстуры подгрузятся асинхронно
  const floorMats = [];
  // Реестр мешей пола по индексу материала — чтобы обновить map после загрузки
  const _floorMeshRegistry = [[], [], [], [], [], []];

  const loader = new THREE.TextureLoader();
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xa09860, roughness: 0.8 });
    floorMats.push(mat);
    loader.load(`assets/textures/backrooms_floor_${i + 1}.png`, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
      tex.colorSpace = THREE.SRGBColorSpace;
      mat.map = tex;
      mat.needsUpdate = true;
      // Обновляем все уже созданные меши с этим материалом
      _floorMeshRegistry[i].forEach(mesh => { mesh.material = mat; });
    }, undefined, () => { /* файла нет — fallback цвет */ });
  }

  // ── Функция создания одного сегмента ─────────────────────────────────────
  function createSegment(segIndex) {
    const z = segIndex * BACKROOMS_SEGMENT;
    const group = new THREE.Group();
    group.userData.segIndex = segIndex;

    // Пол — из чередующихся 6 материалов
    const matIdx = Math.abs(segIndex) % 6;
    const floorGeo = new THREE.BoxGeometry(roomW, 0.1, BACKROOMS_SEGMENT);
    const floorMat = floorMats[matIdx];
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.05, z + BACKROOMS_SEGMENT / 2);
    group.add(floor);
    _floorMeshRegistry[matIdx].push(floor); // регистрируем для обновления текстуры

    // Потолок
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.1, BACKROOMS_SEGMENT), ceilMat);
    ceil.position.set(0, roomH + 0.05, z + BACKROOMS_SEGMENT / 2);
    group.add(ceil);

    // Стены по бокам
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.15, roomH, BACKROOMS_SEGMENT), wallMat);
    wallL.position.set(-roomW / 2, roomH / 2, z + BACKROOMS_SEGMENT / 2);
    group.add(wallL);
    const wallR = wallL.clone();
    wallR.position.x = roomW / 2;
    group.add(wallR);

    // Люминесцентные лампы
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff8d0, emissive: 0xfff8d0, emissiveIntensity: 1.2 });
    for (let li = 2; li < BACKROOMS_SEGMENT; li += 5) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), lampMat);
      lamp.position.set(0, roomH - 0.08, z + li);
      group.add(lamp);
      const light = new THREE.PointLight(0xfff5c0, 0.6, 8, 2);
      light.position.set(0, roomH - 0.2, z + li);
      group.add(light);
    }

    window.scene.add(group);
    _backroomsFloors.push(group);
  }

  // Создаём начальные сегменты вокруг игрока
  for (let s = -2; s < BACKROOMS_DRAW_DIST; s++) {
    createSegment(s);
  }

  // Слабый глобальный свет
  window.scene.add(new THREE.AmbientLight(0xfff8c0, 0.3));

  // ── Бесконечная прокрутка ─────────────────────────────────────────────
  window._backroomsCreateSegment = createSegment;
  window._backroomsLastSeg = BACKROOMS_DRAW_DIST - 1;
}

/**
 * Активирует ноуклип-режим:
 * - перестраивает сцену под Backrooms
 * - убирает коллизии (controls.noclip = true)
 * - добавляет кнопку «Перезапустить» в HUD
 */
function _startNoclipMode() {
  window.noclipActive = true;
  window.gamePaused   = false; // размораживаем цикл

  _buildBackrooms();

  // Ставим игрока в начало коридора
  window.camera.position.set(0, 1.6, 2);
  window.camera.rotation.set(0, 0, 0);

  if (window.controls) {
    window.controls.noclip = true; // controls.js читает этот флаг
  }

  // Показываем кнопку «Перезапустить» рядом с настройками
  const noclipRestartBtn = document.getElementById('btn-noclip-restart');
  if (noclipRestartBtn) noclipRestartBtn.classList.remove('hidden');
}


// ----------------------------------------------------------
//  5.6  СЕКРЕТНАЯ КОНЦОВКА «ЗЕРКАЛО»
// ----------------------------------------------------------
//
// Состояния (window._mirrorEnding.phase):
//   'opening'   → зеркало анимированно раскрывается (лерп цвета/масштаба/
//                 положения "внутренних" плоскостей зеркала)
//   'corridor'  → игрок идёт по элитному коридору (ходьба как обычно,
//                 назад пути физически нет — сегменты позади не создаются
//                 и там стоит невидимая стена)
//   'deadend'   → игрок упёрся в стену "ОБЕРНИСЬ", ждём поворота на N°
//   'whiteIn'   → экран плавно белеет (сцена ещё старая, игрок в коридоре)
//   'whiteOut'  → сцена уже подменена на психушку "за белым экраном",
//                 свет плавно гаснет, открывая новую комнату
//   'psychward' → 15 секунд свободного осмотра финальной комнаты
//   'done'      → показан экран альтернативной концовки
//
// Единый самописный лерп по времени (без внешних tween-библиотек —
// в проекте таких хелперов нет) применяется для анимации зеркала.

window._mirrorEnding = null; // объект состояния, создаётся в _triggerMirrorEnding()

/** Простая линейная интерполяция */
function _lerp(a, b, t) { return a + (b - a) * t; }

/** Плавная кривая easeInOutQuad — чтобы открытие зеркала не выглядело линейно-механическим */
function _easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Длина одного сегмента "элитного коридора" (по образцу BACKROOMS_SEGMENT) */
const ELITE_CORRIDOR_SEGMENT = 20;

/** Сколько сегментов подгружено вперёд от игрока */
const ELITE_CORRIDOR_DRAW_DIST = 8;

/** Дистанция (в сегментах), после которой ставится тупиковая стена */
const ELITE_CORRIDOR_DEADEND_SEGMENTS = 6; // ~120 юнитов ходьбы

/** На сколько радиан нужно повернуться от направления "лицом в стену", чтобы триггернуть скример */
const DEADEND_TURN_TRIGGER_RAD = (100 * Math.PI) / 180; // 100°

/** Сколько секунд даём осмотреться в психушке перед финальным экраном */
const PSYCH_WARD_DURATION_SEC = 15;

/**
 * Точка входа: вызывается из anomalies.js (AnomalyManager.fixAnomaly())
 * сразу после фиксации портала-зеркала (34-я аномалия — секретная).
 * @param {THREE.Object3D} mirrorObj - объект зеркала на сцене (уже зелёный/вытянутый)
 */
window._triggerMirrorEnding = function _triggerMirrorEnding(mirrorObj) {
  if (window._mirrorEnding) return; // уже идёт — не даём запустить дважды

  console.log('[MirrorEnding] 🪞 Запуск секретной концовки «Зеркало»');

  // Не используем window.gamePaused=true, иначе controls.update() перестанет
  // вызываться и игрок не сможет идти. Отдельный флаг ведёт весь ивент.
  window._mirrorEndingActive = true;

  window._mirrorEnding = {
    phase: 'opening',
    t: 0,
    mirrorObj: mirrorObj || null,
    savedCamPos: window.camera.position.clone(),
    savedYaw: window.controls ? window.controls._yaw : window.camera.rotation.y,
    deadendYaw: null,
  };

  if (window.AudioManager) {
    window.AudioManager.stopFootsteps();
  }
};

/**
 * Процедурная текстура тёмного паркета для пола "элитного коридора".
 * Canvas создаётся один раз в _buildEliteCorridor() и переиспользуется
 * (RepeatWrapping) на всех сегментах — ноль лишней нагрузки на GPU
 * по сравнению со сплошным цветом, дороже только на один draw при
 * первом создании текстуры.
 */
function _makeEliteWoodFloorTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f2c1c';
  ctx.fillRect(0, 0, size, size);

  const plank = 64;
  for (let y = 0; y < size; y += plank) {
    const offset = (Math.floor(y / plank) % 2) * (plank / 2);
    for (let x = -plank; x < size + plank; x += plank) {
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgba(${Math.floor(70 * shade)}, ${Math.floor(48 * shade)}, ${Math.floor(30 * shade)}, 1)`;
      ctx.fillRect(x + offset, y, plank - 3, plank - 3);
      // волокна дерева
      ctx.strokeStyle = 'rgba(20,12,6,0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const fy = y + 6 + i * (plank / 4) + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(x + offset + 2, fy);
        ctx.lineTo(x + offset + plank - 5, fy + (Math.random() * 4 - 2));
        ctx.stroke();
      }
    }
    // тёмный шов между рядами
    ctx.strokeStyle = 'rgba(10,6,3,0.5)';
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Процедурная текстура стеновых панелей (wainscoting) для "элитного
 * коридора": тёмная деревянная филёнка снизу + градиент штукатурки
 * сверху. Как и текстура пола — создаётся один раз и тайлится.
 */
function _makeEliteWallPanelTexture() {
  const w = 256, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#4a3d2e');
  grad.addColorStop(0.55, '#392e22');
  grad.addColorStop(1, '#2a2118');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Нижняя тёмная деревянная панель (2/3 стены)
  const panelTop = h * 0.32;
  ctx.fillStyle = '#241b12';
  ctx.fillRect(0, panelTop, w, h - panelTop);

  // Филёнка — утопленная рамка со светлым/тёмным краем (эффект объёма)
  const m = 22;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 5;
  ctx.strokeRect(m, panelTop + m, w - m * 2, (h - panelTop) - m * 2);
  ctx.strokeStyle = 'rgba(255,230,190,0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(m + 4, panelTop + m + 4, w - m * 2 - 8, (h - panelTop) - m * 2 - 8);

  // Разделительный молдинг между верхней стеной и панелью
  ctx.fillStyle = 'rgba(200,180,140,0.18)';
  ctx.fillRect(0, panelTop - 3, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, panelTop, w, 2);

  // Лёгкая зернистость дерева поверх всего
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, y, 1, 6 + Math.random() * 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Строит "элитный коридор": тёмное дерево/мрамор + настенные бра,
 * бесконечно генерируется вперёд по образцу _buildBackrooms(), но
 * НЕ назад — пройденные сегменты просто не создаются повторно, и на
 * старте (segIndex 0) ставится невидимая стена, отрезающая обратный путь.
 */
function _buildEliteCorridor() {
  const toRemove = [];
  window.scene.traverse(obj => { if (obj !== window.scene) toRemove.push(obj); });
  toRemove.forEach(obj => {
    window.scene.remove(obj);
    _disposeObject3D(obj);
  });

  window.scene.fog = new THREE.FogExp2(0x2a2620, 0.018); // лёгкий светлый туман, не тёмный

  const roomW = 4.5;
  const roomH = 3.0;

  const woodFloorTex = _makeEliteWoodFloorTexture();
  woodFloorTex.repeat.set(roomW / 1.2, ELITE_CORRIDOR_SEGMENT / 1.2);

  const panelTex = _makeEliteWallPanelTexture();
  panelTex.repeat.set(ELITE_CORRIDOR_SEGMENT / 3.5, 1);

  const floorMat = new THREE.MeshStandardMaterial({ map: woodFloorTex, roughness: 0.32, metalness: 0.12 });
  const wallMat  = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55, metalness: 0.04 });
  const ceilMat  = new THREE.MeshStandardMaterial({ color: 0xece6d8, roughness: 0.6 });
  const marbleTrimMat = new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: 0.2, metalness: 0.2 });
  const carpetMat = new THREE.MeshStandardMaterial({ color: 0x5a1414, roughness: 0.95 });
  const sconceMat = new THREE.MeshStandardMaterial({ color: 0xffe8bc, emissive: 0xffd8a0, emissiveIntensity: 1.8 });
  const sconceBaseMat = new THREE.MeshStandardMaterial({ color: 0x8a7658, roughness: 0.4, metalness: 0.5 });

  const eliteFloors = [];

  function createEliteSegment(segIndex) {
    const z = segIndex * ELITE_CORRIDOR_SEGMENT;
    const group = new THREE.Group();
    group.userData.segIndex = segIndex;

    const floor = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.1, ELITE_CORRIDOR_SEGMENT), floorMat);
    floor.position.set(0, -0.05, z + ELITE_CORRIDOR_SEGMENT / 2);
    group.add(floor);

    // Ковровая дорожка по центру — недорого (1 плоскость), но сразу
    // придаёт "элитный отель" ощущение и визуально ведёт взгляд вперёд.
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(roomW * 0.42, ELITE_CORRIDOR_SEGMENT), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.001, z + ELITE_CORRIDOR_SEGMENT / 2);
    group.add(carpet);

    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, ELITE_CORRIDOR_SEGMENT), marbleTrimMat);
    trimL.position.set(-roomW / 2 + 0.1, 0.06, z + ELITE_CORRIDOR_SEGMENT / 2);
    group.add(trimL);
    const trimR = trimL.clone();
    trimR.position.x = roomW / 2 - 0.1;
    group.add(trimR);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(roomW, 0.1, ELITE_CORRIDOR_SEGMENT), ceilMat);
    ceil.position.set(0, roomH + 0.05, z + ELITE_CORRIDOR_SEGMENT / 2);
    group.add(ceil);

    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.15, roomH, ELITE_CORRIDOR_SEGMENT), wallMat);
    wallL.position.set(-roomW / 2, roomH / 2, z + ELITE_CORRIDOR_SEGMENT / 2);
    group.add(wallL);
    const wallR = wallL.clone();
    wallR.position.x = roomW / 2;
    group.add(wallR);

    // Настенные бра — чисто декоративные emissive-меши, БЕЗ реальных
    // PointLight на каждый (десятки одновременных источников света на
    // мобильных устройствах давали заметные просадки FPS). Всю яркость
    // коридора даёт равномерный Hemisphere+Ambient свет ниже.
    // Добавлена простая тёмная "подложка" бра для объёма — всё ещё
    // 2 меша на бра вместо 1, но геометрия примитивная (box), недорого.
    for (let li = 3; li < ELITE_CORRIDOR_SEGMENT; li += 6) {
      [-1, 1].forEach((side) => {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.18), sconceBaseMat);
        base.position.set(side * (roomW / 2 - 0.09), roomH * 0.6, z + li);
        group.add(base);

        const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.12), sconceMat);
        sconce.position.set(side * (roomW / 2 - 0.13), roomH * 0.6, z + li);
        group.add(sconce);
      });
    }

    window.scene.add(group);
    eliteFloors.push(group);
  }

  // Сегменты только ВПЕРЁД от старта (0) — назад пути физически нет
  for (let s = 0; s < ELITE_CORRIDOR_DRAW_DIST; s++) {
    createEliteSegment(s);
  }

  // Невидимая стена в начале коридора (z=0) — блокирует движение назад
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(roomW, roomH, 0.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  backWall.position.set(0, roomH / 2, -0.1);
  backWall.userData.isMirrorCorridorBackWall = true;
  window.scene.add(backWall);

  // ── Яркое равномерное освещение (дёшево: 2 источника на весь коридор,
  //    без теней) — коридор должен быть светлым, чтобы надпись "ОБЕРНИСЬ"
  //    было видно издалека, и не лагать на мобильных устройствах.
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x3a3226, 1.1);
  window.scene.add(hemi);
  window.scene.add(new THREE.AmbientLight(0xfff0dc, 0.85));

  window._mirrorEnding.eliteFloors = eliteFloors;
  window._mirrorEnding.createEliteSegment = createEliteSegment;
  window._mirrorEnding.lastSeg = ELITE_CORRIDOR_DRAW_DIST - 1;
  window._mirrorEnding.roomW = roomW;
  window._mirrorEnding.roomH = roomH;

  _buildDeadEndWall(roomW, roomH);
}

/**
 * Создаёт тупиковую стену с текстурой "ОБЕРНИСЬ" на плоскости
 * (CanvasTexture с текстом — тот же подход, что процедурные текстуры
 * стен/пола в этом проекте, только с текстом вместо узора).
 */
function _buildDeadEndWall(roomW, roomH) {
  const z = ELITE_CORRIDOR_DEADEND_SEGMENTS * ELITE_CORRIDOR_SEGMENT;

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.6 });
  const deadEndWall = new THREE.Mesh(new THREE.BoxGeometry(roomW, roomH, 0.2), wallMat);
  deadEndWall.position.set(0, roomH / 2, z);
  window.scene.add(deadEndWall);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0604';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7a1414';
  ctx.font = 'bold 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff2222';
  ctx.shadowBlur = 18;
  ctx.fillText('ОБЕРНИСЬ', canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0x330000,
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide, // подстраховка: видна с обеих сторон, даже если игрок подойдёт вплотную/сбоку
  });
  const signGeo = new THREE.PlaneGeometry(roomW * 0.7, roomW * 0.7 * (512 / 1024));
  const sign = new THREE.Mesh(signGeo, signMat);
  // ВАЖНО: PlaneGeometry по умолчанию смотрит нормалью в +Z, а игрок идёт
  // в сторону +Z и стоит перед стеной с координатой z (меньшей, чем z).
  // Значит без поворота нормаль плоскости "смотрит" ОТ игрока — он видит
  // изнанку и текст не виден. Разворачиваем на 180°, чтобы лицевая
  // сторона с текстом была обращена навстречу подходящему игроку.
  sign.rotation.y = Math.PI;
  sign.position.set(0, roomH / 2, z - 0.09);
  window.scene.add(sign);

  window._mirrorEnding.deadEndZ = z;
}

/**
 * Строит финальную комнату "психушки": одна мягкая белая комната
 * с рассеянным светом, простая геометрия (Box), без выходов.
 */
function _buildPsychWard() {
  const toRemove = [];
  window.scene.traverse(obj => { if (obj !== window.scene) toRemove.push(obj); });
  toRemove.forEach(obj => {
    window.scene.remove(obj);
    _disposeObject3D(obj);
  });

  window.scene.fog = null;

  const w = 6, l = 6, h = 3;

  // ── Настоящая стёганая обивка "мягкой комнаты" ────────────────────────
  // Ромбовидные простёганные ячейки: диагональные швы-впадины между
  // пуговицами-кнопками, мягкое вздутие ткани в центре каждой ячейки,
  // плюс лёгкая грязь/потёртость по углам для атмосферы психушки.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const size = 1024;

  ctx.fillStyle = '#e6e0d4';
  ctx.fillRect(0, 0, size, size);

  const cell = 128; // размер одной ромбовидной ячейки простёжки

  // Мягкое "вздутие" ткани в центре каждой ячейки (радиальный блик)
  for (let gy = -cell / 2; gy < size + cell; gy += cell) {
    for (let gx = -cell / 2; gx < size + cell; gx += cell) {
      const bulge = ctx.createRadialGradient(gx, gy, 4, gx, gy, cell * 0.62);
      bulge.addColorStop(0,   'rgba(255,255,255,0.10)');
      bulge.addColorStop(0.55, 'rgba(255,255,255,0.02)');
      bulge.addColorStop(1,   'rgba(0,0,0,0.05)');
      ctx.fillStyle = bulge;
      ctx.beginPath();
      ctx.arc(gx, gy, cell * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Диагональная простёжка — линии швов по двум направлениям (ромб)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2.5;
  for (let d = -size; d < size * 2; d += cell) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d, size); ctx.lineTo(d + size, 0); ctx.stroke();
  }
  // Мягкий светлый блик рядом со швом (имитация выпуклости ткани по краям шва)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 4;
  for (let d = -size + 6; d < size * 2; d += cell) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + size, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d, size); ctx.lineTo(d + size, 0); ctx.stroke();
  }

  // Пуговицы-кнопки в узлах решётки (пересечения швов)
  for (let gy = 0; gy <= size; gy += cell) {
    for (let gx = 0; gx <= size; gx += cell) {
      const btnGrad = ctx.createRadialGradient(gx - 1.5, gy - 1.5, 0.5, gx, gy, 6);
      btnGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      btnGrad.addColorStop(0.4, 'rgba(60,55,45,0.55)');
      btnGrad.addColorStop(1, 'rgba(20,18,14,0.65)');
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Тканевая зернистость поверх всего — убирает "пластиковую" гладкость
  const grainCount = Math.floor(size * size * 0.015);
  for (let i = 0; i < grainCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random() * 0.04;
    ctx.fillStyle = Math.random() > 0.5
      ? `rgba(255,255,255,${v})`
      : `rgba(0,0,0,${v})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Лёгкие пятна потёртости/грязи по углам — атмосфера заброшенности
  const stainCount = 5 + Math.floor(Math.random() * 4);
  for (let i = 0; i < stainCount; i++) {
    const sx = Math.random() * size;
    const sy = Math.random() * size;
    const sr = 40 + Math.random() * 90;
    const stain = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    stain.addColorStop(0, 'rgba(40,32,20,0.08)');
    stain.addColorStop(1, 'rgba(40,32,20,0)');
    ctx.fillStyle = stain;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const padTex = new THREE.CanvasTexture(canvas);
  padTex.wrapS = THREE.RepeatWrapping;
  padTex.wrapT = THREE.RepeatWrapping;
  padTex.repeat.set(2, 2);
  padTex.colorSpace = THREE.SRGBColorSpace;

  const padMat = new THREE.MeshStandardMaterial({ map: padTex, color: 0xf0ece2, roughness: 0.92, metalness: 0 });

  // Пол — линолеум с лёгкими бетонными пятнами/швами плит: контрастирует
  // с мягкой обивкой стен и добавляет "больничной" читаемости помещения.
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512; floorCanvas.height = 512;
  const fctx = floorCanvas.getContext('2d');
  fctx.fillStyle = '#cfc9ba';
  fctx.fillRect(0, 0, 512, 512);
  const tile = 128;
  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      const shade = 0.94 + Math.random() * 0.1;
      fctx.fillStyle = `rgba(${Math.floor(207 * shade)}, ${Math.floor(201 * shade)}, ${Math.floor(186 * shade)}, 1)`;
      fctx.fillRect(x, y, tile - 2, tile - 2);
    }
  }
  fctx.strokeStyle = 'rgba(120,114,98,0.35)';
  fctx.lineWidth = 2;
  for (let g = 0; g <= 512; g += tile) {
    fctx.beginPath(); fctx.moveTo(g, 0); fctx.lineTo(g, 512); fctx.stroke();
    fctx.beginPath(); fctx.moveTo(0, g); fctx.lineTo(512, g); fctx.stroke();
  }
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512, y = Math.random() * 512;
    fctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    fctx.fillRect(x, y, 1, 1);
  }
  const floorTex = new THREE.CanvasTexture(floorCanvas);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(w / 1.5, l / 1.5);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 });

  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), floorMat);
  floor.position.set(0, -0.05, 0);
  window.scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, l), padMat);
  ceil.position.set(0, h + 0.05, 0);
  window.scene.add(ceil);

  const wallN = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), padMat);
  wallN.position.set(0, h / 2, -l / 2);
  window.scene.add(wallN);
  const wallS = wallN.clone();
  wallS.position.z = l / 2;
  window.scene.add(wallS);
  const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, l), padMat);
  wallE.position.set(w / 2, h / 2, 0);
  window.scene.add(wallE);
  const wallW = wallE.clone();
  wallW.position.x = -w / 2;
  window.scene.add(wallW);

  // ── Дверь палаты с зарешёченным окошком-глазком ────────────────────────
  // Без этой детали комната читалась просто как "мягкая белая коробка" —
  // добавляем узнаваемый силуэт стальной двери психиатрической палаты
  // (тёмная рама + маленькое окно с решёткой на уровне глаз), чтобы
  // локация однозначно опознавалась как психушка. Дёшево: 3 box-меша.
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.5, metalness: 0.4 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a352c, roughness: 0.55, metalness: 0.35 });
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.05), doorFrameMat);
  doorFrame.position.set(0, 1.15, l / 2 - 0.08);
  window.scene.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.04), doorMat);
  door.position.set(0, 1.1, l / 2 - 0.1);
  window.scene.add(door);

  // Окошко-глазок с решёткой — маленькая тёмная выемка + 3 металлических прута
  const windowGlassMat = new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 0.8 });
  const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.03), windowGlassMat);
  windowGlass.position.set(0, 1.55, l / 2 - 0.12);
  window.scene.add(windowGlass);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x555044, roughness: 0.4, metalness: 0.6 });
  for (let bi = -1; bi <= 1; bi++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.04), barMat);
    bar.position.set(bi * 0.12, 1.55, l / 2 - 0.115);
    window.scene.add(bar);
  }

  window.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const soft = new THREE.PointLight(0xfff8ec, 0.5, 12, 2);
  soft.position.set(0, h - 0.3, 0);
  window.scene.add(soft);

  window.camera.position.set(0, PlayerControls.EYE_HEIGHT ?? 1.65, 0);
  if (window.controls) {
    window.controls._yaw = 0;
    window.controls._pitch = 0;
    window.controls._applyRotation();
    // Как и в коридоре — noclip=true, поскольку у психушки нет записи
    // в LevelConfig.rooms; границы комнаты держим вручную (clamp)
    // в _updateMirrorEnding(), это проще и надёжнее, чем заводить
    // временную фейковую комнату в LevelConfig только для этой сцены.
    window.controls.noclip = true;
  }

  window._mirrorEnding.psychWardHalf = w / 2;
}

/**
 * Утилита screen-shake: на короткое время добавляет CSS-класс тряски
 * на canvas рендерера (см. .mirror-shake в style.css).
 */
function _screenShake() {
  if (!window.renderer || !window.renderer.domElement) return;
  const el = window.renderer.domElement;
  el.classList.remove('mirror-shake');
  void el.offsetWidth; // форсируем reflow для перезапуска CSS-анимации
  el.classList.add('mirror-shake');
  setTimeout(() => el.classList.remove('mirror-shake'), 420);
}

/**
 * Полностью белая вспышка на ровно 1 секунду (появление мгновенное,
 * угасание плавное). onMid вызывается в момент пика — именно тогда
 * подменяется сцена за спиной игрока.
 */
function _whiteFlash(onMid) {
  const el = document.getElementById('mirror-scare-flash');
  if (!el) { if (onMid) onMid(); return; }

  el.classList.remove('fading');
  el.classList.add('active');

  setTimeout(() => { if (onMid) onMid(); }, 60);

  setTimeout(() => {
    el.classList.remove('active');
    el.classList.add('fading');
  }, 550);

  setTimeout(() => {
    el.classList.remove('fading');
  }, 1000);
}

/**
 * Обновляется каждый кадр из gameLoop(), пока window._mirrorEndingActive.
 * Ведёт конечный автомат секретной концовки.
 * @param {number} deltaTime
 */
function _updateMirrorEnding(deltaTime) {
  const st = window._mirrorEnding;
  if (!st) return;
  st.t += deltaTime;

  switch (st.phase) {

    // ── Фаза 1: игрок физически проходит сквозь плоскость зеркала ────────
    // Экран на мгновение заливает зелёным светом зеркала (не белым!) —
    // это маскирует момент подмены сцены за спиной игрока. Никакого
    // резкого flash, переход плавный и короткий.
    case 'opening': {
      const DUR = 0.9;
      const frac = Math.min(1, st.t / DUR);
      const eased = _easeInOutQuad(frac);

      // Пик затемнения — ровно в середине перехода
      const veil = frac < 0.5
        ? _easeInOutQuad(frac / 0.5)
        : 1 - _easeInOutQuad((frac - 0.5) / 0.5);

      const flashEl = document.getElementById('flash-screen');
      if (flashEl) {
        flashEl.style.background = 'radial-gradient(circle, rgba(40,140,80,0.95) 0%, rgba(10,40,20,0.98) 100%)';
        flashEl.style.opacity = String(veil);
        flashEl.classList.add('active');
      }

      // В момент пика (экран почти полностью укрыт зелёным) — подменяем сцену
      if (!st.corridorBuilt && frac >= 0.48) {
        st.corridorBuilt = true;
        _buildEliteCorridor();
        window.camera.position.set(0, PlayerControls.EYE_HEIGHT ?? 1.65, 1.5);
        if (window.controls) {
          window.controls._yaw = 0;
          window.controls._pitch = 0;
          window.controls._applyRotation();
          // Держим noclip=true: у "элитного коридора" нет своей записи в
          // LevelConfig.rooms, а checkCollisions() иначе продолжит сверяться
          // со старыми AABB квартиры (координаты пересекаются). Границы
          // коридора держим вручную ниже (clamp по X/Z).
          window.controls.noclip = true;
        }
      }

      if (frac >= 1) {
        if (flashEl) {
          flashEl.style.opacity = '';
          flashEl.style.background = '';
          flashEl.classList.remove('active');
        }
        st.phase = 'corridor';
        st.t = 0;
        console.log('[MirrorEnding] Игрок прошёл сквозь зеркало → элитный коридор');
      }
      break;
    }


    // ── Фаза 2: ходьба по коридору, назад пути нет ────────────────────────
    case 'corridor': {
      const playerZ   = window.camera.position.z;
      const playerSeg = Math.floor(playerZ / ELITE_CORRIDOR_SEGMENT);
      const needed    = playerSeg + ELITE_CORRIDOR_DRAW_DIST;

      while (st.lastSeg < needed && st.lastSeg < ELITE_CORRIDOR_DEADEND_SEGMENTS) {
        st.lastSeg++;
        st.createEliteSegment(st.lastSeg);
      }

      // Коридор построен без коллизий по AABB (нет записи в LevelConfig),
      // поэтому боковые границы держим вручную — просто и надёжно
      const halfW = st.roomW / 2 - PlayerControls.PLAYER_RADIUS;
      window.camera.position.x = Math.max(-halfW, Math.min(halfW, window.camera.position.x));

      // Не даём уйти назад за стартовую невидимую стену
      if (window.camera.position.z < 0.3) window.camera.position.z = 0.3;

      const distToWall = st.deadEndZ - window.camera.position.z;
      if (distToWall <= 1.4) {
        window.camera.position.z = st.deadEndZ - 1.4;
        st.phase = 'deadend';
        st.t = 0;
        st.deadendYaw = window.controls ? window.controls._yaw : window.camera.rotation.y;
        console.log('[MirrorEnding] Игрок у тупиковой стены «ОБЕРНИСЬ» — ждём поворота');
      }
      break;
    }

    // ── Фаза 3: игрок стоит у стены "ОБЕРНИСЬ", ждём поворота на N° ──────
    case 'deadend': {
      const minZ = st.deadEndZ - 1.6;
      if (window.camera.position.z < minZ) window.camera.position.z = minZ;
      if (window.camera.position.z > st.deadEndZ - 0.6) window.camera.position.z = st.deadEndZ - 0.6;

      const currentYaw = window.controls ? window.controls._yaw : window.camera.rotation.y;
      let deltaYaw = currentYaw - st.deadendYaw;
      deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw)); // нормализация в [-PI, PI]

      // Порог сработал — игрок отвернулся от стены "ОБЕРНИСЬ" достаточно,
      // чтобы начать перевоплощение. Сцена ЕЩЁ НЕ подменяется здесь —
      // сперва запускаем побеление экрана (фаза whiteIn), и только когда
      // экран станет полностью непрозрачным, подменим сцену за кадром.
      if (Math.abs(deltaYaw) >= DEADEND_TURN_TRIGGER_RAD) {
        st.phase = 'whiteIn';
        st.t = 0;
        console.log('[MirrorEnding] 🌀 Игрок обернулся — экран начинает плавно белеть');
      }
      break;
    }

    // ── Фаза 4a: экран плавно белеет (сцена всё ещё старый коридор) ──────
    case 'whiteIn': {
      const DUR = 1.3;
      const frac = Math.min(1, st.t / DUR);
      const eased = _easeInOutQuad(frac);

      const flashEl = document.getElementById('flash-screen');
      if (flashEl) {
        flashEl.style.background = '#fff';
        flashEl.style.opacity = String(eased);
        flashEl.classList.add('active');
      }

      // Экран полностью укрыт белым — именно сейчас, и никак не раньше,
      // подменяем сцену и телепортируем игрока. Ничего "магически
      // появляющегося на глазах" быть не может: зритель ничего не видит.
      if (frac >= 1) {
        _buildPsychWard();
        st.phase = 'whiteOut';
        st.t = 0;
        console.log('[MirrorEnding] Экран полностью бел → сцена подменена → психушка → начинаем угасание света');
      }
      break;
    }

    // ── Фаза 4b: экран плавно гаснет, открывая уже готовую психушку ──────
    case 'whiteOut': {
      const DUR = 1.3;
      const frac = Math.min(1, st.t / DUR);
      const eased = 1 - _easeInOutQuad(frac);

      const flashEl = document.getElementById('flash-screen');
      if (flashEl) {
        flashEl.style.background = '#fff';
        flashEl.style.opacity = String(eased);
        flashEl.classList.add('active');
      }

      if (frac >= 1) {
        if (flashEl) {
          flashEl.style.opacity = '';
          flashEl.style.background = '';
          flashEl.classList.remove('active');
        }
        st.phase = 'psychward';
        st.t = 0;
        console.log('[MirrorEnding] Белый свет угас → психушка видна');
      }
      break;
    }


    // ── Фаза 5: 15 секунд свободного осмотра ──────────────────────────────
    case 'psychward': {
      const half = (st.psychWardHalf || 3) - PlayerControls.PLAYER_RADIUS;
      window.camera.position.x = Math.max(-half, Math.min(half, window.camera.position.x));
      window.camera.position.z = Math.max(-half, Math.min(half, window.camera.position.z));

      if (st.t >= PSYCH_WARD_DURATION_SEC) {
        st.phase = 'done';
        console.log('[MirrorEnding] Психушка окончена → экран альтернативной концовки');
        if (window.UIManager && typeof window.UIManager.onMirrorEndingComplete === 'function') {
          window.UIManager.onMirrorEndingComplete();
        }
      }
      break;
    }

    case 'done':
      // Ничего не делаем — ждём, пока UIManager покажет финальный экран
      break;
  }
}


// ----------------------------------------------------------
//  6. GAME LOOP
// ----------------------------------------------------------
function gameLoop() {
  const deltaTime = clock.getDelta();

  if (!window.gamePaused) {
    window.controls.update(deltaTime);

    if (window._mirrorEndingActive) {
      _updateMirrorEnding(deltaTime);
      window.renderer.render(window.scene, window.camera);
      requestAnimationFrame(gameLoop);
      return;
    }

    if (window.noclipActive) {
      // ── Бесконечный коридор: подгружаем новые сегменты вперёд ──
      const playerZ   = window.camera.position.z;
      const playerSeg = Math.floor(playerZ / BACKROOMS_SEGMENT);
      const needed    = playerSeg + BACKROOMS_DRAW_DIST;

      while (window._backroomsLastSeg < needed) {
        window._backroomsLastSeg++;
        window._backroomsCreateSegment(window._backroomsLastSeg);
      }

      // Удаляем сегменты далеко позади (оптимизация)
      for (let i = _backroomsFloors.length - 1; i >= 0; i--) {
        const seg = _backroomsFloors[i];
        if (seg.userData.segIndex < playerSeg - 3) {
          window.scene.remove(seg);
          // Диспозим геометрию всех мешей сегмента (материалы floorMats/wallMat/
          // ceilMat/lampMat переиспользуются между сегментами — их НЕ трогаем)
          seg.traverse((child) => {
            if (child.isMesh && child.geometry) child.geometry.dispose();
          });
          _backroomsFloors.splice(i, 1);
        }
      }

      // Жёсткая боковая граница бэкрумс-коридора — не даём игроку
      // улететь за пределы карты (roomW=8, см. _buildBackrooms).
      const _backroomsHalfW = 4 - PlayerControls.PLAYER_RADIUS;
      window.camera.position.x = Math.max(
        -_backroomsHalfW,
        Math.min(_backroomsHalfW, window.camera.position.x)
      );
    } else {
      checkDoorTransitions();
      checkMirrorPortalEntry();
    }

    window.renderer.render(window.scene, window.camera);
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Проверяет, дошёл ли игрок физически до открытого портала-зеркала.
 * Зеркало стоит на x ≈ -2.95 (западная стена спальни), boundingBox
 * уже снят (см. applyAnomalyToObject → mirrorPortal), так что игрок
 * может подойти вплотную и «войти» в него сам, через WASD/джойстик —
 * без мгновенного телепорта.
 */
function checkMirrorPortalEntry() {
  if (!window._mirrorPortalReady) return;
  if (window._mirrorEndingActive) return;

  const pos = window.camera.position;
  // Зеркало: position { x: -2.95, z: 0.8 }, ширина по Z ~0.7 (0.45..1.15)
  //
  // BUGFIX: игрок физически не может дойти до x <= -2.85 — коллизия с
  // западной стеной спальни (bedroom_wall_west, maxX: -3) останавливает
  // его капсулу (PLAYER_RADIUS = 0.25) уже на x ≈ -2.75
  // (px - PLAYER_RADIUS < wallMaxX  =>  px < -3 + 0.25 = -2.75).
  // Порог входа стоял ЗА пределами максимально достижимой позиции —
  // войти в портал было физически невозможно. Опущен до -2.74, чтобы
  // засчитываться чуть раньше упора в стену, с небольшим запасом.
  const nearZ = pos.z >= 0.3 && pos.z <= 1.3;
  const pastThreshold = pos.x <= -2.74; // вплотную к плоскости зеркала (достижимо)

  if (nearZ && pastThreshold) {
    const mirrorObj = window._mirrorPortalReady;
    window._mirrorPortalReady = null;
    if (typeof window._triggerMirrorEnding === 'function') {
      window._triggerMirrorEnding(mirrorObj);
    }
  }
}

/**
 * Проверяет расстояние игрока до каждой двери. Если игрок вошёл
 * в радиус triggerRadius и эта дверь ещё не была триггером в этом
 * проходе — уведомляет AnomalyManager о смене комнаты.
 */
function checkDoorTransitions() {
  const playerPos = window.camera.position;

  // Выбираем ближайшую дверь в радиусе триггера, а не первую совпавшую по
  // порядку в массиве — так поведение остаётся корректным, даже если в
  // будущем радиусы двух дверей начнут пересекаться.
  let nearestDoor = null;
  let nearestDistSq = Infinity;

  for (const door of window.LevelConfig.doors) {
    const dx = playerPos.x - door.position.x;
    const dz = playerPos.z - door.position.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= door.triggerRadius * door.triggerRadius && distSq < nearestDistSq) {
      nearestDoor = door;
      nearestDistSq = distSq;
    }
  }

  if (nearestDoor) {
    if (_lastTriggeredDoorId !== nearestDoor.id) {
      _lastTriggeredDoorId = nearestDoor.id;
      window.AnomalyManager.onRoomTransition(nearestDoor.to);
      _updateActiveShadowLight(nearestDoor.to);
    }
    return;
  }

  // Игрок вышел из радиуса всех дверей — разрешаем повторный триггер
  _lastTriggeredDoorId = null;
}


// ----------------------------------------------------------
//  7. UI MANAGER — мост между AnomalyManager и DOM
//     (anomalies.js вызывает window.UIManager.onParanoiaChanged /
//      onAnomalyFixed / onGameOver — здесь их реальная реализация)
// ----------------------------------------------------------
window.UIManager = (() => {
  let paranoiaMeter   = null;
  let paranoiaFill    = null;
  let gameoverScreen  = null;
  let gameHud         = null;
  let winScreen       = null;
  let creditsScreen   = null;
  let noclipScreen    = null;
  let vignetteEl      = null;
  let mirrorEndingScreen = null;

  const CRITICAL_THRESHOLD = 70;
  const MID_THRESHOLD      = 35;

  // Базовая плотность тумана сцены (см. initScene) — паранойя добавляет к ней
  const FOG_BASE = 0.07;
  const FOG_MAX_ADD = 0.10; // при паранойе 100 туман гуще на столько

  function init() {
    paranoiaMeter  = document.getElementById('paranoia-meter');
    paranoiaFill   = document.getElementById('paranoia-bar-fill');
    gameoverScreen = document.getElementById('gameover-screen');
    gameHud        = document.getElementById('game-hud');
    winScreen      = document.getElementById('win-screen');
    creditsScreen  = document.getElementById('credits-screen');
    noclipScreen   = document.getElementById('noclip-screen');
    vignetteEl     = document.getElementById('vignette');
    mirrorEndingScreen = document.getElementById('mirror-ending-screen');

    // ── Синхронизируем "0/35" в HUD и текст кредитов с реальным
    //    порогом победы AnomalyManager, чтобы не рассинхронилось при балансировке ──
    const winThreshold = window.AnomalyManager?._winThreshold ?? 35;
    const counter = document.getElementById('anomaly-counter');
    if (counter) counter.textContent = `0/${winThreshold}`;
    const creditsCount = document.getElementById('credits-anomaly-count');
    if (creditsCount) creditsCount.textContent = winThreshold;
  }

  return {
    init,

    onParanoiaChanged(level) {
      if (!paranoiaFill) return;
      const clamped = Math.max(0, Math.min(100, level));
      paranoiaFill.style.width = `${clamped}%`;
      if (paranoiaMeter) {
        paranoiaMeter.classList.toggle('critical', clamped >= CRITICAL_THRESHOLD);
      }

      // ── Виньетка реагирует на уровень паранойи ──
      if (vignetteEl) {
        vignetteEl.classList.toggle('paranoia-critical', clamped >= CRITICAL_THRESHOLD);
        vignetteEl.classList.toggle(
          'paranoia-mid',
          clamped >= MID_THRESHOLD && clamped < CRITICAL_THRESHOLD
        );
      }

      // ── Туман сцены сгущается вместе с паранойей ──
      if (window.scene && window.scene.fog) {
        window.scene.fog.density = FOG_BASE + (clamped / 100) * FOG_MAX_ADD;
      }
    },

    onAnomalyFixed(id, paranoia, count) {
      window.AudioManager.playFlashSuccess();
      // обновляем счётчик в HUD если есть элемент
      const winThreshold = window.AnomalyManager?._winThreshold ?? 35;
      const counter = document.getElementById('anomaly-counter');
      if (counter) counter.textContent = `${count || 0}/${winThreshold}`;
    },

    onGameOver() {
      window.gamePaused = true;
      window.AudioManager.stopAll();
      gameHud?.classList.add('hidden');
      gameoverScreen?.classList.remove('hidden');
    },

    // ── Победа: сначала показываем win-screen (место для видео) ──────────
    onGameWin() {
      window.gamePaused = true;
      window.AudioManager.stopAll();
      gameHud?.classList.add('hidden');
      winScreen?.classList.remove('hidden');
    },

    // ── Кредиты/Благодарности ─────────────────────────────────────────────
    showCredits() {
      winScreen?.classList.add('hidden');
      creditsScreen?.classList.remove('hidden');
    },

    // ── Ноуклип режим ────────────────────────────────────────────────────
    // Вызывается с ДВУХ экранов: обычные "кредиты" и секретная концовка
    // "Зеркало" (mirrorEndingScreen). Раньше скрывался только credits-screen,
    // и если ноуклип запускали с экрана психушки, mirrorEndingScreen
    // оставался поверх canvas и перехватывал все клики — кнопка внешне
    // "не работала", хотя обработчик исправно срабатывал.
    startNoclip() {
      creditsScreen?.classList.add('hidden');
      mirrorEndingScreen?.classList.add('hidden');
      noclipScreen?.classList.remove('hidden');
      _startNoclipMode();
    },

    // ── Секретная концовка «Зеркало»: экран после психушки ────────────────
    onMirrorEndingComplete() {
      window._mirrorEndingActive = false;
      window.gamePaused = true;
      window.AudioManager.stopAll();
      gameHud?.classList.add('hidden');
      mirrorEndingScreen?.classList.remove('hidden');
    },

    reset() {
      if (paranoiaFill) paranoiaFill.style.width = '0%';
      paranoiaMeter?.classList.remove('critical');
      vignetteEl?.classList.remove('paranoia-mid', 'paranoia-critical');
      if (window.scene && window.scene.fog) {
        window.scene.fog.density = FOG_BASE;
      }
      gameoverScreen?.classList.add('hidden');
      winScreen?.classList.add('hidden');
      creditsScreen?.classList.add('hidden');
      noclipScreen?.classList.add('hidden');
      mirrorEndingScreen?.classList.add('hidden');
    },
  };
})();


// ----------------------------------------------------------
//  8. DOM-READY: UI WIRING
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  // ── Element references ────────────────────────────────
  const startScreen      = document.getElementById('start-screen');
  const btnStart          = document.getElementById('btn-start');

  const settingsScreen   = document.getElementById('settings-screen');
  const btnSettingsOpen  = document.getElementById('btn-settings-open');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  const sliderSens       = document.getElementById('slider-sens');
  const sliderVolume     = document.getElementById('slider-volume');
  const selectShadows    = document.getElementById('select-shadows');

  const gameHud           = document.getElementById('game-hud');
  const btnFocus           = document.getElementById('btn-focus');
  const progressCircle    = document.getElementById('progress-circle');
  const flashScreen        = document.getElementById('flash-screen');
  const touchHint           = document.getElementById('touch-hint');

  const btnRestart          = document.getElementById('btn-restart');

  window.UIManager.init();

  // ── Constants ─────────────────────────────────────────
  /** Full circumference of the SVG circle (r = 36 → 2πr ≈ 226) */
  const CIRCLE_FULL      = 226;
  /** Duration in ms to fully charge the focus ability */
  const FOCUS_DURATION   = 2500;
  /** Tick interval for the progress animation in ms */
  const TICK_MS          = 50;

  /**
   * Подключает обработчик и к 'touchend', и к 'click', без двойного
   * срабатывания на одно касание (мобильные браузеры посылают оба).
   * Нужно, чтобы кнопки реагировали мгновенно на тач, а на десктопе
   * продолжали работать через обычный click.
   */
  function onTap(el, handler) {
    if (!el) return;
    let lastHandledAt = 0;

    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      lastHandledAt = Date.now();
      handler(e);
    }, { passive: false });

    el.addEventListener('click', (e) => {
      // Подавляем синтетический click, который браузер шлёт следом за touchend
      if (Date.now() - lastHandledAt < 500) return;
      handler(e);
    });
  }


  // ── 8.1  Start / Disclaimer screen ───────────────────
  if (btnStart) {
    onTap(btnStart, () => {
      startScreen?.classList.add('hidden');
      gameHud?.classList.remove('hidden');
      touchHint?.classList.remove('fade-out');
      startGame();
    });
  }


  // ── 8.2  Settings screen ──────────────────────────────
  if (btnSettingsOpen) {
    onTap(btnSettingsOpen, () => {
      settingsScreen?.classList.remove('hidden');
    });
  }

  if (btnCloseSettings) {
    onTap(btnCloseSettings, () => {
      settingsScreen?.classList.add('hidden');
    });
  }


  // ── 8.3  Settings sliders ─────────────────────────────
  if (sliderSens) {
    G_Settings.sensitivity = Number(sliderSens.value);
    sliderSens.addEventListener('input', () => {
      G_Settings.sensitivity = Number(sliderSens.value);
    });
  }

  if (sliderVolume) {
    G_Settings.volume = Number(sliderVolume.value);
    sliderVolume.addEventListener('input', () => {
      G_Settings.volume = Number(sliderVolume.value);
      window.AudioManager.refreshVolume();
    });
  }

  // ── 8.3b  Качество теней ──────────────────────────────
  if (selectShadows) {
    selectShadows.value = G_Settings.shadowQuality;
    selectShadows.addEventListener('change', () => {
      applyShadowQuality(selectShadows.value);
    });
  }


  // ── 8.4  Touch hint — скрывается после первого реального движения ──
  if (touchHint) {
    let hintDismissed = false;
    const dismissHint = () => {
      if (hintDismissed) return;
      hintDismissed = true;
      touchHint.classList.add('fade-out');
    };
    window.addEventListener('touchstart', dismissHint, { passive: true, once: true });
    window.addEventListener('mousedown', dismissHint, { passive: true, once: true });
  }


  // ── 8.5  Focus / Anomaly-fix button ───────────────────
  if (btnFocus && progressCircle) {
    let focusInterval = null;
    let focusElapsed  = 0;

    function setCircleProgress(fraction) {
      const offset = CIRCLE_FULL * (1 - Math.min(fraction, 1));
      progressCircle.style.strokeDashoffset = offset;
    }

    function resetFocus() {
      clearInterval(focusInterval);
      focusInterval = null;
      focusElapsed  = 0;
      setCircleProgress(0);
      window.AudioManager.stopGlitch();
    }

    function triggerFix() {
      resetFocus();
      window.AnomalyManager.fixAnomaly();

      if (flashScreen) {
        flashScreen.classList.add('active');
        setTimeout(() => flashScreen.classList.remove('active'), 220); // чуть увеличен белый экран
      }
    }

    function beginCharge() {
      if (window.gamePaused) return;
      if (focusInterval) return;
      focusElapsed = 0;
      setCircleProgress(0);
      window.AudioManager.playGlitch();

      focusInterval = setInterval(() => {
        focusElapsed += TICK_MS;
        setCircleProgress(focusElapsed / FOCUS_DURATION);

        if (focusElapsed >= FOCUS_DURATION) {
          triggerFix();
        }
      }, TICK_MS);
    }

    function endCharge() {
      if (focusElapsed < FOCUS_DURATION) {
        resetFocus();
      }
    }

    btnFocus.addEventListener('touchstart', (e) => {
      e.preventDefault();
      beginCharge();
    }, { passive: false });

    ['touchend', 'touchcancel'].forEach((evt) => {
      btnFocus.addEventListener(evt, (e) => {
        e.preventDefault();
        endCharge();
      }, { passive: false });
    });

    // Desktop fallback
    btnFocus.addEventListener('mousedown', beginCharge);
    ['mouseup', 'mouseleave'].forEach((evt) => {
      btnFocus.addEventListener(evt, endCharge);
    });
  }


  // ── 8.6  Restart after Game Over ──────────────────────
  if (btnRestart) {
    onTap(btnRestart, () => {
      window.location.reload();
    });
  }

  // ── 8.8  Win screen ───────────────────────────────────
  const winScreen     = document.getElementById('win-screen');
  const btnWinNext    = document.getElementById('btn-win-next');   // → кредиты
  if (btnWinNext) {
    onTap(btnWinNext, () => {
      window.UIManager.showCredits();
    });
  }

  // ── 8.9  Credits screen ────────────────────────────────
  const creditsScreen    = document.getElementById('credits-screen');
  const btnCreditsReplay = document.getElementById('btn-credits-replay');  // заново
  const btnCreditsNoclip = document.getElementById('btn-credits-noclip');  // ноуклип

  if (btnCreditsReplay) {
    onTap(btnCreditsReplay, () => {
      window.location.reload();
    });
  }

  if (btnCreditsNoclip) {
    onTap(btnCreditsNoclip, () => {
      window.UIManager.startNoclip();
    });
  }

  // ── 8.10  Noclip screen ────────────────────────────────
  const btnNoclipRestart = document.getElementById('btn-noclip-restart');
  if (btnNoclipRestart) {
    onTap(btnNoclipRestart, () => {
      window.location.reload();
    });
  }

  // ── 8.11  Секретная концовка «Зеркало» — экран после психушки ──
  const btnMirrorEndingReplay = document.getElementById('btn-mirror-ending-replay');
  if (btnMirrorEndingReplay) {
    onTap(btnMirrorEndingReplay, () => {
      window.location.reload();
    });
  }

  // Ноуклип-режим доступен и с секретной концовки «Зеркало» —
  // та же логика, что и с обычного экрана кредитов (см. 8.9).
  const btnMirrorEndingNoclip = document.getElementById('btn-mirror-ending-noclip');
  if (btnMirrorEndingNoclip) {
    onTap(btnMirrorEndingNoclip, () => {
      window.UIManager.startNoclip();
    });
  }

  // ── 8.7  Fullscreen ───────────────────────────────────
  const btnFullscreen  = document.getElementById('btn-fullscreen');
  const iconExpand     = document.getElementById('icon-expand');
  const iconCompress   = document.getElementById('icon-compress');

  function updateFullscreenIcon() {
    const isFs = !!document.fullscreenElement;
    if (iconExpand)   iconExpand.style.display   = isFs ? 'none'  : '';
    if (iconCompress) iconCompress.style.display = isFs ? ''      : 'none';
  }

  if (btnFullscreen) {
    onTap(btnFullscreen, () => {
      if (!document.fullscreenElement) {
        (document.documentElement.requestFullscreen?.() ||
         document.documentElement.webkitRequestFullscreen?.())
          ?.catch(() => {});
      } else {
        (document.exitFullscreen?.() ||
         document.webkitExitFullscreen?.())
          ?.catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange',       updateFullscreenIcon);
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
  }

}); // end DOMContentLoaded
