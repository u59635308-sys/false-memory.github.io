/**
 * js/anomalies.js
 * False Memory — Менеджер аномалий и искажений реальности
 *
 * Зависимости: Three.js (window.THREE), LevelConfig (window.LevelConfig),
 *              сцена (window.scene), камера (window.camera)
 */

(() => {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  // БАЗА АНОМАЛИЙ
  // Каждая запись описывает одно возможное искажение реальности в комнате.
  // ─────────────────────────────────────────────────────────────────────────────

  const AnomalyDatabase = [
    // ── СПАЛЬНЯ (bedroom) ────────────────────────────────────────────────────
    {
      id: 'bedroom_light_red',
      roomId: 'bedroom',
      targetId: 'bedroom_light',
      type: 'lightColor',
      anomalousValue: 0xff0000,          // красный
      description: 'Свет в спальне стал кроваво-красным',
    },
    {
      id: 'bedroom_bed_scale',
      roomId: 'bedroom',
      targetId: 'bed',
      type: 'scale',
      anomalousValue: { x: 1, y: 2.2, z: 1 },
      description: 'Кровать неестественно вытянулась вверх',
    },
    {
      id: 'bedroom_bed_position',
      roomId: 'bedroom',
      targetId: 'bed',
      type: 'position',
      anomalousValue: { x: 1.8, y: null, z: null }, // null = не менять ось
      description: 'Кровать сдвинулась к стене',
    },
    {
      id: 'bedroom_wardrobe_hidden',
      roomId: 'bedroom',
      targetId: 'wardrobe',
      type: 'visibility',
      anomalousValue: false,
      description: 'Платяной шкаф исчез из спальни',
    },
    {
      id: 'bedroom_nightstand_left_scale',
      roomId: 'bedroom',
      targetId: 'nightstand_left',
      type: 'scale',
      anomalousValue: { x: 1.8, y: 1.8, z: 1.8 },
      description: 'Прикроватная тумбочка увеличилась вдвое',
    },
    {
      id: 'bedroom_nightstand_right_position',
      roomId: 'bedroom',
      targetId: 'nightstand_right',
      type: 'position',
      anomalousValue: { x: null, y: 0.6, z: null },
      description: 'Тумбочка зависла над полом',
    },
    {
      id: 'bedroom_wardrobe_position',
      roomId: 'bedroom',
      targetId: 'wardrobe',
      type: 'position',
      anomalousValue: { x: -1.0, y: null, z: null },
      description: 'Шкаф отодвинулся от стены',
    },

    // ── КУХНЯ (kitchen) ─────────────────────────────────────────────────────
    {
      id: 'kitchen_table_shift',
      roomId: 'kitchen',
      targetId: 'kitchen_table',
      type: 'position',
      anomalousValue: { x: 1.5, y: null, z: null },
      description: 'Кухонный стол сдвинулся на 1.5 м',
    },
    {
      id: 'kitchen_light_green',
      roomId: 'kitchen',
      targetId: 'kitchen_light',
      type: 'lightColor',
      anomalousValue: 0x00ff44,
      description: 'Свет на кухне позеленел',
    },
    {
      id: 'kitchen_chair1_scale',
      roomId: 'kitchen',
      targetId: 'kitchen_chair_1',
      type: 'scale',
      anomalousValue: { x: 0.3, y: 0.3, z: 0.3 },
      description: 'Стул на кухне уменьшился',
    },
    {
      id: 'kitchen_chair2_hidden',
      roomId: 'kitchen',
      targetId: 'kitchen_chair_2',
      type: 'visibility',
      anomalousValue: false,
      description: 'Второй стул на кухне пропал',
    },
    {
      id: 'kitchen_fridge_scale',
      roomId: 'kitchen',
      targetId: 'fridge',
      type: 'scale',
      anomalousValue: { x: 1.4, y: 1.6, z: 1.4 },
      description: 'Холодильник стал угрожающе огромным',
    },
    {
      id: 'kitchen_counter_position',
      roomId: 'kitchen',
      targetId: 'kitchen_counter',
      type: 'position',
      anomalousValue: { x: null, y: null, z: 4.5 },
      description: 'Кухонная тумба сместилась к центру комнаты',
    },
    {
      id: 'kitchen_table_scale',
      roomId: 'kitchen',
      targetId: 'kitchen_table',
      type: 'scale',
      anomalousValue: { x: 1.6, y: 1, z: 1.6 },
      description: 'Кухонный стол стал заметно шире',
    },

    // ── КОРИДОР (corridor) ───────────────────────────────────────────────────
    {
      id: 'corridor_frame1_hidden',
      roomId: 'corridor',
      targetId: 'family_photo_frame_1',
      type: 'visibility',
      anomalousValue: false,
      description: 'Первая фоторамка в коридоре исчезла',
    },
    {
      id: 'corridor_frame2_position',
      roomId: 'corridor',
      targetId: 'family_photo_frame_2',
      type: 'position',
      anomalousValue: { x: null, y: 2.2, z: null },
      description: 'Фоторамка переместилась почти к потолку',
    },
    {
      id: 'corridor_light_dim',
      roomId: 'corridor',
      targetId: 'corridor_light',
      type: 'lightColor',
      anomalousValue: 0x551111,
      description: 'Свет в коридоре стал тускло-багровым',
    },
    {
      id: 'corridor_mirror_scale',
      roomId: 'corridor',
      targetId: 'hallway_mirror',
      type: 'scale',
      anomalousValue: { x: 1, y: 2.5, z: 1 },
      description: 'Зеркало в коридоре вытянулось вдвое',
    },
    {
      id: 'corridor_dresser_position',
      roomId: 'corridor',
      targetId: 'dresser',
      type: 'position',
      anomalousValue: { x: 7.8, y: null, z: null },
      description: 'Комод в коридоре отъехал от стены',
    },
    {
      id: 'corridor_coatrack_scale',
      roomId: 'corridor',
      targetId: 'coat_rack',
      type: 'scale',
      anomalousValue: { x: 0.4, y: 0.4, z: 0.4 },
      description: 'Вешалка для одежды уменьшилась',
    },
    {
      id: 'corridor_frame3_hidden',
      roomId: 'corridor',
      targetId: 'family_photo_frame_3',
      type: 'visibility',
      anomalousValue: false,
      description: 'Третья фоторамка в коридоре исчезла',
    },

    // ── ВАННАЯ (bathroom) ────────────────────────────────────────────────────
    {
      id: 'bathroom_light_flicker',
      roomId: 'bathroom',
      targetId: 'bathroom_light',
      type: 'lightColor',
      anomalousValue: 0xffaa00,
      description: 'Свет в ванной стал жёлто-оранжевым',
    },
    {
      id: 'bathroom_sink_position',
      roomId: 'bathroom',
      targetId: 'sink_cabinet',
      type: 'position',
      anomalousValue: { x: null, y: null, z: 5.5 }, // сдвинулась к центру комнаты
      description: 'Раковина переместилась в центр ванной',
    },
    {
      id: 'bathroom_mirror_scale',
      roomId: 'bathroom',
      targetId: 'bathroom_mirror',      // ← ИСПРАВЛЕНО: было 'mirror'
      type: 'scale',
      anomalousValue: { x: 1, y: 2.5, z: 1 },
      description: 'Зеркало в ванной вытянулось вдвое',
    },
    {
      id: 'bathroom_shower_hidden',
      roomId: 'bathroom',
      targetId: 'shower_cabin',
      type: 'visibility',
      anomalousValue: false,
      description: 'Душевая кабина исчезла',
    },
    {
      id: 'bathroom_sink_scale',
      roomId: 'bathroom',
      targetId: 'sink_cabinet',
      type: 'scale',
      anomalousValue: { x: 0.4, y: 0.4, z: 0.4 },
      description: 'Раковина с тумбой резко уменьшилась',
    },
    {
      id: 'bathroom_toilet_hidden',
      roomId: 'bathroom',
      targetId: 'toilet',
      type: 'visibility',
      anomalousValue: false,
      description: 'Унитаз пропал из ванной',
    },
    {
      id: 'bathroom_toilet_scale',
      roomId: 'bathroom',
      targetId: 'toilet',
      type: 'scale',
      anomalousValue: { x: 1.6, y: 1.6, z: 1.6 },
      description: 'Унитаз стал аномально большим',
    },

    // ── СПАЛЬНЯ — новая мебель ────────────────────────────────────────────────
    {
      id: 'bedroom_desk_position',
      roomId: 'bedroom',
      targetId: 'desk',
      type: 'position',
      anomalousValue: { x: null, y: 0.4, z: null },
      description: 'Письменный стол поднялся над полом',
    },
    {
      id: 'bedroom_desk_hidden',
      roomId: 'bedroom',
      targetId: 'desk',
      type: 'visibility',
      anomalousValue: false,
      description: 'Письменный стол исчез',
    },

    // ── КОРИДОР — новая мебель ────────────────────────────────────────────────
    {
      id: 'corridor_phonetable_scale',
      roomId: 'corridor',
      targetId: 'phone_table',
      type: 'scale',
      anomalousValue: { x: 0.3, y: 0.3, z: 0.3 },
      description: 'Столик у стены уменьшился почти до нуля',
    },
    {
      id: 'corridor_phonetable_hidden',
      roomId: 'corridor',
      targetId: 'phone_table',
      type: 'visibility',
      anomalousValue: false,
      description: 'Столик у стены исчез',
    },

    // ── КУХНЯ — новая мебель ──────────────────────────────────────────────────
    {
      id: 'kitchen_microwave_scale',
      roomId: 'kitchen',
      targetId: 'microwave',
      type: 'scale',
      anomalousValue: { x: 2.2, y: 2.2, z: 2.2 },
      description: 'Микроволновка стала огромной',
    },
    {
      id: 'kitchen_microwave_hidden',
      roomId: 'kitchen',
      targetId: 'microwave',
      type: 'visibility',
      anomalousValue: false,
      description: 'Микроволновка пропала со столешницы',
    },
    {
      id: 'kitchen_wallcabinet_position',
      roomId: 'kitchen',
      targetId: 'kitchen_wall_cabinet',
      type: 'position',
      anomalousValue: { x: null, y: null, z: 7.5 }, // выдвинулся от стены в центр кухни
      description: 'Навесной шкаф отлетел от стены',
    },
    {
      id: 'kitchen_wallcabinet_scale',
      roomId: 'kitchen',
      targetId: 'kitchen_wall_cabinet',
      type: 'scale',
      anomalousValue: { x: 1, y: 2.4, z: 1 },
      description: 'Навесной шкаф вытянулся до потолка',
    },
    {
      id: 'kitchen_wallcabinet_hidden',
      roomId: 'kitchen',
      targetId: 'kitchen_wall_cabinet',
      type: 'visibility',
      anomalousValue: false,
      description: 'Навесной шкаф над столешницей исчез',
    },

    // ── НОВЫЕ АНОМАЛИИ — больше предметов ─────────────────────────────────────
    // Спальня
    {
      id: 'bedroom_painting_hidden',
      roomId: 'bedroom',
      targetId: 'bedroom_painting',
      type: 'visibility',
      anomalousValue: false,
      description: 'Картина на стене исчезла',
    },
    {
      id: 'bedroom_painting_position',
      roomId: 'bedroom',
      targetId: 'bedroom_painting',
      type: 'position',
      anomalousValue: { x: null, y: 2.5, z: null },
      description: 'Картина поднялась к самому потолку',
    },
    {
      id: 'bedroom_rug_scale',
      roomId: 'bedroom',
      targetId: 'bedroom_rug',
      type: 'scale',
      anomalousValue: { x: 3.0, y: 1.0, z: 3.0 },
      description: 'Коврик разросся на весь пол',
    },
    {
      id: 'bedroom_mirror_hidden',
      roomId: 'bedroom',
      targetId: 'bedroom_mirror',
      type: 'visibility',
      anomalousValue: false,
      description: 'Зеркало в спальне исчезло',
    },
    {
      id: 'bedroom_mirror_scale',
      roomId: 'bedroom',
      targetId: 'bedroom_mirror',
      type: 'scale',
      anomalousValue: { x: 1, y: 3.0, z: 1 },
      description: 'Зеркало вытянулось в пол и потолок',
    },
    {
      id: 'bedroom_chair_hidden',
      roomId: 'bedroom',
      targetId: 'desk_chair',
      type: 'visibility',
      anomalousValue: false,
      description: 'Стул у стола исчез',
    },
    {
      id: 'bedroom_chair_position',
      roomId: 'bedroom',
      targetId: 'desk_chair',
      type: 'position',
      anomalousValue: { x: null, y: 1.2, z: null },
      description: 'Стул завис над полом',
    },

    // Коридор
    {
      id: 'corridor_frame4_scale',
      roomId: 'corridor',
      targetId: 'family_photo_frame_4',
      type: 'scale',
      anomalousValue: { x: 2.0, y: 2.0, z: 2.0 },
      description: 'Четвёртая рамка увеличилась вдвое',
    },
    {
      id: 'corridor_umbrella_hidden',
      roomId: 'corridor',
      targetId: 'umbrella_stand',
      type: 'visibility',
      anomalousValue: false,
      description: 'Зонтница пропала',
    },
    {
      id: 'corridor_mirror_hidden',
      roomId: 'corridor',
      targetId: 'hallway_mirror',
      type: 'visibility',
      anomalousValue: false,
      description: 'Зеркало в коридоре исчезло',
    },
    {
      id: 'corridor_dresser_scale',
      roomId: 'corridor',
      targetId: 'dresser',
      type: 'scale',
      anomalousValue: { x: 1, y: 2.5, z: 1 },
      description: 'Комод вырос до потолка',
    },

    // Кухня
    {
      id: 'kitchen_fridge_hidden',
      roomId: 'kitchen',
      targetId: 'fridge',
      type: 'visibility',
      anomalousValue: false,
      description: 'Холодильник исчез с кухни',
    },
    {
      id: 'kitchen_fridge_position',
      roomId: 'kitchen',
      targetId: 'fridge',
      type: 'position',
      anomalousValue: { x: 7.0, y: null, z: null },
      description: 'Холодильник сдвинулся на середину кухни',
    },
    {
      id: 'kitchen_chair1_hidden',
      roomId: 'kitchen',
      targetId: 'kitchen_chair_1',
      type: 'visibility',
      anomalousValue: false,
      description: 'Первый стул на кухне исчез',
    },
    {
      id: 'kitchen_table_hidden',
      roomId: 'kitchen',
      targetId: 'kitchen_table',
      type: 'visibility',
      anomalousValue: false,
      description: 'Кухонный стол исчез',
    },
    {
      id: 'kitchen_counter_hidden',
      roomId: 'kitchen',
      targetId: 'kitchen_counter',
      type: 'visibility',
      anomalousValue: false,
      description: 'Кухонная тумба исчезла',
    },
    {
      id: 'kitchen_counter_scale',
      roomId: 'kitchen',
      targetId: 'kitchen_counter',
      type: 'scale',
      anomalousValue: { x: 1, y: 3.0, z: 1 },
      description: 'Кухонная тумба выросла до потолка',
    },

    // Ванная
    {
      id: 'bathroom_toilet_position',
      roomId: 'bathroom',
      targetId: 'toilet',
      type: 'position',
      anomalousValue: { x: null, y: 1.0, z: null },
      description: 'Унитаз завис над полом',
    },
    {
      id: 'bathroom_mirror_hidden',
      roomId: 'bathroom',
      targetId: 'bathroom_mirror',
      type: 'visibility',
      anomalousValue: false,
      description: 'Зеркало в ванной исчезло',
    },
    {
      id: 'bathroom_shower_scale',
      roomId: 'bathroom',
      targetId: 'shower_cabin',
      type: 'scale',
      anomalousValue: { x: 1.8, y: 1.8, z: 1.8 },
      description: 'Душевая кабина стала огромной',
    },
    {
      id: 'bathroom_light_blue',
      roomId: 'bathroom',
      targetId: 'bathroom_light',
      type: 'lightColor',
      anomalousValue: 0x0044ff,
      description: 'Свет в ванной стал холодно-синим',
    },

    // ── СЕКРЕТНАЯ КОНЦОВКА «ЗЕРКАЛО» ────────────────────────────────────────
    // special:true — исключается из обычного случайного пула спавна
    // (см. onRoomTransition: фильтрация кандидатов). Активируется вручную
    // через _activateAnomaly() ровно один раз, когда fixedAnomaliesCount
    // достигает 34 (см. fixAnomaly()).
    {
      id: 'bedroom_mirror_portal',
      roomId: 'bedroom',
      targetId: 'bedroom_mirror',
      type: 'mirrorPortal',
      anomalousValue: { color: 0x1a6b2e, scaleY: 2.6 },
      description: 'Зеркало налилось зелёным светом и вытянулось так, что в него можно войти',
      special: true,
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Находит Three.js-объект на сцене по его userData.id или имени.
   * @param {string} targetId
   * @returns {THREE.Object3D|null}
   */
  function findSceneObject(targetId) {
    let found = null;
    window.scene.traverse((obj) => {
      if (found) return;
      if (obj.userData && obj.userData.id === targetId) {
        found = obj;
      } else if (obj.name === targetId) {
        found = obj;
      }
    });
    return found;
  }

  /**
   * Применяет аномальное состояние к объекту на сцене.
   * @param {THREE.Object3D} obj
   * @param {object} anomaly
   */
  function applyAnomalyToObject(obj, anomaly) {
    switch (anomaly.type) {
      case 'lightColor': {
        if (obj.isLight) {
          obj.color.setHex(anomaly.anomalousValue);
        }
        break;
      }
      case 'position': {
        const v = anomaly.anomalousValue;
        if (v.x !== null && v.x !== undefined) obj.position.x = v.x;
        if (v.y !== null && v.y !== undefined) obj.position.y = v.y;
        if (v.z !== null && v.z !== undefined) obj.position.z = v.z;
        break;
      }
      case 'scale': {
        const s = anomaly.anomalousValue;
        obj.scale.set(
          s.x !== null && s.x !== undefined ? s.x : obj.scale.x,
          s.y !== null && s.y !== undefined ? s.y : obj.scale.y,
          s.z !== null && s.z !== undefined ? s.z : obj.scale.z,
        );
        break;
      }
      case 'texture': {
        const loader = new THREE.TextureLoader();
        loader.load(anomaly.anomalousValue, (tex) => {
          if (obj.material) {
            obj.material.map = tex;
            obj.material.needsUpdate = true;
          }
        });
        break;
      }
      case 'visibility': {
        // Применяем к объекту И всем потомкам — иначе Group остаётся видимой
        obj.visible = anomaly.anomalousValue;
        obj.traverse(child => { child.visible = anomaly.anomalousValue; });
        break;
      }
      case 'mirrorPortal': {
        // Зеркало резко "оживает": зелёный цвет + вытягивается по высоте,
        // чтобы игрок мог физически войти в него ногами (не телепорт).
        const v = anomaly.anomalousValue;
        if (obj.material) {
          obj.material.color.setHex(v.color);
          if ('emissive' in obj.material) {
            obj.material.emissive = obj.material.emissive || new THREE.Color();
            obj.material.emissive.setHex(v.color);
            obj.material.emissiveIntensity = 0.6;
          }
          obj.material.needsUpdate = true;
        }
        obj.scale.y = v.scaleY;

        // Снимаем boundingBox зеркала в LevelConfig — портал становится
        // проходимым, игрок дальше идёт в него сам через WASD/джойстик.
        if (window.LevelConfig && Array.isArray(window.LevelConfig.rooms)) {
          for (const room of window.LevelConfig.rooms) {
            const item = room.furniture?.find((f) => f.id === anomaly.targetId);
            if (item && item.boundingBox) {
              obj.userData._savedBoundingBox = item.boundingBox;
              delete item.boundingBox;
            }
          }
        }
        break;
      }
      default:
        console.warn(`[AnomalyManager] Неизвестный тип аномалии: ${anomaly.type}`);
    }
  }

  /**
   * Восстанавливает исходное состояние объекта из снимка originalState.
   * @param {THREE.Object3D} obj
   * @param {object} originalState  — снимок, сохранённый перед применением
   */
  function restoreObject(obj, originalState) {
    switch (originalState.type) {
      case 'lightColor': {
        if (obj.isLight) obj.color.setHex(originalState.value);
        break;
      }
      case 'position': {
        obj.position.copy(originalState.value);
        break;
      }
      case 'scale': {
        obj.scale.copy(originalState.value);
        break;
      }
      case 'texture': {
        if (obj.material) {
          obj.material.map = originalState.value;
          obj.material.needsUpdate = true;
        }
        break;
      }
      case 'visibility': {
        // Восстанавливаем visibility объекту И всем потомкам
        obj.visible = originalState.value;
        obj.traverse(child => { child.visible = originalState.value; });
        break;
      }
    }
  }

  /**
   * Снимает «скриншот» текущего состояния объекта для последующего восстановления.
   * @param {THREE.Object3D} obj
   * @param {string} type
   * @returns {object}
   */
  function snapshotState(obj, type) {
    switch (type) {
      case 'lightColor':
        return { type, value: obj.isLight ? obj.color.getHex() : 0xffffff };
      case 'position':
        return { type, value: obj.position.clone() };
      case 'scale':
        return { type, value: obj.scale.clone() };
      case 'texture':
        return { type, value: obj.material ? obj.material.map : null };
      case 'visibility':
        return { type, value: obj.visible };
      case 'mirrorPortal':
        // Не восстанавливается обычным restoreObject — фиксация этой
        // аномалии сразу ведёт в _triggerMirrorEnding(), сцена целиком
        // заменяется на элитный коридор. Снимок хранится только для
        // единообразия структуры record.
        return { type, value: { color: obj.material ? obj.material.color.getHex() : 0xffffff, scaleY: obj.scale.y } };
      default:
        return { type, value: null };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // МЕНЕДЖЕР АНОМАЛИЙ
  // ─────────────────────────────────────────────────────────────────────────────

  const AnomalyManager = {
    /** Текущий ID комнаты, в которой находится игрок */
    currentRoomId: null,

    /**
     * activeAnomalies: Map<anomalyId, ActiveAnomalyRecord>
     */
    activeAnomalies: new Map(),

    /** Уровень паранойи (0–100) */
    paranoiaLevel: 0,

    /** Счётчик успешно исправленных аномалий (для финала) */
    fixedAnomaliesCount: 0,

    /** При скольки исправленных аномалиях наступает финал */
    _winThreshold: 35,

    /** Флаг: секретный портал-зеркало уже был принудительно заспавнен (только раз за игру) */
    _mirrorPortalTriggered: false,

    /** Максимум активных аномалий перед штрафом (базовое значение, см. _getTriggerThreshold) */
    _paranoiaTriggerThreshold: 3,

    /** Вероятность появления аномалии при переходе (базовое значение, см. _getSpawnChance) */
    _spawnChance: 0.65,

    /**
     * Динамическая вероятность спавна: растёт с прогрессом игрока,
     * чтобы вторая половина игры ощущалась заметно напряжённее первой.
     * 0 исправлений → базовый шанс; к _winThreshold шанс почти гарантирован.
     */
    _getSpawnChance() {
      const progress = Math.min(1, this.fixedAnomaliesCount / this._winThreshold);
      return this._spawnChance + progress * 0.30; // 0.65 → 0.95
    },

    /**
     * Динамический порог штрафа за непойманные аномалии: чем дальше игрок
     * продвинулся, тем менее он терпим к скоплению аномалий (порог снижается),
     * что заставляет действовать быстрее ближе к финалу.
     */
    _getTriggerThreshold() {
      const progress = Math.min(1, this.fixedAnomaliesCount / this._winThreshold);
      const reduced = this._paranoiaTriggerThreshold - Math.floor(progress * 2); // 3 → 1
      return Math.max(1, reduced);
    },

    /** Three.js Raycaster для фиксации */
    _raycaster: null,

    /**
     * Порядок комнат в цикле маршрута — всегда один и тот же.
     * Аномалия спавнится в комнате на 2 шага вперёд от текущей позиции
     * игрока, то есть игрок войдёт туда только через 2 перехода.
     */
    _roomCycle: ['bedroom', 'corridor', 'kitchen', 'bathroom'],

    /** Сколько комнат посетил игрок с начала игры (включая старт) */
    _roomsVisited: 0,

    /**
     * Первые 3 полных круга (= 12 посещённых комнат) — без аномалий.
     * Позволяет игроку освоиться с квартирой и понять её нормальный вид.
     */
    _graceRooms: 12,

    // ── Инициализация ────────────────────────────────────────────────────────

    init() {
      this._raycaster = new THREE.Raycaster();
      console.log('[AnomalyManager] Инициализирован. База аномалий:', AnomalyDatabase.length);
    },

    // ── Переход между комнатами ──────────────────────────────────────────────

    /**
     * Вызывается из main.js при переходе игрока в другую комнату.
     * @param {string} newRoomId
     */
    onRoomTransition(newRoomId) {
      const prevRoomId = this.currentRoomId;
      this.currentRoomId = newRoomId;
      this._roomsVisited++;

      const circlesDone = Math.floor(this._roomsVisited / 4);
      console.log(
        `[AnomalyManager] Переход: ${prevRoomId} → ${newRoomId} | ` +
        `Посещено: ${this._roomsVisited} | Кругов: ${circlesDone}`
      );

      // Штраф за необнаруженные аномалии при переходе
      if (this.activeAnomalies.size >= this._getTriggerThreshold()) {
        this._increaseParanoia(10, 'Слишком много непойманных аномалий при переходе');
      }

      // ── Секретная концовка «Зеркало»: ровно за 1 исправление до победы ──
      // Принудительно активируем портал вместо обычного случайного спавна.
      // Работает один раз за игру (флаг _mirrorPortalTriggered).
      if (
        this.fixedAnomaliesCount === this._winThreshold - 1 &&
        !this._mirrorPortalTriggered &&
        !this.activeAnomalies.has('bedroom_mirror_portal')
      ) {
        const portalAnomaly = AnomalyDatabase.find((a) => a.id === 'bedroom_mirror_portal');
        if (portalAnomaly) {
          this._mirrorPortalTriggered = true;
          this._activateAnomaly(portalAnomaly);
          console.log('[AnomalyManager] 🪞 Секретный портал зеркала активирован (34/35)');
        }
        return; // не спавним в этот переход ничего другого
      }

      // ── Первые 3 круга — без аномалий ──────────────────────────────
      if (this._roomsVisited <= this._graceRooms) {
        console.log(
          `[AnomalyManager] Льготный период: ещё ${this._graceRooms - this._roomsVisited} комнат без аномалий`
        );
        return;
      }

      // ── Вероятностный пропуск спавна ───────────────────────────────
      if (Math.random() > this._getSpawnChance()) return;

      // ── Определяем целевую комнату: 2 шага вперёд по маршруту ──────
      const cycleLen = this._roomCycle.length;
      const currentIdx = this._roomCycle.indexOf(newRoomId);
      const targetIdx  = (currentIdx + 2) % cycleLen;
      const targetRoomId = this._roomCycle[targetIdx];

      // Кандидаты: аномалии именно в целевой комнате, ещё не активные.
      // special:true (например mirrorPortal) исключаются — они активируются
      // только вручную, по достижении fixedAnomaliesCount === 34.
      const candidates = AnomalyDatabase.filter(
        (a) => a.roomId === targetRoomId && !a.special && !this.activeAnomalies.has(a.id)
      );

      if (candidates.length === 0) {
        // Целевая комната исчерпана — берём любую другую кроме текущей
        const fallback = AnomalyDatabase.filter(
          (a) => a.roomId !== newRoomId && !a.special && !this.activeAnomalies.has(a.id)
        );
        if (fallback.length === 0) return;
        this._activateAnomaly(fallback[Math.floor(Math.random() * fallback.length)]);
        return;
      }

      this._activateAnomaly(candidates[Math.floor(Math.random() * candidates.length)]);
    },

    // ── Активация аномалии ───────────────────────────────────────────────────

    /**
     * Применяет аномалию к сцене и регистрирует её как активную.
     * @param {object} anomaly  — запись из AnomalyDatabase
     */
    _activateAnomaly(anomaly) {
      const obj = findSceneObject(anomaly.targetId);

      if (!obj) {
        console.warn(`[AnomalyManager] Объект не найден: ${anomaly.targetId}`);
        return;
      }

      const originalState = snapshotState(obj, anomaly.type);
      applyAnomalyToObject(obj, anomaly);

      this.activeAnomalies.set(anomaly.id, {
        anomaly,
        sceneObject: obj,
        originalState,
        appliedAt: Date.now(),
      });

      console.log(
        `[AnomalyManager] ⚠ Аномалия активирована [${anomaly.id}] в комнате "${anomaly.roomId}": ${anomaly.description}`,
      );
    },

    // ── Фиксация аномалии (кнопка «Осознание») ───────────────────────────────

    /**
     * Вызывается из ui.js при успешном удержании кнопки «Осознание».
     * Пускает луч из центра камеры; если он попадает в аномальный объект —
     * фиксирует его и восстанавливает сцену.
     */
    fixAnomaly() {
      if (!window.camera || !window.scene) {
        console.error('[AnomalyManager] fixAnomaly: камера или сцена недоступны');
        return;
      }

      // ╔══════════════════════════════════════════════════════════════════╗
      // ║ CHEAT_PAINTING_BOOST — начало (безопасно удаляемый блок)          ║
      // ║ Если игрок удерживает «Осознание», смотря на картину в спальне    ║
      // ║ (id: bedroom_painting), засчитывается +10 к прогрессу победы.     ║
      // ║ Никак не трогает activeAnomalies/паранойю — чисто чит-триггер.    ║
      // ║ Чтобы вырезать: удалить весь блок между этими маркерами целиком.  ║
      // ╚══════════════════════════════════════════════════════════════════╝
      if (this._raycaster && window.scene) {
        const cheatNDC = new THREE.Vector2(0, 0);
        this._raycaster.setFromCamera(cheatNDC, window.camera);
        this._raycaster.far = 5;

        const paintingObj = findSceneObject('bedroom_painting');
        if (paintingObj) {
          const paintingMeshes = [];
          paintingObj.traverse((child) => { if (child.isMesh) paintingMeshes.push(child); });

          const cheatHits = this._raycaster.intersectObjects(paintingMeshes, false);
          if (cheatHits.length > 0) {
            const before = this.fixedAnomaliesCount;
            // BUGFIX: клампим до (_winThreshold - 1), а не до _winThreshold.
            // Иначе чит перепрыгивает счётчик мимо 34 и портал-зеркало
            // (условие fixedAnomaliesCount === _winThreshold - 1 в
            // onRoomTransition) никогда не активируется — секретная
            // концовка полностью пропускается, игра сразу «выигрывается».
            const cap = this._winThreshold - 1;
            this.fixedAnomaliesCount = Math.min(cap, this.fixedAnomaliesCount + 10);
            const gained = this.fixedAnomaliesCount - before;

            console.log(`[AnomalyManager] 🖼️ CHEAT: картина в спальне засчитала +${gained} → ${this.fixedAnomaliesCount}/${this._winThreshold}`);

            if (window.UIManager && typeof window.UIManager.onAnomalyFixed === 'function') {
              window.UIManager.onAnomalyFixed('cheat_painting_boost', this.paranoiaLevel, this.fixedAnomaliesCount);
            }

            // Чит НЕ вызывает _triggerWin() напрямую — победа (или секретный
            // портал на 34) всегда проходит через обычный игровой флоу
            // (onRoomTransition/fixAnomaly), чтобы не ломать концовку.
            return;
          }
        }
      }
      // ╔══════════════════════════════════════════════════════════════════╗
      // ║ CHEAT_PAINTING_BOOST — конец                                     ║
      // ╚══════════════════════════════════════════════════════════════════╝

      if (this.activeAnomalies.size === 0) {
        // Нажатие впустую
        this._increaseParanoia(5, 'Кнопка «Осознание» нажата без активных аномалий');
        return;
      }

      // Луч из центра экрана (NDC 0,0) — туда смотрит камера
      const centerNDC = new THREE.Vector2(0, 0);
      this._raycaster.setFromCamera(centerNDC, window.camera);
      this._raycaster.far = 12; // увеличен радиус — свет виден издалека

      // ── Сначала проверяем световые аномалии (PointLight не пересекается лучом)
      // Для них проверяем: игрок смотрит в сторону люстры (угол < 25°) И
      // находится в той же комнате (или рядом)
      let lightAnomalyId = null;
      const camDir = new THREE.Vector3();
      window.camera.getWorldDirection(camDir);

      for (const [id, record] of this.activeAnomalies) {
        if (record.anomaly.type !== 'lightColor') continue;
        const lightObj = record.sceneObject;
        if (!lightObj.isLight) continue;

        const toLight = new THREE.Vector3().subVectors(lightObj.position, window.camera.position);
        const dist = toLight.length();
        if (dist > 12) continue; // слишком далеко

        toLight.normalize();
        const dot = camDir.dot(toLight);
        // dot > cos(35°) ≈ 0.82 — игрок смотрит достаточно близко к свету
        if (dot > 0.72) {
          lightAnomalyId = id;
          break;
        }
      }

      if (lightAnomalyId) {
        const record = this.activeAnomalies.get(lightAnomalyId);
        restoreObject(record.sceneObject, record.originalState);
        this.activeAnomalies.delete(lightAnomalyId);
        record.sceneObject.traverse((child) => { delete child.userData._anomalyId; });
        delete record.sceneObject.userData._anomalyId;
        this._decreaseParanoia(5);
        this.fixedAnomaliesCount++;
        console.log(`[AnomalyManager] ✅ Световая аномалия зафиксирована [${lightAnomalyId}]: "${record.anomaly.description}" | Исправлено: ${this.fixedAnomaliesCount}/${this._winThreshold}`);
        if (window.UIManager && typeof window.UIManager.onAnomalyFixed === 'function') {
          window.UIManager.onAnomalyFixed(lightAnomalyId, this.paranoiaLevel, this.fixedAnomaliesCount);
        }
        if (this.fixedAnomaliesCount >= this._winThreshold) {
          this._triggerWin();
        }
        return;
      }

      // ── Обычные аномалии (меши) — через Raycaster ──────────────────────────
      // Собираем все аномальные объекты (только меши)
      const anomalyObjects = [];
      for (const [, record] of this.activeAnomalies) {
        if (record.anomaly.type === 'lightColor') continue;
        const obj = record.sceneObject;
        // traverse() обходит obj и всех потомков — нет нужды добавлять obj отдельно
        obj.traverse((child) => {
          if (child.isMesh) {
            child.userData._anomalyId = record.anomaly.id;
            anomalyObjects.push(child);
          }
        });
      }

      // Если активны только световые аномалии и до сюда дошли — смотрит мимо
      if (anomalyObjects.length === 0) {
        this._increaseParanoia(3, 'Игрок нажал «Осознание», но смотрит не на аномалию');
        return;
      }

      const intersects = this._raycaster.intersectObjects(anomalyObjects, false);

      if (intersects.length === 0) {
        // Игрок смотрит мимо
        this._increaseParanoia(3, 'Игрок нажал «Осознание», но смотрит не на аномалию');
        return;
      }

      // Берём ближайшее пересечение
      const hit = intersects[0].object;
      const anomalyId = hit.userData._anomalyId;

      if (!anomalyId || !this.activeAnomalies.has(anomalyId)) {
        console.warn('[AnomalyManager] Пересечение найдено, но аномалия уже неактивна');
        return;
      }

      const record = this.activeAnomalies.get(anomalyId);

      // ── Секретная концовка «Зеркало»: особая ветка ────────────────────────
      // Портал НЕ восстанавливается обычным restoreObject (зеркало должно
      // остаться в "открытом" зелёном состоянии, чтобы игрок мог физически
      // войти в него ногами). Сам вход в коридор (_triggerMirrorEnding)
      // триггерится позже, из main.js, в момент, когда игрок реально
      // доходит до плоскости зеркала — а не в момент фиксации кнопкой.
      if (record.anomaly.type === 'mirrorPortal') {
        this.activeAnomalies.delete(anomalyId);
        record.sceneObject.traverse((child) => { delete child.userData._anomalyId; });
        delete record.sceneObject.userData._anomalyId;

        this.fixedAnomaliesCount++;
        console.log(
          `[AnomalyManager] 🪞 Портал-зеркало зафиксирован [${anomalyId}] | ` +
            `Исправлено: ${this.fixedAnomaliesCount}/${this._winThreshold} — портал открыт, ждём, пока игрок войдёт`,
        );

        if (window.UIManager && typeof window.UIManager.onAnomalyFixed === 'function') {
          window.UIManager.onAnomalyFixed(anomalyId, this.paranoiaLevel, this.fixedAnomaliesCount);
        }

        // Сообщаем main.js, что портал открыт и готов к физическому входу
        window._mirrorPortalReady = record.sceneObject;
        return;
      }

      // ── Успешная фиксация (обычная аномалия) ──────────────────────────────
      const record2 = record;
      restoreObject(record2.sceneObject, record2.originalState);
      this.activeAnomalies.delete(anomalyId);

      // Чистим временную метку
      record2.sceneObject.traverse((child) => {
        delete child.userData._anomalyId;
      });
      delete record2.sceneObject.userData._anomalyId;

      // Небольшое снижение паранойи за успех
      this._decreaseParanoia(5);

      // Увеличиваем счётчик исправленных аномалий
      this.fixedAnomaliesCount++;
      console.log(
        `[AnomalyManager] ✅ Аномалия зафиксирована [${anomalyId}]: "${record2.anomaly.description}"` +
          ` | Паранойя: ${this.paranoiaLevel} | Исправлено: ${this.fixedAnomaliesCount}/${this._winThreshold}`,
      );

      // Уведомляем UI об успехе
      if (window.UIManager && typeof window.UIManager.onAnomalyFixed === 'function') {
        window.UIManager.onAnomalyFixed(anomalyId, this.paranoiaLevel, this.fixedAnomaliesCount);
      }

      // Проверяем условие победы
      if (this.fixedAnomaliesCount >= this._winThreshold) {
        this._triggerWin();
      }
    },

    // ── Управление паранойей ─────────────────────────────────────────────────

    /**
     * Увеличивает счётчик паранойи и логирует причину.
     * @param {number} amount
     * @param {string} reason
     */
    _increaseParanoia(amount, reason = '') {
      this.paranoiaLevel = Math.min(100, this.paranoiaLevel + amount);
      console.log(
        `[AnomalyManager] 📈 Паранойя +${amount} (${reason}) → ${this.paranoiaLevel}`,
      );

      if (window.UIManager && typeof window.UIManager.onParanoiaChanged === 'function') {
        window.UIManager.onParanoiaChanged(this.paranoiaLevel);
      }

      if (this.paranoiaLevel >= 100) {
        this._triggerGameOver();
      }
    },

    /**
     * Снижает счётчик паранойи (не ниже 0).
     * @param {number} amount
     */
    _decreaseParanoia(amount) {
      this.paranoiaLevel = Math.max(0, this.paranoiaLevel - amount);
      console.log(`[AnomalyManager] 📉 Паранойя -${amount} → ${this.paranoiaLevel}`);

      if (window.UIManager && typeof window.UIManager.onParanoiaChanged === 'function') {
        window.UIManager.onParanoiaChanged(this.paranoiaLevel);
      }
    },

    // ── Конец игры ────────────────────────────────────────────────────────────

    _triggerGameOver() {
      console.log('[AnomalyManager] 💀 Уровень паранойи достиг 100 — GAME OVER');

      if (window.UIManager && typeof window.UIManager.onGameOver === 'function') {
        window.UIManager.onGameOver();
      }
    },

    // ── Победа ───────────────────────────────────────────────────────────────

    _triggerWin() {
      console.log('[AnomalyManager] 🏆 Исправлено 35 аномалий — ПОБЕДА!');
      window.gamePaused = true;

      if (window.UIManager && typeof window.UIManager.onGameWin === 'function') {
        window.UIManager.onGameWin();
      }
    },

    // ── Утилиты для отладки ───────────────────────────────────────────────────

    /** Возвращает список активных аномалий в читаемом виде */
    debugActiveAnomalies() {
      if (this.activeAnomalies.size === 0) {
        console.log('[AnomalyManager] Нет активных аномалий');
        return;
      }
      console.group('[AnomalyManager] Активные аномалии:');
      for (const [id, record] of this.activeAnomalies) {
        console.log(
          `  [${id}] комната: ${record.anomaly.roomId} | ${record.anomaly.description}`,
        );
      }
      console.groupEnd();
    },

    /** Принудительно сбрасывает все аномалии (для отладки/перезапуска) */
    resetAll() {
      for (const [, record] of this.activeAnomalies) {
        restoreObject(record.sceneObject, record.originalState);
      }
      this.activeAnomalies.clear();
      this.paranoiaLevel = 0;
      this.fixedAnomaliesCount = 0;
      console.log('[AnomalyManager] 🔄 Все аномалии сброшены, паранойя обнулена');
    },
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // ЭКСПОРТ В ГЛОБАЛЬНОЕ ПРОСТРАНСТВО
  // ─────────────────────────────────────────────────────────────────────────────

  window.AnomalyManager = AnomalyManager;
  window.AnomalyDatabase = AnomalyDatabase; // полезно для инспекции из других модулей

})();
