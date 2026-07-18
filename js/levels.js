/**
 * False Memory — Level Config
 * Квартира из 4 комнат, соединённых дверями по кругу:
 * СПАЛЬНЯ -> КОРИДОР -> КУХНЯ -> ВАННАЯ -> СПАЛЬНЯ
 *
 * Топология — квадрат 2x2 (Three.js, Y — вверх):
 *   СПАЛЬНЯ (0,0)   ─── КОРИДОР (6,0)
 *      │                    │
 *   ВАННАЯ (0,6)   ─── КУХНЯ (6,6)
 *
 * Все четыре двери — физические проёмы в общих стенах соседних комнат
 * (видно насквозь), цикл замкнут честно, без телепортов.
 *
 * Все boundingBox даны в АБСОЛЮТНЫХ координатах сцены (minX/maxX/minZ/maxZ),
 * пригодны для прямой AABB-проверки коллизий игрока.
 *
 * Мебель: у простых предметов остаётся одиночный size {width,height,depth}.
 * У составных предметов (кровать, шкаф, стол и т.п.) добавлен массив parts —
 * список деталей { material, size, offset (от item.position), rotationY }.
 * main.js: если parts существует — собирается THREE.Group из этих деталей,
 * если нет — рисуется как раньше, один Box/Plane на item.size.
 * boundingBox у составных предметов — это габаритная коробка всего объекта
 * целиком (используется для коллизий игрока, не для рендера).
 *
 * Расстановка мебели спланирована так, чтобы:
 *   - крупные предметы стояли у глухих стен (не у дверных проёмов);
 *   - между мебелью и дверными проёмами всегда оставался свободный проход;
 *   - предметы не пересекались друг с другом по boundingBox.
 *
 * room.chandelier — точка крепления потолочного светильника (меш люстры
 * рисуется в main.js, цвет берётся из room.lightColor).
 *
 * room.textures.wall/floor/ceiling — имена текстур в assets/textures/.
 * Если файла нет на диске — main.js использует процедурный fallback-узор,
 * так что игра не ломается, даже если текстуры ещё не добавлены.
 */

window.LevelConfig = {

  rooms: [

    // ───────────────────────────── СПАЛЬНЯ (0,0) ─────────────────────────────
    {
      id: "bedroom",
      name: "СПАЛЬНЯ",
      width: 6,
      length: 6,
      height: 3,
      center: { x: 0, z: 0 },
      lightColor: 0xffe3b0,
      chandelier: { x: 0, z: 0 },
      // Настольные лампы на тумбочках — дополнительный тёплый свет
      tableLamps: [
        { x: -0.85, y: 0.92, z: -2.65 }, // лампа на левой тумбочке
        { x:  1.45, y: 0.92, z: -2.65 }, // лампа на правой тумбочке
        { x:  1.7,  y: 1.22, z:  1.5  }, // лампа на письменном столе
      ],
      textures: {
        wall: "wallpaper_bedroom",
        floor: "floor_parquet",
        ceiling: "ceiling_plaster"
      },

      // Общие стены: восточная (X=3) ведёт в коридор, южная (Z=3) ведёт в ванную.
      // Северная и западная — внешние глухие стены квартиры.
      walls: [
        { id: "bedroom_wall_north", boundingBox: { minX: -3, maxX: 3, minZ: -3.1, maxZ: -3 } },
        { id: "bedroom_wall_west",  boundingBox: { minX: -3.1, maxX: -3, minZ: -3, maxZ: 3 } },
        // Восточная стена — проём в коридор (см. doors.bedroom_to_corridor)
        { id: "bedroom_wall_east_a", boundingBox: { minX: 2.9, maxX: 3.1, minZ: -3, maxZ: -0.5 } },
        { id: "bedroom_wall_east_b", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 0.5, maxZ: 3 } },
        // Южная стена — проём в ванную (см. doors.bathroom_to_bedroom)
        { id: "bedroom_wall_south_a", boundingBox: { minX: -3, maxX: -0.5, minZ: 2.9, maxZ: 3.1 } },
        { id: "bedroom_wall_south_b", boundingBox: { minX: 0.5, maxX: 3, minZ: 2.9, maxZ: 3.1 } }
      ],

      // ── Планировка: кровать строго по центру северной (глухой) стены,
      //    тумбочки симметрично по бокам, шкаф в свободном северо-западном
      //    углу. Восточный и южный проходы (к дверям) остаются полностью
      //    свободными. ──────────────────────────────────────────────────
      furniture: [
        // ── Двуспальная кровать: матрас + изголовье, изголовьем к северной стене ──
        {
          id: "bed",
          mesh: "Box",
          size: { width: 1.8, height: 0.55, depth: 2.1 },
          position: { x: 0.3, y: 0.0, z: -1.85 },
          rotationY: 0,
          texture: "wallpaper_bedroom",
          boundingBox: { minX: -0.6, maxX: 1.2, minZ: -2.9, maxZ: -0.8 },
          parts: [
            { material: "fabric", size: { width: 1.8, height: 0.35, depth: 2.1 }, offset: { x: 0, y: 0.175, z: 0 } },
            { material: "wood",   size: { width: 1.9, height: 0.18, depth: 2.2 }, offset: { x: 0, y: 0.09,  z: 0 } },
            { material: "wood",   size: { width: 1.9, height: 0.9,  depth: 0.1 }, offset: { x: 0, y: 0.45,  z: -1.05 } },
            // Подушки
            { material: "fabric", size: { width: 0.55, height: 0.12, depth: 0.45 }, offset: { x: -0.45, y: 0.42, z: -0.82 } },
            { material: "fabric", size: { width: 0.55, height: 0.12, depth: 0.45 }, offset: { x:  0.45, y: 0.42, z: -0.82 } }
          ]
        },
        // ── Прикроватная тумбочка слева ──────────────────────────────────────
        {
          id: "nightstand_left",
          mesh: "Box",
          size: { width: 0.45, height: 0.5, depth: 0.4 },
          position: { x: -0.85, y: 0.0, z: -2.65 },
          rotationY: 0,
          boundingBox: { minX: -1.08, maxX: -0.63, minZ: -2.85, maxZ: -2.45 },
          parts: [
            { material: "wood",  size: { width: 0.45, height: 0.5,  depth: 0.4  }, offset: { x: 0,    y: 0.25, z: 0    } },
            { material: "metal", size: { width: 0.08, height: 0.06, depth: 0.06 }, offset: { x: 0,    y: 0.51, z: 0.16 } },
            // Маленькая настольная лампа на тумбочке
            { material: "metal", size: { width: 0.05, height: 0.28, depth: 0.05 }, offset: { x: -0.1, y: 0.64, z: 0    } }, // стойка лампы
            { material: "wood",  size: { width: 0.18, height: 0.04, depth: 0.18 }, offset: { x: -0.1, y: 0.5,  z: 0    } }, // основание
            { material: "fabric",size: { width: 0.16, height: 0.14, depth: 0.16 }, offset: { x: -0.1, y: 0.82, z: 0    } }  // абажур
          ]
        },
        // ── Прикроватная тумбочка справа ─────────────────────────────────────
        {
          id: "nightstand_right",
          mesh: "Box",
          size: { width: 0.45, height: 0.5, depth: 0.4 },
          position: { x: 1.45, y: 0.0, z: -2.65 },
          rotationY: 0,
          boundingBox: { minX: 1.23, maxX: 1.68, minZ: -2.85, maxZ: -2.45 },
          parts: [
            { material: "wood",  size: { width: 0.45, height: 0.5,  depth: 0.4  }, offset: { x: 0,   y: 0.25, z: 0    } },
            { material: "metal", size: { width: 0.08, height: 0.06, depth: 0.06 }, offset: { x: 0,   y: 0.51, z: 0.16 } },
            // Стакан воды (декор)
            { material: "mirror",size: { width: 0.07, height: 0.12, depth: 0.07 }, offset: { x: 0.1, y: 0.56, z: 0    } }
          ]
        },
        // ── Большой платяной шкаф — ВПЛОТНУЮ к западной стене ────────────────
        // Западная стена: x = -3. Шкаф depth=0.6 → центр x = -3 + 0.3 = -2.7
        // Шкаф width=1.6 → занимает x от -3.5 до -1.9 (но стена на -3, поэтому
        // эффективно от -3 до -1.9). Позиция z: в северо-западном углу, z = -2.4
        {
          id: "wardrobe",
          mesh: "Box",
          size: { width: 1.6, height: 2.2, depth: 0.6 },
          position: { x: -2.2, y: 0.0, z: -2.4 },
          rotationY: 0,
          boundingBox: { minX: -3.0, maxX: -1.4, minZ: -2.7, maxZ: -2.1 },
          parts: [
            { material: "wood",  size: { width: 1.6, height: 2.2,  depth: 0.6  }, offset: { x: 0,     y: 1.1, z: 0    } },
            // Разделительная щель
            { material: "metal", size: { width: 0.02, height: 2.0, depth: 0.02 }, offset: { x: 0,     y: 1.1, z: 0.31 } },
            // Две ручки
            { material: "metal", size: { width: 0.04, height: 0.18, depth: 0.04 }, offset: { x: -0.15, y: 1.1, z: 0.32 } },
            { material: "metal", size: { width: 0.04, height: 0.18, depth: 0.04 }, offset: { x:  0.15, y: 1.1, z: 0.32 } },
            // Плинтус под шкафом
            { material: "metal", size: { width: 1.6, height: 0.06, depth: 0.58 }, offset: { x: 0,     y: 0.03, z: 0   } }
          ]
        },
        // ── Письменный стол у восточной стены (не мешает проходу в коридор) ──
        // Дверной проём: z ∈ [-0.5, 0.5]. Стол ставим на z ∈ [1.0, 2.0]
        {
          id: "desk",
          mesh: "Box",
          size: { width: 1.2, height: 0.75, depth: 0.55 },
          position: { x: 2.4, y: 0.0, z: 1.5 },
          rotationY: -Math.PI / 2,
          boundingBox: { minX: 1.85, maxX: 2.95, minZ: 0.9, maxZ: 2.1 },
          parts: [
            { material: "wood", size: { width: 1.2,  height: 0.04, depth: 0.55  }, offset: { x: 0,      y: 0.73, z: 0     } }, // столешница
            { material: "wood", size: { width: 0.04, height: 0.73, depth: 0.55  }, offset: { x: -0.58,  y: 0.365,z: 0     } }, // левая опора
            { material: "wood", size: { width: 0.04, height: 0.73, depth: 0.55  }, offset: { x:  0.58,  y: 0.365,z: 0     } }, // правая опора
            { material: "wood", size: { width: 1.2,  height: 0.04, depth: 0.55  }, offset: { x: 0,      y: 0.0,  z: 0     } }, // нижняя полка
            // Настольная лампа
            { material: "metal", size: { width: 0.04, height: 0.35, depth: 0.04 }, offset: { x: -0.45,  y: 0.95, z: -0.12 } },
            { material: "fabric",size: { width: 0.2,  height: 0.18, depth: 0.2  }, offset: { x: -0.45,  y: 1.22, z: -0.12 } },
            // Стопка книг
            { material: "wood",  size: { width: 0.22, height: 0.06, depth: 0.16 }, offset: { x:  0.3,   y: 0.77, z: -0.1  } },
            { material: "fabric",size: { width: 0.22, height: 0.06, depth: 0.16 }, offset: { x:  0.3,   y: 0.83, z: -0.1  } },
            { material: "metal", size: { width: 0.22, height: 0.06, depth: 0.16 }, offset: { x:  0.3,   y: 0.89, z: -0.1  } }
          ]
        },
        // ── Стул у письменного стола ──────────────────────────────────────────
        {
          id: "desk_chair",
          mesh: "Box",
          size: { width: 0.45, height: 0.9, depth: 0.45 },
          position: { x: 1.7, y: 0.0, z: 1.5 },
          rotationY: -Math.PI / 2,
          boundingBox: { minX: 1.45, maxX: 1.95, minZ: 1.25, maxZ: 1.75 },
          parts: [
            { material: "fabric", size: { width: 0.42, height: 0.06, depth: 0.42 }, offset: { x: 0, y: 0.45, z: 0    } },
            { material: "wood",   size: { width: 0.42, height: 0.52, depth: 0.06 }, offset: { x: 0, y: 0.71, z: 0.18 } },
            { material: "wood",   size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z: -0.17 } },
            { material: "wood",   size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x:  0.17, y: 0.225, z: -0.17 } },
            { material: "wood",   size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z:  0.17 } },
            { material: "wood",   size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x:  0.17, y: 0.225, z:  0.17 } }
          ]
        },
        // ── Зеркало на западной стене ─────────────────────────────────────────
        {
          id: "bedroom_mirror",
          mesh: "Plane",
          size: { width: 0.7, height: 1.4, depth: 0.02 },
          position: { x: -2.95, y: 1.1, z: 0.8 },
          rotationY: Math.PI / 2,
          material: "mirror",
          boundingBox: { minX: -2.97, maxX: -2.93, minZ: 0.45, maxZ: 1.15 }
        },
        // ── Маленький коврик у кровати (без boundingBox — по нему можно ходить) ─
        {
          id: "bedroom_rug",
          mesh: "Box",
          size: { width: 1.6, height: 0.02, depth: 1.0 },
          position: { x: 0.3, y: 0.005, z: 0.4 },
          rotationY: 0,
          parts: [
            { material: "fabric", size: { width: 1.6, height: 0.02, depth: 1.0 }, offset: { x: 0, y: 0.01, z: 0 } }
          ]
        },
        // ── Картина на восточной стене ────────────────────────────────────────
        //    Реализована как PhotoFrame: багет + вставленное фото/PNG.
        //    Геометрия подгоняется автоматически в main.js (_buildPhotoFrame)
        //    под реальные пропорции загруженного изображения из textureFile,
        //    пока изображение не добавлено — виден нейтральный плейсхолдер.
        //    Внутренняя поверхность стены — X=2.9 (см. bedroom_wall_east_a/b),
        //    поэтому центр рамки смещён на X=2.87: при глубине багета 0.04
        //    вся рамка (X от 2.85 до 2.89) целиком выступает в комнату,
        //    с небольшим зазором до стены — не наполовину и не полностью в ней.
        {
          id: "bedroom_painting",
          mesh: "PhotoFrame",
          size: { width: 0.8, height: 0.6, depth: 0.04 },
          position: { x: 2.87, y: 1.7, z: -1.5 },
          rotationY: -Math.PI / 2,
          textureFile: "assets/textures/bedroom_painting.png",
          boundingBox: { minX: 2.83, maxX: 2.92, minZ: -1.9, maxZ: -1.1 }
        },
        // ── Крупное растение в кадке — свободный юго-западный угол,
        //    между шкафом и дверным проёмом в ванную ───────────────────────
        {
          id: "bedroom_plant",
          mesh: "Box",
          size: { width: 0.4, height: 0.9, depth: 0.4 },
          position: { x: -2.35, y: 0.0, z: 2.35 },
          rotationY: 0,
          boundingBox: { minX: -2.55, maxX: -2.15, minZ: 2.15, maxZ: 2.55 },
          parts: [
            { material: "plantPot", size: { width: 0.36, height: 0.35, depth: 0.36 }, offset: { x: 0, y: 0.175, z: 0 } },
            { material: "plant", size: { width: 0.05, height: 0.55, depth: 0.05 }, offset: { x: 0,     y: 0.62, z: 0     } },
            { material: "plant", size: { width: 0.32, height: 0.16, depth: 0.06 }, offset: { x: -0.12, y: 0.78, z: 0.05  }, rotationY: 0.6 },
            { material: "plant", size: { width: 0.32, height: 0.16, depth: 0.06 }, offset: { x: 0.13,  y: 0.85, z: -0.08 }, rotationY: -0.5 },
            { material: "plant", size: { width: 0.3,  height: 0.15, depth: 0.06 }, offset: { x: 0.02,  y: 0.95, z: 0.12  }, rotationY: 1.4 },
            { material: "plant", size: { width: 0.28, height: 0.14, depth: 0.05 }, offset: { x: -0.15, y: 0.68, z: -0.1  }, rotationY: -1.1 }
          ]
        },
        // ── Стопка книг на левой тумбочке возле кровати (мелкий уют) ────
        {
          id: "bedroom_book_stack",
          mesh: "Box",
          size: { width: 0.28, height: 0.2, depth: 0.2 },
          position: { x: -0.85, y: 0.0, z: -2.65 },
          rotationY: 0.15,
          parts: [
            { material: "paper", size: { width: 0.24, height: 0.04, depth: 0.17 }, offset: { x: 0.1, y: 0.53, z: 0.06 } },
            { material: "wood",  size: { width: 0.22, height: 0.04, depth: 0.16 }, offset: { x: 0.11, y: 0.57, z: 0.06 }, rotationY: 0.2 },
            { material: "plant", size: { width: 0.2,  height: 0.04, depth: 0.15 }, offset: { x: 0.09, y: 0.61, z: 0.06 }, rotationY: -0.15 }
          ]
        }
      ]
    },

    // ───────────────────────────── КОРИДОР (6,0) ─────────────────────────────
    {
      id: "corridor",
      name: "КОРИДОР",
      width: 6,
      length: 6,
      height: 3,
      center: { x: 6, z: 0 },
      lightColor: 0xe8e2d6, // мягкий тёплый нейтральный
      chandelier: { x: 6, z: 0 },
      tableLamps: [
        { x: 8.0, y: 0.92, z: 0.0 }, // лампа на телефонном столике
      ],
      textures: {
        wall: "wallpaper_hallway",
        floor: "floor_parquet",
        ceiling: "ceiling_plaster"
      },

      // Общие стены: западная (X=3) ведёт в спальню, южная (Z=3) ведёт на кухню.
      // Северная и восточная — внешние глухие стены квартиры.
      walls: [
        { id: "corridor_wall_north", boundingBox: { minX: 3, maxX: 9, minZ: -3.1, maxZ: -3 } },
        { id: "corridor_wall_east",  boundingBox: { minX: 9, maxX: 9.1, minZ: -3, maxZ: 3 } },
        // Западная стена — проём в спальню (см. doors.bedroom_to_corridor)
        { id: "corridor_wall_west_a", boundingBox: { minX: 2.9, maxX: 3.1, minZ: -3, maxZ: -0.5 } },
        { id: "corridor_wall_west_b", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 0.5, maxZ: 3 } },
        // Южная стена — проём на кухню (см. doors.corridor_to_kitchen)
        { id: "corridor_wall_south_a", boundingBox: { minX: 3, maxX: 5.5, minZ: 2.9, maxZ: 3.1 } },
        { id: "corridor_wall_south_b", boundingBox: { minX: 6.5, maxX: 9, minZ: 2.9, maxZ: 3.1 } }
      ],

      // ── Планировка: проходная комната с двумя проёмами (запад и юг).
      //    Вся мебель прижата к северной (глухой) и восточной (глухой)
      //    стенам, центральный проход между дверьми остаётся свободным. ──
      furniture: [
        // ── Вешалка для одежды у северной стены, рядом с углом ────────────
        {
          id: "coat_rack",
          mesh: "Box",
          size: { width: 0.5, height: 1.8, depth: 0.5 },
          position: { x: 4.0, y: 0.0, z: -2.6 },
          rotationY: 0,
          texture: "floor_parquet",
          boundingBox: { minX: 3.75, maxX: 4.25, minZ: -2.85, maxZ: -2.35 },
          parts: [
            { material: "wood",  size: { width: 0.08, height: 1.8, depth: 0.08 }, offset: { x: 0, y: 0.9, z: 0 } }, // стойка
            { material: "wood",  size: { width: 0.4, height: 0.04, depth: 0.4 }, offset: { x: 0, y: 0.04, z: 0 } }, // подставка
            { material: "metal", size: { width: 0.35, height: 0.04, depth: 0.04 }, offset: { x: 0, y: 1.55, z: 0.1 } } // крючки-перекладина
          ]
        },
        // ── Обувная полка рядом с вешалкой ─────────────────────────────
        {
          id: "shoe_shelf",
          mesh: "Box",
          size: { width: 0.9, height: 0.45, depth: 0.35 },
          position: { x: 5.0, y: 0.0, z: -2.75 },
          rotationY: 0,
          texture: "floor_parquet",
          boundingBox: { minX: 4.53, maxX: 5.47, minZ: -2.93, maxZ: -2.58 },
          parts: [
            { material: "wood", size: { width: 0.9, height: 0.04, depth: 0.35 }, offset: { x: 0, y: 0.4, z: 0 } },  // верхняя полка
            { material: "wood", size: { width: 0.9, height: 0.04, depth: 0.35 }, offset: { x: 0, y: 0.2, z: 0 } },  // средняя полка
            { material: "wood", size: { width: 0.9, height: 0.04, depth: 0.35 }, offset: { x: 0, y: 0.0, z: 0 } }   // нижняя полка
          ]
        },
        // ── Комод вдоль восточной (глухой) стены ──────────────────────────
        {
          id: "dresser",
          mesh: "Box",
          size: { width: 1.1, height: 0.9, depth: 0.4 },
          position: { x: 8.7, y: 0.0, z: 1.2 },
          rotationY: -Math.PI / 2,
          texture: "floor_parquet",
          boundingBox: { minX: 8.5, maxX: 8.9, minZ: 0.65, maxZ: 1.75 },
          parts: [
            { material: "wood",  size: { width: 1.1, height: 0.9, depth: 0.4 }, offset: { x: 0, y: 0.45, z: 0 } },
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: -0.3, y: 0.5, z: 0.21 } },
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: 0.0,  y: 0.5, z: 0.21 } },
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: 0.3,  y: 0.5, z: 0.21 } }
          ]
        },
        // ── Зеркало на стене над комодом ───────────────────────────────
        {
          id: "hallway_mirror",
          mesh: "Plane",
          size: { width: 0.6, height: 1.0, depth: 0.02 },
          position: { x: 8.95, y: 1.5, z: 0.0 },
          rotationY: -Math.PI / 2,
          material: "mirror",
          boundingBox: { minX: 8.93, maxX: 8.97, minZ: -0.3, maxZ: 0.3 }
        },
        // ── Телефонный столик (антик) у северной стены ──────────────────────
        {
          id: "phone_table",
          mesh: "Box",
          size: { width: 0.35, height: 0.75, depth: 0.35 },
          position: { x: 8.0, y: 0.0, z: -2.75 },
          rotationY: Math.PI,
          boundingBox: { minX: 7.83, maxX: 8.18, minZ: -2.93, maxZ: -2.58 },
          parts: [
            { material: "wood", size: { width: 0.35, height: 0.04, depth: 0.35 }, offset: { x: 0, y: 0.72, z: 0 } },
            { material: "wood", size: { width: 0.04, height: 0.72, depth: 0.04 }, offset: { x: -0.15, y: 0.36, z: -0.15 } },
            { material: "wood", size: { width: 0.04, height: 0.72, depth: 0.04 }, offset: { x:  0.15, y: 0.36, z: -0.15 } },
            { material: "wood", size: { width: 0.04, height: 0.72, depth: 0.04 }, offset: { x: -0.15, y: 0.36, z:  0.15 } },
            { material: "wood", size: { width: 0.04, height: 0.72, depth: 0.04 }, offset: { x:  0.15, y: 0.36, z:  0.15 } },
            // Декоративный горшок с цветком
            { material: "metal",  size: { width: 0.14, height: 0.12, depth: 0.14 }, offset: { x: 0, y: 0.82, z: 0 } },
            { material: "fabric", size: { width: 0.06, height: 0.18, depth: 0.06 }, offset: { x: 0, y: 0.99, z: 0 } }
          ]
        },
        // ── Зонтница у западной стены (рядом с дверью) ──────────────────────
        {
          id: "umbrella_stand",
          mesh: "Box",
          size: { width: 0.2, height: 0.55, depth: 0.2 },
          position: { x: 3.2, y: 0.0, z: 2.6 },
          rotationY: 0,
          boundingBox: { minX: 3.1, maxX: 3.3, minZ: 2.5, maxZ: 2.7 },
          parts: [
            { material: "metal", size: { width: 0.2, height: 0.55, depth: 0.2 }, offset: { x: 0, y: 0.275, z: 0 } },
            // Зонт внутри
            { material: "fabric", size: { width: 0.04, height: 0.5, depth: 0.04 }, offset: { x: 0.05, y: 0.55, z: 0 } }
          ]
        },
        // ── Высокое растение у восточной стены, между комодом и углом ──────
        {
          id: "corridor_plant",
          mesh: "Box",
          size: { width: 0.4, height: 1.1, depth: 0.4 },
          position: { x: 8.6, y: 0.0, z: -0.9 },
          rotationY: 0,
          boundingBox: { minX: 8.4, maxX: 8.8, minZ: -1.1, maxZ: -0.7 },
          parts: [
            { material: "plantPot", size: { width: 0.34, height: 0.4, depth: 0.34 }, offset: { x: 0, y: 0.2, z: 0 } },
            { material: "plant", size: { width: 0.05, height: 0.7, depth: 0.05 }, offset: { x: 0,     y: 0.75, z: 0     } },
            { material: "plant", size: { width: 0.05, height: 0.5, depth: 0.05 }, offset: { x: 0.08,  y: 0.6,  z: 0.05  }, rotationY: 0.4 },
            { material: "plant", size: { width: 0.3,  height: 0.14, depth: 0.05 }, offset: { x: -0.1,  y: 1.05, z: 0     }, rotationY: 0.7 },
            { material: "plant", size: { width: 0.3,  height: 0.14, depth: 0.05 }, offset: { x: 0.12,  y: 1.15, z: -0.08 }, rotationY: -0.6 },
            { material: "plant", size: { width: 0.26, height: 0.13, depth: 0.05 }, offset: { x: 0.02,  y: 0.9,  z: 0.15  }, rotationY: 1.3 }
          ]
        },
        // ── Фоторамки для пользовательских PNG — портретная ориентация.
        //    Геометрия рамки подгоняется автоматически в main.js под
        //    реальные пропорции загруженного изображения (см. createPhotoFrame),
        //    значения size здесь — лишь стартовый/запасной размер. ─────────
        {
          id: "family_photo_frame_1",
          mesh: "PhotoFrame",
          size: { width: 0.55, height: 0.8, depth: 0.04 },
          position: { x: 4.4, y: 1.6, z: -2.95 },
          rotationY: Math.PI,
          textureFile: "assets/textures/photo_1.png",
          boundingBox: { minX: 4.1, maxX: 4.7, minZ: -3.0, maxZ: -2.9 }
        },
        {
          id: "family_photo_frame_2",
          mesh: "PhotoFrame",
          size: { width: 0.55, height: 0.8, depth: 0.04 },
          position: { x: 5.3, y: 1.6, z: -2.95 },
          rotationY: Math.PI,
          textureFile: "assets/textures/photo_2.png",
          boundingBox: { minX: 5.0, maxX: 5.6, minZ: -3.0, maxZ: -2.9 }
        },
        {
          id: "family_photo_frame_3",
          mesh: "PhotoFrame",
          size: { width: 0.55, height: 0.8, depth: 0.04 },
          position: { x: 6.7, y: 1.6, z: -2.95 },
          rotationY: Math.PI,
          textureFile: "assets/textures/photo_3.png",
          boundingBox: { minX: 6.4, maxX: 7.0, minZ: -3.0, maxZ: -2.9 }
        },
        {
          id: "family_photo_frame_4",
          mesh: "PhotoFrame",
          size: { width: 0.55, height: 0.8, depth: 0.04 },
          position: { x: 7.6, y: 1.6, z: -2.95 },
          rotationY: Math.PI,
          textureFile: "assets/textures/photo_4.png",
          boundingBox: { minX: 7.3, maxX: 7.9, minZ: -3.0, maxZ: -2.9 }
        }
      ]
    },

    // ───────────────────────────── КУХНЯ (6,6) ─────────────────────────────
    {
      id: "kitchen",
      name: "КУХНЯ",
      width: 6,
      length: 6,
      height: 3,
      center: { x: 6, z: 6 },
      lightColor: 0xfff1cf, // мягкий тёплый дневной свет
      chandelier: { x: 6, z: 6 },
      tableLamps: [
      ],
      textures: {
        wall: "tiles_kitchen",
        floor: "floor_tiles_kitchen",
        ceiling: "ceiling_plaster"
      },

      // Общие стены: северная (Z=3) ведёт в коридор, западная (X=3) ведёт в ванную.
      // Южная и восточная — внешние глухие стены квартиры.
      walls: [
        { id: "kitchen_wall_east",  boundingBox: { minX: 9, maxX: 9.1, minZ: 3, maxZ: 9 } },
        { id: "kitchen_wall_south", boundingBox: { minX: 3, maxX: 9, minZ: 8.9, maxZ: 9 } },
        // Северная стена — проём в коридор (см. doors.corridor_to_kitchen)
        { id: "kitchen_wall_north_a", boundingBox: { minX: 3, maxX: 5.5, minZ: 2.9, maxZ: 3.1 } },
        { id: "kitchen_wall_north_b", boundingBox: { minX: 6.5, maxX: 9, minZ: 2.9, maxZ: 3.1 } },
        // Западная стена — проём в ванную (см. doors.kitchen_to_bathroom)
        { id: "kitchen_wall_west_a", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 3, maxZ: 5.5 } },
        { id: "kitchen_wall_west_b", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 6.5, maxZ: 9 } }
      ],

      // ── Планировка: гарнитур и холодильник у южной (глухой) стены,
      //    обеденная зона смещена в свободный восточный угол — не на
      //    линии между северным и западным проёмами. ─────────────────────
      furniture: [
        // ── Кухонный гарнитур: длинная тумба вдоль южной стены ────────────
        {
          id: "kitchen_counter",
          mesh: "Box",
          size: { width: 3.0, height: 0.9, depth: 0.6 },
          position: { x: 4.8, y: 0.0, z: 8.55 },
          rotationY: Math.PI,
          texture: "floor_tiles_kitchen",
          boundingBox: { minX: 3.3, maxX: 6.3, minZ: 8.25, maxZ: 8.85 },
          parts: [
            { material: "wood",  size: { width: 3.0, height: 0.85, depth: 0.6 }, offset: { x: 0, y: 0.425, z: 0 } },
            { material: "metal", size: { width: 3.0, height: 0.04, depth: 0.62 }, offset: { x: 0, y: 0.87, z: 0 } }, // столешница
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: -1.0, y: 0.5, z: 0.3 } },
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: 0.0,  y: 0.5, z: 0.3 } },
            { material: "metal", size: { width: 0.06, height: 0.06, depth: 0.06 }, offset: { x: 1.0,  y: 0.5, z: 0.3 } }
          ]
        },
        // ── Навесной кухонный шкаф над гарнитуром ────────────────────────────
        // Южная стена z=9. depth=0.32, rotationY=PI → задняя грань на z=9
        // Центр z = 9 - 0.16 = 8.84 → передняя грань на z = 8.52
        {
          id: "kitchen_wall_cabinet",
          mesh: "Box",
          size: { width: 2.6, height: 0.7, depth: 0.32 },
          position: { x: 4.8, y: 1.6, z: 8.68 },
          rotationY: Math.PI,
          boundingBox: { minX: 3.5, maxX: 6.1, minZ: 8.52, maxZ: 8.84 },
          parts: [
            // Корпус шкафа
            { material: "wood", size: { width: 2.6, height: 0.7,  depth: 0.32 }, offset: { x: 0,    y: 0.35,  z: 0     } },
            // Стык двух дверей по центру
            { material: "metal",size: { width: 0.02, height: 0.66, depth: 0.02 }, offset: { x: 0,    y: 0.35,  z: 0.162 } },
            // Ручки
            { material: "metal",size: { width: 0.04, height: 0.12, depth: 0.04 }, offset: { x:-0.25, y: 0.35,  z: 0.17  } },
            { material: "metal",size: { width: 0.04, height: 0.12, depth: 0.04 }, offset: { x: 0.25, y: 0.35,  z: 0.17  } },
            // Нижняя окантовка
            { material: "metal",size: { width: 2.6,  height: 0.02, depth: 0.32 }, offset: { x: 0,    y: 0.01,  z: 0     } }
          ]
        },
        // ── Микроволновка на столешнице ───────────────────────────────────────
        {
          id: "microwave",
          mesh: "Box",
          size: { width: 0.7, height: 0.42, depth: 0.48 },
          position: { x: 5.8, y: 0.9, z: 8.56 },
          rotationY: Math.PI,
          boundingBox: { minX: 5.45, maxX: 6.15, minZ: 8.32, maxZ: 8.8 },
          parts: [
            // Корпус
            { material: "metal",  size: { width: 0.7,  height: 0.42, depth: 0.48 }, offset: { x: 0,     y: 0.21,  z: 0    } },
            // Стеклянная дверца (левые 2/3)
            { material: "mirror", size: { width: 0.44, height: 0.34, depth: 0.02 }, offset: { x:-0.10,  y: 0.21,  z: 0.25 } },
            // Панель управления (правая 1/3)
            { material: "metal",  size: { width: 0.2,  height: 0.34, depth: 0.02 }, offset: { x: 0.25,  y: 0.21,  z: 0.25 } },
            // Ручка дверцы
            { material: "metal",  size: { width: 0.03, height: 0.28, depth: 0.03 }, offset: { x: 0.12,  y: 0.21,  z: 0.27 } }
          ]
        },
        // ── Высокий холодильник в южно-восточном углу ────────────────────
        {
          id: "fridge",
          mesh: "Box",
          size: { width: 0.8, height: 1.9, depth: 0.7 },
          position: { x: 8.5, y: 0.0, z: 8.5 },
          rotationY: Math.PI,
          texture: "tiles_kitchen",
          boundingBox: { minX: 8.1, maxX: 8.9, minZ: 8.15, maxZ: 8.85 },
          parts: [
            { material: "metal", size: { width: 0.8, height: 1.9, depth: 0.7 }, offset: { x: 0, y: 0.95, z: 0 } },
            { material: "wood",  size: { width: 0.78, height: 0.02, depth: 0.02 }, offset: { x: 0, y: 1.1, z: 0.36 } }, // разделитель дверей
            { material: "metal", size: { width: 0.04, height: 0.2, depth: 0.04 }, offset: { x: 0.32, y: 1.3, z: 0.37 } } // ручка
          ]
        },
        // ── Обеденный стол сдвинут в свободный восточный угол ─────────────
        {
          id: "kitchen_table",
          mesh: "Box",
          size: { width: 1.4, height: 0.75, depth: 1.0 },
          position: { x: 7.8, y: 0.0, z: 4.6 },
          rotationY: 0,
          texture: "floor_parquet",
          boundingBox: { minX: 7.1, maxX: 8.5, minZ: 4.1, maxZ: 5.1 },
          parts: [
            { material: "wood", size: { width: 1.4, height: 0.06, depth: 1.0 }, offset: { x: 0, y: 0.72, z: 0 } }, // столешница
            { material: "wood", size: { width: 0.08, height: 0.72, depth: 0.08 }, offset: { x: -0.62, y: 0.36, z: -0.42 } },
            { material: "wood", size: { width: 0.08, height: 0.72, depth: 0.08 }, offset: { x: 0.62,  y: 0.36, z: -0.42 } },
            { material: "wood", size: { width: 0.08, height: 0.72, depth: 0.08 }, offset: { x: -0.62, y: 0.36, z: 0.42 } },
            { material: "wood", size: { width: 0.08, height: 0.72, depth: 0.08 }, offset: { x: 0.62,  y: 0.36, z: 0.42 } }
          ]
        },
        // ── Стул №1 (со стороны прохода) ──────────────────────────────
        {
          id: "kitchen_chair_1",
          mesh: "Box",
          size: { width: 0.45, height: 0.9, depth: 0.45 },
          position: { x: 7.8, y: 0.0, z: 3.7 },
          rotationY: Math.PI,
          texture: "floor_parquet",
          boundingBox: { minX: 7.58, maxX: 8.02, minZ: 3.48, maxZ: 3.92 },
          parts: [
            { material: "wood", size: { width: 0.4, height: 0.05, depth: 0.4 }, offset: { x: 0, y: 0.45, z: 0 } },   // сиденье
            { material: "wood", size: { width: 0.4, height: 0.5, depth: 0.05 }, offset: { x: 0, y: 0.7, z: 0.18 } }, // спинка
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z: -0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: 0.17,  y: 0.225, z: -0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z: 0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: 0.17,  y: 0.225, z: 0.17 } }
          ]
        },
        // ── Ваза с фруктами на обеденном столе — маленький, но заметный
        //    штрих жизни; лежит на столешнице (y соответствует высоте стола) ──
        {
          id: "kitchen_fruit_bowl",
          mesh: "Box",
          size: { width: 0.22, height: 0.1, depth: 0.22 },
          position: { x: 7.5, y: 0.75, z: 4.6 },
          rotationY: 0,
          parts: [
            { material: "ceramic", size: { width: 0.22, height: 0.08, depth: 0.22 }, offset: { x: 0, y: 0.04, z: 0 } },
            { material: "plant",   size: { width: 0.09, height: 0.09, depth: 0.09 }, offset: { x: -0.04, y: 0.13, z: 0.02 } },
            { material: "plant",   size: { width: 0.08, height: 0.08, depth: 0.08 }, offset: { x: 0.05,  y: 0.12, z: -0.03 } },
            { material: "plant",   size: { width: 0.07, height: 0.07, depth: 0.07 }, offset: { x: 0.01,  y: 0.15, z: -0.05 } }
          ]
        },
        // ── Стул №2 (со стороны стены) ───────────────────────────────
        {
          id: "kitchen_chair_2",
          mesh: "Box",
          size: { width: 0.45, height: 0.9, depth: 0.45 },
          position: { x: 7.8, y: 0.0, z: 5.5 },
          rotationY: 0,
          texture: "floor_parquet",
          boundingBox: { minX: 7.58, maxX: 8.02, minZ: 5.28, maxZ: 5.72 },
          parts: [
            { material: "wood", size: { width: 0.4, height: 0.05, depth: 0.4 }, offset: { x: 0, y: 0.45, z: 0 } },
            { material: "wood", size: { width: 0.4, height: 0.5, depth: 0.05 }, offset: { x: 0, y: 0.7, z: 0.18 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z: -0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: 0.17,  y: 0.225, z: -0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: -0.17, y: 0.225, z: 0.17 } },
            { material: "wood", size: { width: 0.05, height: 0.45, depth: 0.05 }, offset: { x: 0.17,  y: 0.225, z: 0.17 } }
          ]
        },

        // ── Плита: вплотную примыкает к правому торцу гарнитура ───────────
        // Гарнитур занимает x: 3.3–6.3, глубина z: 8.25–8.85. Плита теперь
        // придвинута левым краем прямо к торцу гарнитура (x=6.3), а её
        // глубина и позиция по Z совпадают со столешницей — единая линия
        // фасадов, без зазора и без выступа вперёд/назад.
        {
          id: "kitchen_stove",
          mesh: "Box",
          size: { width: 0.65, height: 0.9, depth: 0.6 },
          position: { x: 6.625, y: 0.0, z: 8.55 },
          rotationY: Math.PI,
          texture: "floor_tiles_kitchen",
          boundingBox: { minX: 6.3, maxX: 6.95, minZ: 8.25, maxZ: 8.85 },
          parts: [
            { material: "metal", size: { width: 0.65, height: 0.85, depth: 0.6 }, offset: { x: 0, y: 0.425, z: 0 } },
            { material: "mirror", size: { width: 0.61, height: 0.02, depth: 0.56 }, offset: { x: 0, y: 0.86, z: 0 } },
            { material: "titanium", size: { width: 0.12, height: 0.01, depth: 0.12 }, offset: { x: -0.16, y: 0.875, z: -0.14 } },
            { material: "titanium", size: { width: 0.12, height: 0.01, depth: 0.12 }, offset: { x: 0.16,  y: 0.875, z: -0.14 } },
            { material: "titanium", size: { width: 0.12, height: 0.01, depth: 0.12 }, offset: { x: -0.16, y: 0.875, z: 0.14  } },
            { material: "titanium", size: { width: 0.12, height: 0.01, depth: 0.12 }, offset: { x: 0.16,  y: 0.875, z: 0.14  } },
            { material: "titanium", size: { width: 0.55, height: 0.5, depth: 0.03 }, offset: { x: 0, y: 0.3, z: 0.29 } },
            { material: "mirror", size: { width: 0.4, height: 0.3, depth: 0.02 }, offset: { x: 0, y: 0.32, z: 0.305 } },
            { material: "metal", size: { width: 0.4, height: 0.03, depth: 0.04 }, offset: { x: 0, y: 0.58, z: 0.31 } },
            { material: "metal", size: { width: 0.55, height: 0.08, depth: 0.02 }, offset: { x: 0, y: 0.08, z: 0.3 } }
          ]
        },

        // ── Разделочная доска с ножами на столешнице ─────────────────────
        // Каждый нож теперь собран из рукояти + двухступенчатого клинка,
        // сужающегося к острию (широкая часть у рукояти, узкая на кончике),
        // плюс скошенный наконечник (rotationZ) — силуэт читается как
        // настоящий кухонный нож, а не плоская металлическая полоска.
        {
          id: "kitchen_cutting_board",
          mesh: "Box",
          size: { width: 0.34, height: 0.03, depth: 0.24 },
          position: { x: 4.05, y: 0.9, z: 8.6 },
          rotationY: 0.12,
          parts: [
            { material: "wood", size: { width: 0.34, height: 0.025, depth: 0.24 }, offset: { x: 0, y: 0.0125, z: 0 } },

            // ── Нож №1 (побольше, шеф-нож) ─────────────────────────────
            // рукоять
            { material: "wood", size: { width: 0.09, height: 0.02, depth: 0.028 }, offset: { x: -0.15, y: 0.028, z: -0.05 } },
            // клинок, сегмент у рукояти (шире) — полированная сталь
            { material: "steel", size: { width: 0.08, height: 0.014, depth: 0.036 }, offset: { x: -0.065, y: 0.03, z: -0.052 } },
            // клинок, средний сегмент (сужается)
            { material: "steel", size: { width: 0.06, height: 0.011, depth: 0.027 }, offset: { x: 0.005, y: 0.03, z: -0.054 }, rotationZ: -0.03 },
            // остриё — скошенный маленький клин
            { material: "steel", size: { width: 0.035, height: 0.008, depth: 0.016 }, offset: { x: 0.058, y: 0.03, z: -0.056 }, rotationZ: -0.09 },

            // ── Нож №2 (поменьше, для овощей) ───────────────────────────
            { material: "wood", size: { width: 0.065, height: 0.017, depth: 0.024 }, offset: { x: 0.075, y: 0.028, z: 0.058 } },
            { material: "steel", size: { width: 0.05, height: 0.011, depth: 0.028 }, offset: { x: 0.13, y: 0.028, z: 0.058 } },
            { material: "steel", size: { width: 0.035, height: 0.008, depth: 0.02 }, offset: { x: 0.175, y: 0.028, z: 0.058 }, rotationZ: -0.08 },
            { material: "steel", size: { width: 0.018, height: 0.006, depth: 0.011 }, offset: { x: 0.202, y: 0.027, z: 0.058 }, rotationZ: -0.22 },

            { material: "plant", size: { width: 0.03, height: 0.01, depth: 0.03 }, offset: { x: -0.13, y: 0.03, z: 0.07 } },
            { material: "plant", size: { width: 0.025, height: 0.01, depth: 0.025 }, offset: { x: -0.1, y: 0.03, z: 0.09 } }
          ]
        },

        // ── Ножевой блок — стоит на столешнице ПЕРЕД микроволновкой,
        //    у переднего края тумбы, левее корпуса СВЧ (microwave занимает
        //    x: 5.45–6.15, z: 8.32–8.8), чтобы не оказаться внутри неё
        //    и оставаться полностью на виду. ─────────────────────────────
        {
          id: "kitchen_knife_block",
          mesh: "Box",
          size: { width: 0.18, height: 0.24, depth: 0.15 },
          position: { x: 5.35, y: 0.9, z: 8.34 },
          rotationY: 0,
          parts: [
            // ── Корпус подставки — цельный деревянный блок, стоит прямо
            // на столешнице (не парит). Слегка сужен книзу для реализма.
            { material: "wood", size: { width: 0.18, height: 0.2, depth: 0.15 }, offset: { x: 0, y: 0.1, z: 0 } },
            // тонкий цоколь-подошва чуть шире корпуса — блок читается как
            // устойчивый предмет мебели, а не подвешенный кубик
            { material: "wood", size: { width: 0.2, height: 0.015, depth: 0.17 }, offset: { x: 0, y: 0.0075, z: 0 } },
            // скошенная передняя грань сверху — характерный силуэт настоящих
            // деревянных блоков для ножей (клинки входят под углом)
            { material: "wood", size: { width: 0.18, height: 0.06, depth: 0.03 }, offset: { x: 0, y: 0.185, z: 0.06 }, rotationZ: 0, rotationX: -0.5 },

            // ── Рукояти ножей, ровно и глубоко утопленные в прорези
            // сверху корпуса (все вертикальные, без хаотичного "веера") ──
            { material: "wood", size: { width: 0.028, height: 0.09, depth: 0.02 }, offset: { x: -0.06, y: 0.235, z: -0.01 } },
            { material: "wood", size: { width: 0.032, height: 0.11, depth: 0.022 }, offset: { x: -0.02, y: 0.245, z: -0.01 } },
            { material: "wood", size: { width: 0.03, height: 0.1, depth: 0.021 }, offset: { x: 0.02, y: 0.24, z: -0.01 } },
            { material: "wood", size: { width: 0.026, height: 0.085, depth: 0.019 }, offset: { x: 0.06, y: 0.2325, z: -0.01 } },

            // тонкая щель-паз над каждой рукоятью, имитирующая прорезь
            // в блоке (тёмный акцент под рукоятью, придаёт объём)
            { material: "titanium", size: { width: 0.032, height: 0.01, depth: 0.024 }, offset: { x: -0.06, y: 0.201, z: -0.01 } },
            { material: "titanium", size: { width: 0.036, height: 0.01, depth: 0.026 }, offset: { x: -0.02, y: 0.201, z: -0.01 } },
            { material: "titanium", size: { width: 0.034, height: 0.01, depth: 0.025 }, offset: { x: 0.02, y: 0.201, z: -0.01 } },
            { material: "titanium", size: { width: 0.03, height: 0.01, depth: 0.023 }, offset: { x: 0.06, y: 0.201, z: -0.01 } },

            // ── Видимые клинки над рукоятями — полированная сталь,
            // строго вертикальные, разной высоты для естественного набора ──
            { material: "steel", size: { width: 0.013, height: 0.1, depth: 0.006 }, offset: { x: -0.06, y: 0.33, z: -0.01 } },
            { material: "steel", size: { width: 0.015, height: 0.13, depth: 0.007 }, offset: { x: -0.02, y: 0.365, z: -0.01 } },
            { material: "steel", size: { width: 0.014, height: 0.115, depth: 0.0065 }, offset: { x: 0.02, y: 0.3475, z: -0.01 } },
            { material: "steel", size: { width: 0.012, height: 0.08, depth: 0.006 }, offset: { x: 0.06, y: 0.315, z: -0.01 } }
          ]
        },

        // ── Кружки на подставке у навесного шкафа ────────────────────────
        {
          id: "kitchen_mugs",
          mesh: "Box",
          size: { width: 0.28, height: 0.02, depth: 0.14 },
          position: { x: 5.15, y: 0.9, z: 8.72 },
          rotationY: 0,
          parts: [
            { material: "wood", size: { width: 0.28, height: 0.015, depth: 0.14 }, offset: { x: 0, y: 0.0075, z: 0 } },
            { material: "ceramic", size: { width: 0.08, height: 0.09, depth: 0.08 }, offset: { x: -0.08, y: 0.06, z: 0 } },
            { material: "ceramic", size: { width: 0.03, height: 0.05, depth: 0.015 }, offset: { x: -0.045, y: 0.055, z: 0 } },
            { material: "ceramic", size: { width: 0.08, height: 0.09, depth: 0.08 }, offset: { x: 0.02, y: 0.06, z: 0 } },
            { material: "ceramic", size: { width: 0.03, height: 0.05, depth: 0.015 }, offset: { x: 0.055, y: 0.055, z: 0 } },
            { material: "ceramic", size: { width: 0.08, height: 0.09, depth: 0.08 }, offset: { x: 0.12, y: 0.06, z: 0 } },
            { material: "ceramic", size: { width: 0.03, height: 0.05, depth: 0.015 }, offset: { x: 0.155, y: 0.055, z: 0 } }
          ]
        },

        // ── Баночки со специями — ещё один штрих жизни на кухне ──────────
        {
          id: "kitchen_spice_jars",
          mesh: "Box",
          size: { width: 0.22, height: 0.01, depth: 0.08 },
          position: { x: 3.55, y: 0.9, z: 8.62 },
          rotationY: -0.08,
          parts: [
            { material: "ceramic", size: { width: 0.05, height: 0.12, depth: 0.05 }, offset: { x: -0.07, y: 0.06, z: 0 } },
            { material: "metal",   size: { width: 0.052, height: 0.015, depth: 0.052 }, offset: { x: -0.07, y: 0.125, z: 0 } },
            { material: "ceramic", size: { width: 0.05, height: 0.1,  depth: 0.05 }, offset: { x: 0.005, y: 0.05, z: 0 } },
            { material: "metal",   size: { width: 0.052, height: 0.015, depth: 0.052 }, offset: { x: 0.005, y: 0.105, z: 0 } },
            { material: "ceramic", size: { width: 0.05, height: 0.14, depth: 0.05 }, offset: { x: 0.08, y: 0.07, z: 0 } },
            { material: "metal",   size: { width: 0.052, height: 0.015, depth: 0.052 }, offset: { x: 0.08, y: 0.145, z: 0 } }
          ]
        }
      ]
    },

    // ───────────────────────────── ВАННАЯ (0,6) ─────────────────────────────
    {
      id: "bathroom",
      name: "ВАННАЯ",
      width: 6,
      length: 6,
      height: 3,
      center: { x: 0, z: 6 },
      lightColor: 0xdcf1ff, // мягкий прохладный белый
      chandelier: { x: 0, z: 6 },
      textures: {
        wall: "tiles_bathroom",
        floor: "floor_tiles_bathroom",
        ceiling: "ceiling_plaster"
      },

      // Общие стены: восточная (X=3) ведёт на кухню, северная (Z=3) ведёт в спальню (замыкание цикла).
      // Южная и западная — внешние глухие стены квартиры.
      walls: [
        { id: "bathroom_wall_west",  boundingBox: { minX: -3.1, maxX: -3, minZ: 3, maxZ: 9 } },
        { id: "bathroom_wall_south", boundingBox: { minX: -3, maxX: 3, minZ: 8.9, maxZ: 9 } },
        // Восточная стена — проём на кухню (см. doors.kitchen_to_bathroom)
        { id: "bathroom_wall_east_a", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 3, maxZ: 5.5 } },
        { id: "bathroom_wall_east_b", boundingBox: { minX: 2.9, maxX: 3.1, minZ: 6.5, maxZ: 9 } },
        // Северная стена — проём в спальню (см. doors.bathroom_to_bedroom)
        { id: "bathroom_wall_north_a", boundingBox: { minX: -3, maxX: -0.5, minZ: 2.9, maxZ: 3.1 } },
        { id: "bathroom_wall_north_b", boundingBox: { minX: 0.5, maxX: 3, minZ: 2.9, maxZ: 3.1 } }
      ],

      // ── Планировка: раковина с зеркалом у западной (глухой) стены,
      //    душевая кабина и стиральная машина рядом друг с другом в
      //    южно-западном углу — формируют цельный "санитарный блок",
      //    а не два случайных куба посреди комнаты. Проход от северного
      //    проёма (в спальню) к восточному (на кухню) свободен. ──────────
      furniture: [
        // ── Зеркало на западной стене над раковиной ────────────────────────
        {
          id: "bathroom_mirror",
          mesh: "Plane",
          size: { width: 0.75, height: 0.85, depth: 0.02 },
          position: { x: -2.98, y: 1.5, z: 4.5 },
          rotationY: Math.PI / 2,
          material: "mirror",
          boundingBox: { minX: -3.0, maxX: -2.96, minZ: 4.12, maxZ: 4.88 }
        },
        // ── Раковина с тумбой у западной стены ──────────────────────────────
        // rotationY: PI/2 → width(0.8) идёт по Z вдоль стены, depth(0.5) по X в комнату
        // Западная стена x=-3, задняя грань на x=-3, центр x = -3 + 0.25 = -2.75
        {
          id: "sink_cabinet",
          mesh: "Box",
          size: { width: 0.8, height: 0.85, depth: 0.5 },
          position: { x: -2.75, y: 0.0, z: 4.5 },
          rotationY: Math.PI / 2,
          boundingBox: { minX: -3.0, maxX: -2.5, minZ: 4.1, maxZ: 4.9 },
          parts: [
            { material: "wood",   size: { width: 0.8,  height: 0.7,  depth: 0.5  }, offset: { x: 0, y: 0.35,  z: 0    } },
            { material: "mirror", size: { width: 0.62, height: 0.06, depth: 0.38 }, offset: { x: 0, y: 0.74,  z: 0    } },
            { material: "metal",  size: { width: 0.05, height: 0.18, depth: 0.05 }, offset: { x: 0, y: 0.88,  z:-0.12 } },
            { material: "metal",  size: { width: 0.12, height: 0.03, depth: 0.03 }, offset: { x: 0, y: 0.84,  z:-0.14 } }
          ]
        },
        // ── Унитаз у западной стены, южнее раковины ──────────────────────────
        // rotationY: PI/2 → width(0.38) вдоль Z, depth(0.55) по X в комнату
        // Центр x = -3 + 0.275 = -2.725, бачок смотрит в стену (z- сторона)
        {
          id: "toilet",
          mesh: "Box",
          size: { width: 0.38, height: 0.82, depth: 0.55 },
          position: { x: -2.725, y: 0.0, z: 5.6 },
          rotationY: Math.PI / 2,
          boundingBox: { minX: -3.0, maxX: -2.45, minZ: 5.41, maxZ: 5.79 },
          parts: [
            { material: "mirror", size: { width: 0.34, height: 0.38, depth: 0.48 }, offset: { x: 0, y: 0.19,  z: 0.03  } },
            { material: "mirror", size: { width: 0.36, height: 0.03, depth: 0.5  }, offset: { x: 0, y: 0.4,   z: 0.02  } },
            { material: "mirror", size: { width: 0.34, height: 0.3,  depth: 0.18 }, offset: { x: 0, y: 0.57,  z:-0.185 } },
            { material: "mirror", size: { width: 0.36, height: 0.03, depth: 0.2  }, offset: { x: 0, y: 0.73,  z:-0.185 } },
            { material: "metal",  size: { width: 0.06, height: 0.06, depth: 0.03 }, offset: { x: 0, y: 0.77,  z:-0.09  } }
          ]
        },
        // ── Душевая кабина в юго-западном углу ──────────────────────────────
        {
          id: "shower_cabin",
          mesh: "Box",
          size: { width: 1.1, height: 2.0, depth: 1.1 },
          position: { x: -2.35, y: 0.0, z: 7.85 },
          rotationY: 0,
          texture: "tiles_bathroom",
          boundingBox: { minX: -2.9, maxX: -1.8, minZ: 7.3, maxZ: 8.4 },
          parts: [
            // Стеклянная стенка спереди (лицом к комнате, z+)
            { material: "mirror", size: { width: 1.1, height: 2.0, depth: 0.04 }, offset: { x: 0, y: 1.0, z: 0.53 } },
            // Стеклянная стенка справа (лицом к стиралке, x+)
            { material: "mirror", size: { width: 0.04, height: 2.0, depth: 1.1 }, offset: { x: 0.53, y: 1.0, z: 0 } },
            // Поддон
            { material: "metal",  size: { width: 1.1, height: 0.05, depth: 1.1 }, offset: { x: 0, y: 0.02, z: 0 } },
            // Лейка душа
            { material: "metal",  size: { width: 0.06, height: 0.3, depth: 0.06 }, offset: { x: -0.42, y: 1.9, z: 0.42 } }
          ]
        },
        // ── Сушилка для полотенец (titanium) на западной стене, над
        //    унитазом (toilet: x -2.725, z 5.6). ВАЖНО: при наличии parts
        //    item.size/mesh игнорируются движком (buildRoomFurniture рендерит
        //    только parts) — поэтому сама штанга тоже задана явным part,
        //    а не через корневой mesh. Локальные оси group: X — в комнату,
        //    Z — вдоль стены. Штанга вытянута по Z; кронштейны торчат от
        //    стены (x=0) в комнату (x=0.15), у обоих концов штанги.
        {
          id: "bathroom_towel_rail",
          position: { x: -3.0, y: 1.5, z: 5.6 },
          rotationY: 0,
          boundingBox: { minX: -3.0, maxX: -2.82, minZ: 5.4, maxZ: 5.8 },
          parts: [
            { material: "titanium", size: { width: 0.03, height: 0.03, depth: 0.4 }, offset: { x: 0.15, y: 0, z: 0 } },
            { material: "titanium", size: { width: 0.15, height: 0.03, depth: 0.03 }, offset: { x: 0.075, y: 0, z: -0.17 } },
            { material: "titanium", size: { width: 0.15, height: 0.03, depth: 0.03 }, offset: { x: 0.075, y: 0, z:  0.17 } }
          ]
        },
        // ── Полотенце, накинутое на штангу — висит вдоль стены, прямо под ней ──
        {
          id: "bathroom_towel_cloth",
          mesh: "Box",
          size: { width: 0.02, height: 0.4, depth: 0.28 },
          position: { x: -2.9, y: 1.28, z: 5.6 },
          rotationY: 0,
          parts: [
            { material: "fabric", size: { width: 0.02, height: 0.4, depth: 0.28 }, offset: { x: 0, y: 0, z: 0 } }
          ]
        },
        // ── Тумбочка с аксессуарами в северо-западном углу, у западной
        //    стены рядом с раковиной (раковина начинается на z=4.1,
        //    свободный участок стены z от 3.1 до 4.1) — по дизайну
        //    перекликается с раковинной тумбой (тот же материал wood +
        //    белый матовый фасад), сверху зубная паста, стакан, мыльница.
        //    rotationY: PI/2 → width(1.0) идёт по Z вдоль стены, depth(0.38) по X. ──
        {
          id: "bathroom_cabinet",
          mesh: "Box",
          size: { width: 1.0, height: 0.75, depth: 0.38 },
          position: { x: -2.81, y: 0.0, z: 3.62 },
          rotationY: Math.PI / 2,
          boundingBox: { minX: -3.0, maxX: -2.62, minZ: 3.12, maxZ: 4.12 },
          parts: [
            // Корпус тумбы — белый матовый фасад
            { material: "whiteMatte", size: { width: 1.0, height: 0.7, depth: 0.38 }, offset: { x: 0, y: 0.35, z: 0 } },
            // Столешница — тёмное дерево, перекликается с раковинной тумбой
            { material: "wood", size: { width: 1.04, height: 0.03, depth: 0.4 }, offset: { x: 0, y: 0.715, z: 0 } },
            // Тонкая ручка фасада
            { material: "titanium", size: { width: 0.16, height: 0.02, depth: 0.02 }, offset: { x: 0, y: 0.35, z: 0.2 } },
            // ── Аксессуары на столешнице ───────────────────────────────
            // Стакан для зубных щёток
            { material: "mirror", size: { width: 0.08, height: 0.12, depth: 0.08 }, offset: { x: -0.35, y: 0.79, z: -0.08 } },
            // Тюбик зубной пасты
            { material: "titanium", size: { width: 0.035, height: 0.14, depth: 0.035 }, offset: { x: -0.33, y: 0.8, z: 0.04 }, rotationY: 0.3 },
            // Флакон средства (жидкое мыло/шампунь)
            { material: "ceramic", size: { width: 0.09, height: 0.2, depth: 0.09 }, offset: { x: 0.05, y: 0.83, z: -0.05 } },
            // Крышечка-дозатор флакона
            { material: "titanium", size: { width: 0.03, height: 0.03, depth: 0.03 }, offset: { x: 0.05, y: 0.935, z: -0.05 } },
            // Мыльница с мылом
            { material: "ceramic", size: { width: 0.12, height: 0.02, depth: 0.08 }, offset: { x: 0.32, y: 0.735, z: 0.06 } },
            { material: "paper",   size: { width: 0.08, height: 0.03, depth: 0.05 }, offset: { x: 0.32, y: 0.755, z: 0.06 } },
            // Маленькая ваза/баночка декоративная
            { material: "plantPot", size: { width: 0.07, height: 0.1, depth: 0.07 }, offset: { x: 0.35, y: 0.8, z: -0.12 } }
          ]
        },
        // ── Зеркало над тумбочкой — довершает композицию у раковины ──
        {
          id: "bathroom_cabinet_mirror",
          mesh: "Plane",
          size: { width: 0.55, height: 0.6, depth: 0.02 },
          position: { x: -2.98, y: 1.55, z: 3.62 },
          rotationY: Math.PI / 2,
          material: "mirror",
          boundingBox: { minX: -3.0, maxX: -2.96, minZ: 3.34, maxZ: 3.9 }
        },
        // ── Мягкий коврик перед душевой кабиной — вытираем мокрые ноги
        //    сразу на выходе. Душевая занимает Z от 7.3 до 8.4, игрок входит
        //    в ванную с севера (со стороны спальни, малый Z), поэтому
        //    "перед кабиной" — это её СЕВЕРНАЯ сторона (Z чуть меньше 7.3),
        //    а не южная (та зажата между кабиной и глухой стеной z=8.9-9,
        //    туда коврик попадал по ошибке). ──────────────────────────────
        {
          id: "bathroom_rug",
          mesh: "Box",
          size: { width: 1.1, height: 0.02, depth: 0.5 },
          position: { x: -2.35, y: 0.005, z: 7.0 },
          rotationY: 0,
          parts: [
            { material: "fabric", size: { width: 1.1, height: 0.02, depth: 0.5 }, offset: { x: 0, y: 0.01, z: 0 } }
          ]
        }
      ]
    }

  ],

  // ───────────────────────── ДВЕРНЫЕ ПРОЁМЫ (ТРИГГЕРЫ) ─────────────────────────
  // Все четыре двери — реальные физические проёмы в общих стенах соседних комнат
  // (геометрически совпадают с вырезами в walls выше). position — центр проёма
  // в сцене; triggerRadius — радиус срабатывания смены комнаты/активной зоны.
  doors: [
    {
      id: "bedroom_to_corridor",
      from: "bedroom",
      to: "corridor",
      position: { x: 3, y: 1.05, z: 0 },
      width: 1.0,
      height: 2.1,
      triggerRadius: 0.8,
      boundingBox: { minX: 2.9, maxX: 3.1, minZ: -0.5, maxZ: 0.5 }
    },
    {
      id: "corridor_to_kitchen",
      from: "corridor",
      to: "kitchen",
      position: { x: 6, y: 1.05, z: 3 },
      width: 1.0,
      height: 2.1,
      triggerRadius: 0.8,
      boundingBox: { minX: 5.5, maxX: 6.5, minZ: 2.9, maxZ: 3.1 }
    },
    {
      id: "kitchen_to_bathroom",
      from: "kitchen",
      to: "bathroom",
      position: { x: 3, y: 1.05, z: 6 },
      width: 1.0,
      height: 2.1,
      triggerRadius: 0.8,
      boundingBox: { minX: 2.9, maxX: 3.1, minZ: 5.5, maxZ: 6.5 }
    },
    {
      id: "bathroom_to_bedroom",
      from: "bathroom",
      to: "bedroom",
      position: { x: 0, y: 1.05, z: 3 },
      width: 1.0,
      height: 2.1,
      triggerRadius: 0.8,
      boundingBox: { minX: -0.5, maxX: 0.5, minZ: 2.9, maxZ: 3.1 }
    }
  ],

  // Стартовая позиция игрока
  playerStart: {
    position: { x: 0, y: 0, z: 1.5 },
    rotationY: Math.PI
  }
};
