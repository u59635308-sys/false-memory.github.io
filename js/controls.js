// ============================================================
//  FALSE MEMORY — Player Controls
//  js/controls.js
//
//  Depends on:
//    - THREE (global)
//    - window.LevelConfig  (js/levels.js)
//    - window.G_Settings   (js/main.js)
//    - camera              (Three.js PerspectiveCamera, passed by caller)
// ============================================================

class PlayerControls {

  // ── Constants ────────────────────────────────────────────

  /** Movement speed in units/second */
  static MOVE_SPEED       = 3.0;

  /** Base rotation speed in radians/pixel */
  static ROT_SPEED_BASE   = 0.003;

  /** Sensitivity scale: maps G_Settings.sensitivity (1–10) to a multiplier */
  static SENS_SCALE       = 0.10;

  /** Half-width of the player's AABB capsule (XZ plane) */
  static PLAYER_RADIUS    = 0.25;

  /** Vertical eye height above Y=0 */
  static EYE_HEIGHT       = 1.65;

  /** Clamp pitch so the player can't flip upside-down (radians) */
  static PITCH_LIMIT      = Math.PI / 2 - 0.05;


  // ── Constructor ──────────────────────────────────────────

  constructor(camera) {
    this.camera = camera;

    // Apply start transform from LevelConfig
    const { position, rotationY } = window.LevelConfig.playerStart;
    this.camera.position.set(
      position.x,
      position.y + PlayerControls.EYE_HEIGHT,
      position.z
    );

    // Euler angles stored separately for clean accumulation
    this._yaw   = rotationY;
    this._pitch = 0;
    this._applyRotation();

    // ── Internal touch state ─────────────────────────────

    // Left joystick (movement)
    this._leftTouch  = null;   // { id, startX, startY, curX, curY }

    // Right joystick (look)
    this._rightTouch = null;   // { id, prevX, prevY }

    // ── Bind & register event listeners ─────────────────

    this._onTouchStart  = this._onTouchStart.bind(this);
    this._onTouchMove   = this._onTouchMove.bind(this);
    this._onTouchEnd    = this._onTouchEnd.bind(this);

    window.addEventListener('touchstart',  this._onTouchStart,  { passive: false });
    window.addEventListener('touchmove',   this._onTouchMove,   { passive: false });
    window.addEventListener('touchend',    this._onTouchEnd,    { passive: false });
    window.addEventListener('touchcancel', this._onTouchEnd,    { passive: false });

    // ── Keyboard fallback (desktop testing) ─────────────

    this._keys = { w: false, a: false, s: false, d: false };
    window.addEventListener('keydown', (e) => {
      if (e.key in this._keys) this._keys[e.key] = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key in this._keys) this._keys[e.key] = false;
    });
  }


  // ── Public: main update (call from render loop) ──────────

  update(deltaTime) {
    if (window.gamePaused) return;
    this._processMovement(deltaTime);
  }


  // ── Rotation helpers ────────────────────────────────────

  _applyRotation() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this._yaw;
    this.camera.rotation.x = this._pitch;
    this.camera.rotation.z = 0;
  }

  _rotate(deltaX, deltaY) {
    if (window.gamePaused) return;

    const sens = (window.G_Settings?.sensitivity ?? 5) * PlayerControls.SENS_SCALE;
    const speed = PlayerControls.ROT_SPEED_BASE * sens;

    this._yaw   -= deltaX * speed;
    this._pitch -= deltaY * speed;
    this._pitch  = Math.max(
      -PlayerControls.PITCH_LIMIT,
      Math.min(PlayerControls.PITCH_LIMIT, this._pitch)
    );
    this._applyRotation();
  }


  // ── Movement & collision ─────────────────────────────────

  _processMovement(deltaTime) {
    const moveVec = new THREE.Vector2(0, 0);

    // ── Touch joystick input ─────────────────────────────
    if (this._leftTouch) {
      const dx = this._leftTouch.curX - this._leftTouch.startX;
      const dz = this._leftTouch.curY - this._leftTouch.startY;
      const len = Math.sqrt(dx * dx + dz * dz);

      // Dead zone: 8 px
      if (len > 8) {
        // Normalize and clamp to unit circle
        const norm  = Math.min(len / 60, 1.0);   // 60 px = full speed
        moveVec.x   = (dx / len) * norm;
        moveVec.y   = (dz / len) * norm;
      }
    }

    // ── Keyboard fallback ────────────────────────────────
    if (this._keys.w) moveVec.y -= 1;
    if (this._keys.s) moveVec.y += 1;
    if (this._keys.a) moveVec.x -= 1;
    if (this._keys.d) moveVec.x += 1;

    // Normalize diagonal keyboard input
    const kLen = moveVec.length();
    if (kLen > 1) moveVec.divideScalar(kLen);

    if (moveVec.lengthSq() === 0) {
      // Игрок стоит — останавливаем шаги
      if (window.AudioManager) window.AudioManager.stopFootsteps();
      return;
    }

    // Игрок движется — запускаем шаги (повторный вызов безопасен)
    if (window.AudioManager) window.AudioManager.playFootsteps();

    // ── World-space direction from yaw only ──────────────
    const sinYaw = Math.sin(this._yaw);
    const cosYaw = Math.cos(this._yaw);

    // Forward vector (camera looks toward -Z local)
    const fwdX = -sinYaw;
    const fwdZ = -cosYaw;

    // Right vector (perpendicular on XZ plane)
    const rgtX =  cosYaw;
    const rgtZ = -sinYaw;

    const speed = PlayerControls.MOVE_SPEED * deltaTime;

    const desiredDX = (fwdX * (-moveVec.y) + rgtX * moveVec.x) * speed;
    const desiredDZ = (fwdZ * (-moveVec.y) + rgtZ * moveVec.x) * speed;

    const pos = this.camera.position;

    // ── Slide-based collision resolution ────────────────
    //  1. Try full diagonal move
    //  2. If blocked — try X-only
    //  3. If blocked — try Z-only
    //  4. If still blocked — stay put

    const fullX = pos.x + desiredDX;
    const fullZ = pos.z + desiredDZ;

    // В режиме ноуклипа — полностью отключаем коллизии
    if (this.noclip || window.noclipActive) {
      pos.x = fullX;
      pos.z = fullZ;
      return;
    }

    if (!this.checkCollisions(fullX, fullZ)) {
      pos.x = fullX;
      pos.z = fullZ;
    } else {
      // BUGFIX: скольжение вдоль стены должно проверяться от ИСХОДНОЙ
      // позиции по другой оси, а не от уже изменённой pos.x/pos.z —
      // иначе игрок залипал в углах при диагональном движении.
      if (!this.checkCollisions(fullX, pos.z)) {
        pos.x = fullX;
      } else if (!this.checkCollisions(pos.x, fullZ)) {
        pos.z = fullZ;
      }
    }
  }


  // ── AABB Collision ──────────────────────────────────────

  /**
   * Returns TRUE if the predicted position (X, Z) overlaps any
   * wall or furniture bounding box in the level.
   *
   * The player is treated as an AABB square with half-side = PLAYER_RADIUS.
   *
   * @param {number} px - Predicted world X
   * @param {number} pz - Predicted world Z
   * @returns {boolean}
   */
  checkCollisions(px, pz) {
    const r = PlayerControls.PLAYER_RADIUS;

    const pMinX = px - r;
    const pMaxX = px + r;
    const pMinZ = pz - r;
    const pMaxZ = pz + r;

    for (const room of window.LevelConfig.rooms) {
      // Walls
      for (const wall of room.walls) {
        if (this._overlapsAABB(pMinX, pMaxX, pMinZ, pMaxZ, wall.boundingBox)) {
          return true;
        }
      }

      // Furniture
      for (const item of room.furniture) {
        if (item.boundingBox && this._overlapsAABB(pMinX, pMaxX, pMinZ, pMaxZ, item.boundingBox)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * AABB overlap test between the player rectangle and an object box.
   * Separation on ANY axis means no collision.
   */
  _overlapsAABB(pMinX, pMaxX, pMinZ, pMaxZ, box) {
    return (
      pMaxX > box.minX &&
      pMinX < box.maxX &&
      pMaxZ > box.minZ &&
      pMinZ < box.maxZ
    );
  }


  // ── Touch event handlers ─────────────────────────────────

  _isLeftSide(clientX) {
    return clientX < window.innerWidth / 2;
  }

  /**
   * Возвращает true, если тап произошёл на интерактивном элементе UI
   * (кнопки, слайдеры, открытые оверлеи настроек/game-over), а не на canvas.
   * В этом случае джойстик/поворот камеры должны его полностью игнорировать,
   * чтобы preventDefault() не «съедал» клик по кнопке.
   */
  _isUITarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest(
      'button, input, a, ' +
      '#settings-screen:not(.hidden), ' +
      '#gameover-screen:not(.hidden), ' +
      '#start-screen:not(.hidden), ' +
      '#win-screen:not(.hidden), ' +
      '#credits-screen:not(.hidden), ' +
      '#noclip-screen:not(.hidden), ' +
      '#mirror-ending-screen:not(.hidden)'
    );
  }

  _onTouchStart(e) {
    // Тап по кнопке/слайдеру/открытому экрану — не трогаем, отдаём браузеру
    if (this._isUITarget(e.target)) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (this._isLeftSide(touch.clientX)) {
        // Only one left touch at a time
        if (!this._leftTouch) {
          this._leftTouch = {
            id:     touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            curX:   touch.clientX,
            curY:   touch.clientY,
          };
        }
      } else {
        // Only one right touch at a time
        if (!this._rightTouch) {
          this._rightTouch = {
            id:    touch.identifier,
            prevX: touch.clientX,
            prevY: touch.clientY,
          };
        }
      }
    }
  }

  _onTouchMove(e) {
    if (this._isUITarget(e.target)) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      // Update left (movement) joystick
      if (this._leftTouch && touch.identifier === this._leftTouch.id) {
        this._leftTouch.curX = touch.clientX;
        this._leftTouch.curY = touch.clientY;
      }

      // Update right (look) joystick
      if (this._rightTouch && touch.identifier === this._rightTouch.id) {
        const deltaX = touch.clientX - this._rightTouch.prevX;
        const deltaY = touch.clientY - this._rightTouch.prevY;

        this._rotate(deltaX, deltaY);

        this._rightTouch.prevX = touch.clientX;
        this._rightTouch.prevY = touch.clientY;
      }
    }
  }

  _onTouchEnd(e) {
    if (this._isUITarget(e.target)) return;
    e.preventDefault();

    for (const touch of e.changedTouches) {
      if (this._leftTouch && touch.identifier === this._leftTouch.id) {
        this._leftTouch = null;
        // Левый джойстик отпущен — игрок остановился
        if (window.AudioManager) window.AudioManager.stopFootsteps();
      }
      if (this._rightTouch && touch.identifier === this._rightTouch.id) {
        this._rightTouch = null;
      }
    }
  }


  // ── Cleanup ──────────────────────────────────────────────

  dispose() {
    window.removeEventListener('touchstart',  this._onTouchStart);
    window.removeEventListener('touchmove',   this._onTouchMove);
    window.removeEventListener('touchend',    this._onTouchEnd);
    window.removeEventListener('touchcancel', this._onTouchEnd);
  }
}


// ── Global export (call after Three.js camera is ready) ─────
//
//   In your scene init:
//     window.controls = new PlayerControls(camera);
//
//   In your render loop:
//     window.controls.update(deltaTime);
//
window.PlayerControls = PlayerControls;
