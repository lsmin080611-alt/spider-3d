/**
   * LILYGO T-Display-S3 (320x170) Spider-Man PC-98 Dual-Button Combat v3
   * --------------------------------------------------------------------
   * Complete Self-Contained Single-File Simulator:
   * - 2 Tactile Buttons: SWING (GPIO14 / SPACE) + STRIKE (GPIO0 / E / F / Shift)
   * - Zero automatic homing & zero automatic collision attack: ALL attacks require STRIKE!
   * - Case 1 (High-Energy Dive Slam): Subtle lock-on along descent without breaking arc,
   *   slams naturally into target with a moderate upward rebound.
   * - Case 2 (Medium/Fast Speed Web-Zip Rush): Keeps momentum while shooting a fast web line;
   *   upon attachment, immediately accelerates faster than entry speed directly into target.
   * - Case 3 (Low-Speed Cartoon Freeze & Yank): Suspends briefly in mid-air with dramatic camera
   *   zoom/tilt & letterbox bars, plays 1 of 4 random cartoon pixel poses, fires web dynamically,
   *   then yanks into a rapid strike. Checks obstacles behind target (ground/building) to either
   *   rebound safely with reduced momentum or pierce straight through!
   * - Full PC-98 Bayer dithering, 3-stage 360° panorama (Day / Sunset / Neon Night), unified
   *   Cloud #2 sprite, 3-altitude enemy waves, HP system, late-arc PERFECT RELEASE, Web-Wings Glide.
   */
      'use strict';

    // =========================================================================
    // 1. CONSTANTS & PC-98 MULTI-STAGE PALETTES
    // =========================================================================
    const LCD_W = 320;
    const LCD_H = 170;
    const NEAR_Z = 1.6;
    const RUN_DURATION = 360.0; // 6분 스테이지 카운트다운 (00:00 도달 시 보스전 진입 예정)

    const GRAVITY = 64.0;
    const AIR_DRAG = 0.055;
    const MAX_ALTITUDE = 335.0;
    const BLOCK_SIZE = 240.0;
    const RENDER_DIST = 640.0;
    const SAFE_SKIM_Y = 8.2;
    const MAX_HP = 100;
    const STRIKE_NO_FREEZE_SPEED = 160.0;
    const CASE1_MIN_ALTITUDE = 42.0;
    const CASE3_MIN_SPEED = 20.0;
    const CASE3_MAX_FREEZE_DUR = 0.46;
    const CASE3_MIN_FREEZE_DUR = 0.08;

    const STYLE_RANKS = [
      { label: 'D', word: 'DISMAL',   minPts: 0,  dmgMult: 1.00, col: '#94b8e0' },
      { label: 'C', word: 'CRAZY!',   minPts: 20, dmgMult: 1.10, col: '#54f8ff' },
      { label: 'B', word: 'BADASS!',  minPts: 40, dmgMult: 1.22, col: '#ff9436' },
      { label: 'A', word: 'AMAZING!', minPts: 60, dmgMult: 1.38, col: '#ff5cf4' },
      { label: 'S', word: 'SAVAGE!!', minPts: 80, dmgMult: 1.60, col: '#ffe55c' }
    ];

    const BAYER4 = [
      [ 0,  8,  2, 10],
      [12,  4, 14,  6],
      [ 3, 11,  1,  9],
      [15,  7, 13,  5]
    ];
    const BAYER2 = [
      [0, 2],
      [3, 1]
    ];

    const PAL = {
      INDIGO_OUTLINE: '#141933',
      CRIMSON:        '#e82848',
      CRIMSON_SHADE:  '#a61634',
      ROYAL_BLUE:     '#2454c4',
      BLUE_SHADE:     '#153178',
      TAXI_YEL:       '#ffd836',
      TAXI_SHADE:     '#d48e1a',
      CREAM:          '#fff4d6',
      GOLD:           '#ffe55c',
      ORANGE:         '#ff9436',
      EMERALD:        '#4ade80',
      NEON_CYAN:      '#54f8ff',
      NEON_PINK:      '#ff5cf4',
      AWNINGS:        ['#d93248', '#2a8f5c', '#e69824', '#3268c8']
    };

    const STAGE_CONFIGS = [
      // Rank D (0): 청명한 낮
      {
        name: 'SUMMER DAY',
        dotClass: 'bg-sky-400',
        skyTop: '#1e46a8',
        shadowCol: '#182246',
        shadowStretchX: 0.45,
        shadowStretchZ: 0.28,
        asphaltA: '#36405c', asphaltB: '#455070',
        asphaltFarA: '#546488', asphaltFarB: '#687aa2',
        sidewalkA: '#a6b2cc', sidewalkB: '#c2cde0', sidewalkEdge: '#566480',
        parkA: '#389c58', parkB: '#267346', parkHi: '#68c870', parkEdge: '#1f4a36',
        laneCol: '#ffd836', crossCol: '#eef6ff',
        cloudCols: ['#ffffff', '#a8dcff', '#9eb4e8', '#1a2854'],
        bldgThemes: [
          { sunA: '#e4cca4', sunB: '#cca97c', shA: '#987e6c', shB: '#745d54', roofA: '#c8b090', roofB: '#a88e72', trim: '#fff2d6', trimSh: '#b09680', frame: '#1a2448', winSky: '#7ec8f8', winDark: '#223664', winWarm: '#ffea9c', sill: '#ffffff', lobby: '#28243a' },
          { sunA: '#82b6de', sunB: '#5a90c2', shA: '#466c9c', shB: '#2f4b78', roofA: '#6c94b8', roofB: '#50749c', trim: '#c4e6ff', trimSh: '#648ab4', frame: '#162244', winSky: '#a8e2ff', winDark: '#1c3866', winWarm: '#fff2b2', sill: '#ffffff', lobby: '#1c2848' },
          { sunA: '#cc6856', sunB: '#a64a3e', shA: '#7c3c40', shB: '#582834', roofA: '#9c5e54', roofB: '#7c4642', trim: '#f0b49c', trimSh: '#965854', frame: '#1c1c38', winSky: '#7ec4ec', winDark: '#243258', winWarm: '#ffe48c', sill: '#fff2d6', lobby: '#2c1e30' },
          { sunA: '#dce2ec', sunB: '#bac4d6', shA: '#8894b0', shB: '#667290', roofA: '#c0cad8', roofB: '#9eaac0', trim: '#ffffff', trimSh: '#9ca8c2', frame: '#1a2448', winSky: '#8ad4ff', winDark: '#243a68', winWarm: '#ffefaa', sill: '#ffffff', lobby: '#262e46' },
          { sunA: '#92a2bc', sunB: '#70829e', shA: '#526280', shB: '#3a4866', roofA: '#7a8ca6', roofB: '#5e708c', trim: '#cad8ec', trimSh: '#6e809e', frame: '#141c38', winSky: '#76c8f4', winDark: '#1e3258', winWarm: '#ffe282', sill: '#d8f2ff', lobby: '#1e2438' }
        ]
      },
      // Rank C (1): 황금빛 오후
      {
        name: 'AMBER AFTERNOON',
        dotClass: 'bg-cyan-400',
        skyTop: '#243b8c',
        shadowCol: '#1f1c42',
        shadowStretchX: 0.58,
        shadowStretchZ: 0.36,
        asphaltA: '#3a3858', asphaltB: '#4c466c',
        asphaltFarA: '#62567c', asphaltFarB: '#7c6a8e',
        sidewalkA: '#b8a8be', sidewalkB: '#d6c4d0', sidewalkEdge: '#5c5270',
        parkA: '#469450', parkB: '#2d6840', parkHi: '#80be62', parkEdge: '#224434',
        laneCol: '#ffe052', crossCol: '#fff0d8',
        cloudCols: ['#fff6d8', '#ffd09c', '#a896c8', '#24204a'],
        bldgThemes: [
          { sunA: '#edd09c', sunB: '#d6ac74', shA: '#8c6c6e', shB: '#664c56', roofA: '#cea884', roofB: '#aa8468', trim: '#fff4cc', trimSh: '#a48278', frame: '#201e42', winSky: '#9ed0f4', winDark: '#2a305c', winWarm: '#ffee9c', sill: '#fff8dc', lobby: '#281e36' },
          { sunA: '#9ec0d8', sunB: '#7698bc', shA: '#4e5c8a', shB: '#364068', roofA: '#8098b4', roofB: '#607898', trim: '#d8e8f8', trimSh: '#6e7ca4', frame: '#1c2042', winSky: '#bce0f8', winDark: '#24325c', winWarm: '#fff2aa', sill: '#fff8e4', lobby: '#202242' },
          { sunA: '#d87052', sunB: '#b44e3c', shA: '#763646', shB: '#522236', roofA: '#a45850', roofB: '#824040', trim: '#f8bc9c', trimSh: '#8e5058', frame: '#221834', winSky: '#98c4e4', winDark: '#2c2c52', winWarm: '#ffe68c', sill: '#fff0d0', lobby: '#2c1a2c' },
          { sunA: '#e8dcd4', sunB: '#cabcb8', shA: '#827c9c', shB: '#605c7c', roofA: '#c6bcb8', roofB: '#a49ca0', trim: '#fff8ee', trimSh: '#948ea8', frame: '#202044', winSky: '#a8d4f4', winDark: '#2c3460', winWarm: '#fff2a8', sill: '#ffffff', lobby: '#282640' },
          { sunA: '#a4a0b8', sunB: '#827e9c', shA: '#545276', shB: '#3c3a5c', roofA: '#8884a0', roofB: '#6a6886', trim: '#dad4e8', trimSh: '#727092', frame: '#1a1c38', winSky: '#92c4e8', winDark: '#242c54', winWarm: '#ffe688', sill: '#e8f0ff', lobby: '#202036' }
        ]
      },
      // Rank B (2): 불타는 노을
      {
        name: 'GOLDEN SUNSET',
        dotClass: 'bg-amber-400',
        skyTop: '#2c164a',
        shadowCol: '#241038',
        shadowStretchX: 0.72,
        shadowStretchZ: 0.44,
        asphaltA: '#322444', asphaltB: '#442e54',
        asphaltFarA: '#64385c', asphaltFarB: '#864864',
        sidewalkA: '#b4888e', sidewalkB: '#d2a69c', sidewalkEdge: '#5e3c56',
        parkA: '#4c7c48', parkB: '#2f5438', parkHi: '#8ca854', parkEdge: '#243830',
        laneCol: '#ffe26a', crossCol: '#ffdcb8',
        cloudCols: ['#ffe8b0', '#ff9c6e', '#b8526e', '#3a1638'],
        bldgThemes: [
          { sunA: '#f2b878', sunB: '#d88c58', shA: '#6c3c64', shB: '#4c264e', roofA: '#c48668', roofB: '#9e6252', trim: '#ffe4a8', trimSh: '#844e70', frame: '#2a1236', winSky: '#ffb870', winDark: '#361c46', winWarm: '#fff2a6', sill: '#ffe8b8', lobby: '#26142e' },
          { sunA: '#d48688', sunB: '#b06072', shA: '#4e2e5c', shB: '#341c44', roofA: '#92546c', roofB: '#6e3c56', trim: '#ffd0b0', trimSh: '#6a406e', frame: '#221034', winSky: '#ffc288', winDark: '#2a1842', winWarm: '#ffea98', sill: '#ffe0c0', lobby: '#201230' },
          { sunA: '#dc724c', sunB: '#b44836', shA: '#622844', shB: '#441a34', roofA: '#9c4c48', roofB: '#7a3438', trim: '#ffc498', trimSh: '#7c3c54', frame: '#261028', winSky: '#ffa868', winDark: '#30183a', winWarm: '#ffe688', sill: '#ffdcb0', lobby: '#281224' },
          { sunA: '#ecc4a0', sunB: '#cca088', shA: '#6a4870', shB: '#4c3258', roofA: '#ba9286', roofB: '#946e6c', trim: '#fff0d0', trimSh: '#825c82', frame: '#261438', winSky: '#ffc88c', winDark: '#30204c', winWarm: '#fff4b0', sill: '#ffffff', lobby: '#261836' },
          { sunA: '#b88284', sunB: '#905e6e', shA: '#482e58', shB: '#301e42', roofA: '#84586a', roofB: '#643e54', trim: '#f0b8a8', trimSh: '#62426c', frame: '#201230', winSky: '#ffb47c', winDark: '#261a40', winWarm: '#ffe288', sill: '#ffdcc4', lobby: '#1e142c' }
        ]
      },
      // Rank A (3): 네온 야경
      {
        name: 'NEON NIGHT',
        dotClass: 'bg-fuchsia-400',
        skyTop: '#090a1e',
        shadowCol: '#060714',
        shadowStretchX: 0.42,
        shadowStretchZ: 0.30,
        asphaltA: '#14172e', asphaltB: '#1e2242',
        asphaltFarA: '#241e44', asphaltFarB: '#322658',
        sidewalkA: '#363c62', sidewalkB: '#48507c', sidewalkEdge: '#1c203c',
        parkA: '#1c4844', parkB: '#102e34', parkHi: '#2c6c5c', parkEdge: '#0c2026',
        laneCol: '#ffb838', crossCol: '#7084b8',
        cloudCols: ['#6c60a8', '#3e3672', '#24204c', '#0c0a20'],
        bldgThemes: [
          { sunA: '#343662', sunB: '#26284c', shA: '#1c1c3a', shB: '#121228', roofA: '#2c2e54', roofB: '#1e2040', trim: '#6e72a8', trimSh: '#3a3c66', frame: '#0a0b1a', winSky: '#54f8ff', winDark: '#12142a', winWarm: '#ffbe3b', sill: '#84fcff', lobby: '#101226' },
          { sunA: '#283c66', sunB: '#1c2c4e', shA: '#14203c', shB: '#0c162c', roofA: '#203256', roofB: '#162442', trim: '#5898d4', trimSh: '#2c4c78', frame: '#080e1e', winSky: '#54f8ff', winDark: '#0e1830', winWarm: '#ff5cf4', sill: '#a8faff', lobby: '#0c1428' },
          { sunA: '#462a48', sunB: '#321c38', shA: '#24142c', shB: '#160c1e', roofA: '#38203c', roofB: '#26142c', trim: '#8c5286', trimSh: '#4c2c50', frame: '#0c0814', winSky: '#ff5cf4', winDark: '#160e20', winWarm: '#ffbe3b', sill: '#ff9cf8', lobby: '#120a18' },
          { sunA: '#384068', sunB: '#283052', shA: '#1e2240', shB: '#14162c', roofA: '#2e3458', roofB: '#202644', trim: '#7888bc', trimSh: '#424c78', frame: '#0a0c1c', winSky: '#54f8ff', winDark: '#12162e', winWarm: '#ffe55c', sill: '#b8f8ff', lobby: '#101428' },
          { sunA: '#2c3456', sunB: '#1e2440', shA: '#161a32', shB: '#0e1022', roofA: '#242a48', roofB: '#181c36', trim: '#5e70a4', trimSh: '#323c62', frame: '#080a18', winSky: '#54f8ff', winDark: '#0e1226', winWarm: '#ff5cf4', sill: '#8cf8ff', lobby: '#0c0e20' }
        ]
      },
      // Rank S (4): 진홍빛 각성 폭주
      {
        name: 'CRIMSON OVERDRIVE',
        dotClass: 'bg-yellow-300',
        skyTop: '#160618',
        shadowCol: '#0a0310',
        shadowStretchX: 0.48,
        shadowStretchZ: 0.34,
        asphaltA: '#1c0f24', asphaltB: '#2a1434',
        asphaltFarA: '#3c1438', asphaltFarB: '#541840',
        sidewalkA: '#4c2648', sidewalkB: '#66345c', sidewalkEdge: '#261028',
        parkA: '#2a3a44', parkB: '#182230', parkHi: '#42565c', parkEdge: '#121422',
        laneCol: '#ffe55c', crossCol: '#ff8ca8',
        cloudCols: ['#ff9478', '#b8285c', '#58143c', '#18061c'],
        bldgThemes: [
          { sunA: '#481c3a', sunB: '#32122c', shA: '#220c22', shB: '#140616', roofA: '#3a1632', roofB: '#260e24', trim: '#ff6c8c', trimSh: '#782848', frame: '#100412', winSky: '#ffe55c', winDark: '#1a0a1e', winWarm: '#ff4468', sill: '#fff2a8', lobby: '#16081a' },
          { sunA: '#3a1e46', sunB: '#281434', shA: '#1a0c28', shB: '#10061a', roofA: '#30183c', roofB: '#200e2a', trim: '#ff5cf4', trimSh: '#6c2c74', frame: '#0c0416', winSky: '#54f8ff', winDark: '#160a24', winWarm: '#ffe55c', sill: '#a8fcff', lobby: '#12081e' },
          { sunA: '#581c32', sunB: '#3e1224', shA: '#2a0a1a', shB: '#180612', roofA: '#46162a', roofB: '#300e1e', trim: '#ff9436', trimSh: '#8c3442', frame: '#12040e', winSky: '#ffe55c', winDark: '#1c0814', winWarm: '#ff5cf4', sill: '#ffe89c', lobby: '#180610' },
          { sunA: '#422042', sunB: '#2e1432', shA: '#1e0e26', shB: '#120818', roofA: '#361a38', roofB: '#241028', trim: '#f880a8', trimSh: '#703056', frame: '#0e0414', winSky: '#ffe55c', winDark: '#180c20', winWarm: '#54f8ff', sill: '#ffffff', lobby: '#14081c' },
          { sunA: '#341c3e', sunB: '#24122e', shA: '#180a22', shB: '#0e0616', roofA: '#2a1634', roofB: '#1c0e24', trim: '#e85c94', trimSh: '#5e264c', frame: '#0c0412', winSky: '#ff5cf4', winDark: '#14081c', winWarm: '#ffe55c', sill: '#ffb8f8', lobby: '#100616' }
        ]
      }
    ];

    // DOM References
    let canvas, ctx;
    let btnCam, btnShadow, btnScanline, btnReset;
    let btnSwing, swingBtnLabel, swingBtnSub;
    let btnStrike, strikeBtnLabel, strikeBtnSub;
    let fpsBadge, stageDot, stageLabel;
    let joyBase, joyKnob;

    // Display Flags (Scanline strictly OFF by default)
    let scanlineOn = false;
    let shadowsOn = true;
    let thirdPerson = true;

    // Pre-Baked Assets
    const STAGE_PATTERNS = [];
    const cloud2Sprites = [];
    const panoramaCanvases = [];
    const styleRankSprites = [];
    const spideySprites = {};
    let treeSprite = null;
    let waterTowerSprite = null;
    let taxiSprite = null;
    let scanlinePattern = null;

    // =========================================================================
    // 2. PRE-BAKED PC-98 DITHERING PATTERNS, 3-STAGE PANORAMAS & SPRITES
    // =========================================================================
    function makeBayerPattern(colA, colB, threshold = 8, tileSize = 16, matrixSize = 4) {
      const c = document.createElement('canvas');
      c.width = tileSize;
      c.height = tileSize;
      const g = c.getContext('2d');
      for (let y = 0; y < tileSize; y++) {
        for (let x = 0; x < tileSize; x++) {
          const val = matrixSize === 2 ? BAYER2[y & 1][x & 1] * 4 : BAYER4[y & 3][x & 3];
          const col = val < threshold ? colA : colB;
          if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
        }
      }
      return ctx.createPattern(c, 'repeat');
    }

    function makeBrickPattern(baseCol, altCol, mortarCol) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      g.fillStyle = baseCol;
      g.fillRect(0, 0, 16, 16);
      for (let row = 0; row < 4; row++) {
        const y0 = row * 4;
        const offset = (row & 1) * 4;
        g.fillStyle = altCol;
        g.fillRect((offset + 1) % 16, y0, 3, 2);
        g.fillRect((offset + 9) % 16, y0 + 1, 3, 2);
        g.fillStyle = mortarCol;
        g.fillRect(0, y0 + 3, 16, 1);
        g.fillRect(offset % 16, y0, 1, 3);
        g.fillRect((offset + 8) % 16, y0, 1, 3);
      }
      return ctx.createPattern(c, 'repeat');
    }

    function bakeAllStagePatterns() {
      for (let s = 0; s < STAGE_CONFIGS.length; s++) {
        const cfg = STAGE_CONFIGS[s];
        const bldgPats = cfg.bldgThemes.map((t, idx) => {
          if (idx === 2) {
            return {
              sun: makeBrickPattern(t.sunA, t.sunB, t.frame),
              shade: makeBrickPattern(t.shA, t.shB, t.frame),
              roof: makeBayerPattern(t.roofA, t.roofB, 8, 16, 4)
            };
          }
          return {
            sun: makeBayerPattern(t.sunA, t.sunB, 11, 16, 4),
            shade: makeBayerPattern(t.shA, t.shB, 10, 16, 4),
            roof: makeBayerPattern(t.roofA, t.roofB, 8, 16, 4)
          };
        });
        STAGE_PATTERNS.push({
          shadow: makeBayerPattern(cfg.shadowCol, null, 8, 2, 2),
          asphalt: makeBayerPattern(cfg.asphaltA, cfg.asphaltB, 10, 16, 4),
          asphaltFar: makeBayerPattern(cfg.asphaltFarA, cfg.asphaltFarB, 8, 16, 2),
          sidewalk: makeBayerPattern(cfg.sidewalkA, cfg.sidewalkB, 8, 16, 4),
          park: makeBayerPattern(cfg.parkA, cfg.parkB, 10, 16, 4),
          parkHi: makeBayerPattern(cfg.parkHi, cfg.parkA, 6, 16, 4),
          bldg: bldgPats
        });
      }

      const sc = document.createElement('canvas');
      sc.width = 2; sc.height = 2;
      const sg = sc.getContext('2d');
      sg.fillStyle = 'rgba(10, 14, 30, 0.18)';
      sg.fillRect(0, 1, 2, 1);
      scanlinePattern = ctx.createPattern(sc, 'repeat');
    }

    // Unified 44x18 PC-98 "Cloud #2" Sprite baked per stage
    function bakeCloud2Sprite(cols) {
      const colHi = cols[0], colMid = cols[1], colLow = cols[2], colOut = cols[3];
      const W = 44, H = 18;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');

      const puffs = [
        { x: 10.5, y: 11.6, rx: 6.4, ry: 3.5 },
        { x: 18.2, y: 8.6,  rx: 7.6, ry: 5.7 },
        { x: 26.8, y: 9.7,  rx: 6.7, ry: 4.8 },
        { x: 34.2, y: 12.0, rx: 5.8, ry: 3.1 },
        { x: 22.0, y: 12.6, rx: 16.5, ry: 2.7 }
      ];

      const mask = new Uint8Array(W * H);
      const tone = new Uint8Array(W * H);

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (y > 14) continue;
          let maxIn = 0, nyBest = 0;
          for (let i = 0; i < puffs.length; i++) {
            const p = puffs[i];
            const dx = (x - p.x) / p.rx;
            const dy = (y - p.y) / p.ry;
            const d2 = dx * dx + dy * dy;
            if (d2 < 1.0) {
              const inside = 1.0 - d2;
              if (inside > maxIn) { maxIn = inside; nyBest = dy; }
            }
          }
          if (maxIn <= 0) continue;

          mask[y * W + x] = 1;
          const normY = (y - 3.2) / 11.2;
          const shadeVal = normY + nyBest * 0.14 + (x - 20) * 0.004;
          const dither = (BAYER2[y & 1][x & 1] - 1.5) * 0.10;
          const v = shadeVal + dither;
          tone[y * W + x] = v < 0.42 ? 1 : (v < 0.74 ? 2 : 3);
        }
      }

      g.fillStyle = colOut;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (mask[y * W + x]) continue;
          const adj =
            (x > 0 && mask[y * W + x - 1]) ||
            (x < W - 1 && mask[y * W + x + 1]) ||
            (y > 0 && mask[(y - 1) * W + x]) ||
            (y < H - 1 && mask[(y + 1) * W + x]);
          if (adj) g.fillRect(x, y, 1, 1);
        }
      }

      const pal = ['', colHi, colMid, colLow];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = tone[y * W + x];
          if (t > 0) { g.fillStyle = pal[t]; g.fillRect(x, y, 1, 1); }
        }
      }
      return c;
    }

    // 1024x160 Seamless 360° PC-98 Pixel-Art Panorama Strip
    function bakePanoramaStrip(stageIdx) {
      const W = 1024, H = 160;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');

      const skyBands = [
        // 0: Rank D - SUMMER DAY
        [
          { y: 0, col: '#1e46a8' }, { y: 46, col: '#3878d8' },
          { y: 98, col: '#68b0f0' }, { y: 142, col: '#b8e4ff' }, { y: 160, col: '#b8e4ff' }
        ],
        // 1: Rank C - AMBER AFTERNOON
        [
          { y: 0, col: '#243b8c' }, { y: 42, col: '#4a68b8' },
          { y: 88, col: '#a886b8' }, { y: 126, col: '#f0b888' }, { y: 160, col: '#ffe8b4' }
        ],
        // 2: Rank B - GOLDEN SUNSET
        [
          { y: 0, col: '#2c164a' }, { y: 38, col: '#7e2254' },
          { y: 82, col: '#d84c3e' }, { y: 122, col: '#ff9e44' }, { y: 160, col: '#ffe28a' }
        ],
        // 3: Rank A - NEON NIGHT
        [
          { y: 0, col: '#090a1e' }, { y: 50, col: '#141236' },
          { y: 102, col: '#26184c' }, { y: 144, col: '#4a1e5c' }, { y: 160, col: '#4a1e5c' }
        ],
        // 4: Rank S - CRIMSON OVERDRIVE
        [
          { y: 0, col: '#160618' }, { y: 42, col: '#3c0c2c' },
          { y: 86, col: '#841442' }, { y: 126, col: '#cc2850' }, { y: 160, col: '#ff7848' }
        ]
      ][stageIdx] || [
        { y: 0, col: '#1e46a8' }, { y: 46, col: '#3878d8' },
        { y: 98, col: '#68b0f0' }, { y: 142, col: '#b8e4ff' }, { y: 160, col: '#b8e4ff' }
      ];

      for (let y = 0; y < H; y++) {
        let sIdx = 0;
        for (let i = 0; i < skyBands.length - 1; i++) {
          if (y >= skyBands[i].y && y < skyBands[i + 1].y) { sIdx = i; break; }
        }
        const s0 = skyBands[sIdx], s1 = skyBands[sIdx + 1];
        const t = (y - s0.y) / Math.max(1, s1.y - s0.y);
        let ditherStage = 0;
        if (t > 0.52) ditherStage = Math.min(4, Math.floor(((t - 0.52) / 0.48) * 4) + 1);

        if (ditherStage <= 0) {
          g.fillStyle = s0.col;
          g.fillRect(0, y, W, 1);
        } else {
          for (let x = 0; x < W; x++) {
            g.fillStyle = BAYER2[y & 1][x & 1] < ditherStage ? s1.col : s0.col;
            g.fillRect(x, y, 1, 1);
          }
        }
      }

      if (stageIdx === 0) {
        const sunX = 180, sunY = 50;
        for (let dy = -34; dy <= 34; dy++) {
          for (let dx = -34; dx <= 34; dx++) {
            const dist = Math.hypot(dx, dy);
            const px0 = (sunX + dx + W) % W, py0 = sunY + dy;
            if (py0 < 0 || py0 >= H) continue;
            const b4 = BAYER4[py0 & 3][px0 & 3];
            if (dist <= 11.5) { g.fillStyle = '#ffffff'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 16.0 && b4 < 11) { g.fillStyle = '#fff9d8'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 22.5 && b4 < 6) { g.fillStyle = '#d4f1ff'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 31.0 && b4 < 3) { g.fillStyle = '#b8e4ff'; g.fillRect(px0, py0, 1, 1); }
          }
        }
      } else if (stageIdx === 1) {
        const sunX = 180, sunY = 86;
        for (let dy = -40; dy <= 40; dy++) {
          for (let dx = -40; dx <= 40; dx++) {
            const dist = Math.hypot(dx, dy);
            const px0 = (sunX + dx + W) % W, py0 = sunY + dy;
            if (py0 < 0 || py0 >= H) continue;
            const b4 = BAYER4[py0 & 3][px0 & 3];
            if (dist <= 15.0) { g.fillStyle = '#fffbe0'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 22.0 && b4 < 11) { g.fillStyle = '#ffe294'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 30.0 && b4 < 6) { g.fillStyle = '#ffbe78'; g.fillRect(px0, py0, 1, 1); }
            else if (dist <= 38.0 && b4 < 3) { g.fillStyle = '#f0a288'; g.fillRect(px0, py0, 1, 1); }
          }
        }
      } else if (stageIdx === 2) {
        const sunX = 180, sunY = 122;
        for (let dy = -48; dy <= 48; dy++) {
          for (let dx = -48; dx <= 48; dx++) {
            const dist = Math.hypot(dx, dy);
            const px0 = (sunX + dx + W) % W, py0 = sunY + dy;
            if (py0 < 0 || py0 >= H) continue;
            const b4 = BAYER4[py0 & 3][px0 & 3];
            if (dist <= 22.0) {
              g.fillStyle = dy < -4 ? '#fff9c4' : (dy < 10 ? '#ffd858' : '#ff9838');
              g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 32.0 && b4 < 10) {
              g.fillStyle = '#ffb85c'; g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 44.0 && b4 < 5) {
              g.fillStyle = '#ff6e54'; g.fillRect(px0, py0, 1, 1);
            }
          }
        }
      } else if (stageIdx === 3) {
        let sSeed = 99123;
        const nRand = () => { sSeed = (sSeed * 1664525 + 1013904223) >>> 0; return sSeed / 4294967296; };
        for (let i = 0; i < 150; i++) {
          const sx = Math.floor(nRand() * W);
          const sy = Math.floor(nRand() * 110);
          const kind = i % 5;
          g.fillStyle = kind === 0 ? '#ffffff' : (kind === 1 ? '#54f8ff' : (kind === 2 ? '#ff9cf8' : '#8e9ce0'));
          g.fillRect(sx, sy, 1, 1);
          if (kind === 0 && i < 24) {
            g.fillStyle = '#8aa8f0';
            g.fillRect((sx + 1) % W, sy, 1, 1);
            g.fillRect((sx - 1 + W) % W, sy, 1, 1);
          }
        }
        const moonX = 180, moonY = 44;
        for (let dy = -26; dy <= 26; dy++) {
          for (let dx = -26; dx <= 26; dx++) {
            const dist = Math.hypot(dx, dy);
            const px0 = (moonX + dx + W) % W, py0 = moonY + dy;
            if (py0 < 0 || py0 >= H) continue;
            const b4 = BAYER4[py0 & 3][px0 & 3];
            if (dist <= 11.0) {
              const crater = Math.hypot(dx + 3, dy - 2) < 3.2 || Math.hypot(dx - 4, dy + 3) < 2.4;
              g.fillStyle = crater ? '#c8d6ff' : '#f4f8ff';
              g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 19.0 && b4 < 6) {
              g.fillStyle = '#5e5ca8'; g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 25.0 && b4 < 3) {
              g.fillStyle = '#383072'; g.fillRect(px0, py0, 1, 1);
            }
          }
        }
      } else {
        // 4: Rank S - CRIMSON OVERDRIVE (별빛 + 진홍·황금 개기월식 피버 문)
        let sSeed = 77321;
        const nRand = () => { sSeed = (sSeed * 1664525 + 1013904223) >>> 0; return sSeed / 4294967296; };
        for (let i = 0; i < 170; i++) {
          const sx = Math.floor(nRand() * W);
          const sy = Math.floor(nRand() * 106);
          const kind = i % 5;
          g.fillStyle = kind === 0 ? '#ffe55c' : (kind === 1 ? '#ff5cf4' : (kind === 2 ? '#54f8ff' : '#ff8ca8'));
          g.fillRect(sx, sy, 1, 1);
          if (kind === 0 && i < 28) {
            g.fillStyle = '#ff9436';
            g.fillRect((sx + 1) % W, sy, 1, 1);
            g.fillRect((sx - 1 + W) % W, sy, 1, 1);
          }
        }
        const moonX = 180, moonY = 54;
        for (let dy = -34; dy <= 34; dy++) {
          for (let dx = -34; dx <= 34; dx++) {
            const dist = Math.hypot(dx, dy);
            const px0 = (moonX + dx + W) % W, py0 = moonY + dy;
            if (py0 < 0 || py0 >= H) continue;
            const b4 = BAYER4[py0 & 3][px0 & 3];
            if (dist <= 11.5) {
              // 검붉은 개기월식 코어 + 황금 코로나 테두리
              g.fillStyle = dist > 9.6 ? '#ffe55c' : (dist > 7.5 ? '#a61634' : '#240618');
              g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 17.0 && b4 < 12) {
              g.fillStyle = '#ffe55c'; g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 24.5 && b4 < 8) {
              g.fillStyle = '#e82848'; g.fillRect(px0, py0, 1, 1);
            } else if (dist <= 33.0 && b4 < 4) {
              g.fillStyle = '#841442'; g.fillRect(px0, py0, 1, 1);
            }
          }
        }
      }

      const cSpr = cloud2Sprites[stageIdx];
      for (let i = 0; i < 10; i++) {
        const cx = (i * 107 + 42) % (W - 44);
        const cy = 94 + ((i * 23) % 26);
        g.drawImage(cSpr, cx, cy, 26, 11);
      }

      const far1List = ['#7e8ec9', '#7a689c', '#5e2c5c', '#1b1a3c', '#2c0c24'];
      const far2List = ['#5a6ba8', '#56467a', '#3c1c46', '#101028', '#180616'];
      const rimList  = ['#92a8de', '#f0b888', '#ff9e64', '#54f8ff', '#ffe55c'];
      const mistList = ['#b8e4ff', '#ffe0a8', '#ffd880', '#4a1e5c', '#a81c44'];
      const far1 = far1List[stageIdx] || far1List[0];
      const far2 = far2List[stageIdx] || far2List[0];
      const rimCol = rimList[stageIdx] || rimList[0];
      const isNeonStage = stageIdx >= 3;

      g.fillStyle = far1;
      let bx = 0, seed = 1337;
      const nextRand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

      while (bx < W) {
        const bw = 10 + Math.floor(nextRand() * 20);
        const bh = 14 + Math.floor(nextRand() * 34);
        g.fillRect(bx, H - bh, bw, bh);
        if (nextRand() < 0.22) {
          const sw = Math.max(4, (bw * 0.45) | 0);
          const sx = bx + ((bw - sw) >> 1);
          g.fillRect(sx, H - bh - 7, sw, 7);
          g.fillRect(sx + (sw >> 1), H - bh - 18, 1, 11);
        }
        if (isNeonStage) {
          for (let wy = H - bh + 4; wy < H - 6; wy += 4) {
            for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) {
              if (nextRand() < (stageIdx === 4 ? 0.34 : 0.28)) {
                if (stageIdx === 4) {
                  g.fillStyle = nextRand() < 0.45 ? '#ffe55c' : (nextRand() < 0.75 ? '#ff4468' : '#54f8ff');
                } else {
                  g.fillStyle = nextRand() < 0.5 ? '#ffbe3b' : (nextRand() < 0.7 ? '#54f8ff' : '#ff5cf4');
                }
                g.fillRect(wx, wy, 1, 1);
              }
            }
          }
          g.fillStyle = far1;
        }
        bx += bw + Math.floor(nextRand() * 5);
      }

      // Suspension bridge silhouette
      g.fillStyle = far1;
      const brY = H - 15;
      g.fillRect(580, brY, 140, 2);
      g.fillRect(610, brY - 22, 4, 37);
      g.fillRect(686, brY - 22, 4, 37);
      for (let x = 580; x <= 720; x++) {
        let cy;
        if (x < 612) { const t = (x - 580) / 32; cy = brY - t * t * 20; }
        else if (x <= 688) { const t = (x - 650) / 38; cy = brY - 3 - t * t * 17; }
        else { const t = (720 - x) / 32; cy = brY - t * t * 20; }
        g.fillStyle = (isNeonStage && (x % 4 === 0)) ? (stageIdx === 4 ? '#ffe55c' : '#ffbe3b') : far1;
        g.fillRect(x, Math.round(cy), 1, 1);
        if (x % 6 === 0 && x > 586 && x < 714) {
          g.fillStyle = far1;
          g.fillRect(x, Math.round(cy) + 1, 1, Math.max(1, brY - Math.round(cy)));
        }
      }

      g.fillStyle = far2;
      bx = 6;
      while (bx < W) {
        const bw = 12 + Math.floor(nextRand() * 18);
        const bh = 8 + Math.floor(nextRand() * 20);
        g.fillRect(bx, H - bh, bw, bh);
        if (bh > 15) {
          g.fillStyle = rimCol;
          g.fillRect(bx + 2, H - bh + 2, bw - 4, 1);
          g.fillStyle = far2;
        }
        bx += bw + 4 + Math.floor(nextRand() * 10);
      }

      const mistCol = mistList[stageIdx] || mistList[0];
      for (let y = H - 10; y < H; y++) {
        const mistLvl = Math.floor(((y - (H - 10)) / 10) * 9);
        for (let x = 0; x < W; x++) {
          if (BAYER4[y & 3][x & 3] < mistLvl) {
            g.fillStyle = mistCol;
            g.fillRect(x, y, 1, 1);
          }
        }
      }
      return c;
    }

    // 10-Pose 24x28 Pixel-Art Spider-Man Sprite Sheet (+ Dotted Cyan & Gold Afterimages)
    function bakeSpideyPose(drawFn) {
      const W = 24, H = 28;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      const cyanGhost = document.createElement('canvas'); cyanGhost.width = W; cyanGhost.height = H;
      const cg = cyanGhost.getContext('2d');
      const goldGhost = document.createElement('canvas'); goldGhost.width = W; goldGhost.height = H;
      const gg = goldGhost.getContext('2d');

      const buf = new Uint8Array(W * H);

      const setPx = (x, y, col) => {
        const ix = Math.round(x), iy = Math.round(y);
        if (ix >= 1 && ix < W - 1 && iy >= 1 && iy < H - 1) buf[iy * W + ix] = col;
      };
      const fillDisk = (cx, cy, r, col, shadeCol = col) => {
        const r2 = r * r;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) {
              const isSh = (dx + dy > r * 0.35) && (((x + y) & 1) === 0 || dx + dy > r * 0.8);
              setPx(x, y, isSh ? shadeCol : col);
            }
          }
        }
      };
      const drawLimb = (x0, y0, x1, y1, r, col, shadeCol) => {
        const steps = Math.max(6, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          fillDisk(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, col, shadeCol);
        }
      };

      const meta = drawFn({ setPx, fillDisk, drawLimb });

      // Crisp 1px indigo outline
      g.fillStyle = PAL.INDIGO_OUTLINE;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (buf[y * W + x] !== 0) continue;
          const adj =
            (x > 0 && buf[y * W + x - 1] !== 0) ||
            (x < W - 1 && buf[y * W + x + 1] !== 0) ||
            (y > 0 && buf[(y - 1) * W + x] !== 0) ||
            (y < H - 1 && buf[(y + 1) * W + x] !== 0);
          if (adj) g.fillRect(x, y, 1, 1);
        }
      }

      const palette = ['', PAL.CRIMSON, PAL.CRIMSON_SHADE, PAL.ROYAL_BLUE, PAL.BLUE_SHADE, '#ffffff', '#ff6e84', '#cceeff'];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = buf[y * W + x];
          if (v !== 0) {
            g.fillStyle = palette[v];
            g.fillRect(x, y, 1, 1);
            if (((x + y) & 1) === 0) {
              cg.fillStyle = PAL.NEON_CYAN;
              cg.fillRect(x, y, 1, 1);
              gg.fillStyle = PAL.GOLD;
              gg.fillRect(x, y, 1, 1);
            }
          }
        }
      }
      return {
        canvas: c,
        cyanGhost,
        goldGhost,
        handX: meta.handX,
        handY: meta.handY,
        hand1X: meta.hand1X,
        hand1Y: meta.hand1Y,
        hand2X: meta.hand2X,
        hand2Y: meta.hand2Y
      };
    }

    function bakeAllSpideySprites() {
      const drawHead = (api, hx, hy) => {
        api.fillDisk(hx, hy, 3.1, 1, 2);
        api.setPx(hx - 1, hy - 2, 6);
        api.setPx(hx - 2, hy, 5); api.setPx(hx - 1, hy, 5); api.setPx(hx - 2, hy - 1, 5);
        api.setPx(hx + 1, hy, 5); api.setPx(hx + 2, hy, 5); api.setPx(hx + 2, hy - 1, 5);
      };

      spideySprites.SWING_R = bakeSpideyPose((api) => {
        api.drawLimb(11, 15, 16, 18, 1.5, 3, 4); api.drawLimb(16, 18, 13, 23, 1.4, 1, 2);
        api.drawLimb(10, 15, 7, 19, 1.5, 3, 4);  api.drawLimb(7, 19, 5, 24, 1.4, 1, 2);
        api.drawLimb(11, 10, 11, 15, 2.5, 3, 4); api.drawLimb(11, 9, 11, 13, 2.0, 1, 2);
        api.setPx(11, 11, 4);
        api.drawLimb(13, 10, 19, 3, 1.4, 1, 2);  api.drawLimb(9, 11, 4, 15, 1.3, 1, 2);
        drawHead(api, 11, 6);
        return { handX: 19, handY: 3 };
      });

      spideySprites.SWING_L = bakeSpideyPose((api) => {
        api.drawLimb(13, 15, 8, 18, 1.5, 3, 4);  api.drawLimb(8, 18, 11, 23, 1.4, 1, 2);
        api.drawLimb(14, 15, 17, 19, 1.5, 3, 4); api.drawLimb(17, 19, 19, 24, 1.4, 1, 2);
        api.drawLimb(13, 10, 13, 15, 2.5, 3, 4); api.drawLimb(13, 9, 13, 13, 2.0, 1, 2);
        api.setPx(13, 11, 4);
        api.drawLimb(11, 10, 5, 3, 1.4, 1, 2);   api.drawLimb(15, 11, 20, 15, 1.3, 1, 2);
        drawHead(api, 13, 6);
        return { handX: 5, handY: 3 };
      });

      spideySprites.DIVE = bakeSpideyPose((api) => {
        api.drawLimb(11, 11, 9, 4, 1.4, 3, 4);   api.drawLimb(9, 4, 8, 2, 1.3, 1, 2);
        api.drawLimb(13, 11, 15, 4, 1.4, 3, 4);  api.drawLimb(15, 4, 16, 2, 1.3, 1, 2);
        api.drawLimb(12, 11, 12, 17, 2.5, 3, 4); api.drawLimb(12, 13, 12, 18, 2.0, 1, 2);
        api.drawLimb(10, 16, 6, 11, 1.3, 1, 2);  api.drawLimb(14, 16, 18, 11, 1.3, 1, 2);
        drawHead(api, 12, 21);
        return { handX: 12, handY: 20 };
      });

      spideySprites.GLIDE = bakeSpideyPose((api) => {
        // Under-arm translucent web wings!
        for (let y = 11; y <= 17; y++) {
          for (let x = 3; x <= 20; x++) {
            if ((x < 9 || x > 15) && ((x + y) & 1) === 0 && y < 18 - Math.abs(x - 12) * 0.45) {
              api.setPx(x, y, 7);
            }
          }
        }
        api.drawLimb(11, 16, 8, 23, 1.4, 3, 4);  api.drawLimb(8, 23, 7, 25, 1.3, 1, 2);
        api.drawLimb(13, 16, 16, 23, 1.4, 3, 4); api.drawLimb(16, 23, 17, 25, 1.3, 1, 2);
        api.drawLimb(12, 10, 12, 17, 2.4, 3, 4); api.drawLimb(12, 10, 12, 14, 2.0, 1, 2);
        api.drawLimb(10, 11, 3, 9, 1.4, 1, 2);   api.drawLimb(14, 11, 21, 9, 1.4, 1, 2);
        drawHead(api, 12, 7);
        return { handX: 12, handY: 9 };
      });

      spideySprites.FLIP = bakeSpideyPose((api) => {
        api.fillDisk(12, 14, 5.2, 3, 4);
        api.fillDisk(12, 12, 3.6, 1, 2);
        api.drawLimb(9, 16, 14, 19, 1.6, 1, 2);
        api.drawLimb(15, 13, 10, 17, 1.4, 1, 2);
        drawHead(api, 12, 9);
        return { handX: 12, handY: 12 };
      });

      spideySprites.GROUND_JUMP = bakeSpideyPose((api) => {
        api.drawLimb(10, 17, 6, 19, 1.6, 3, 4);  api.drawLimb(6, 19, 7, 25, 1.5, 1, 2);
        api.drawLimb(14, 17, 18, 19, 1.6, 3, 4); api.drawLimb(18, 19, 17, 25, 1.5, 1, 2);
        api.drawLimb(12, 11, 12, 17, 2.6, 3, 4); api.drawLimb(12, 10, 12, 15, 2.0, 1, 2);
        api.drawLimb(9, 12, 5, 8, 1.4, 1, 2);    api.drawLimb(15, 12, 19, 8, 1.4, 1, 2);
        drawHead(api, 12, 7);
        return { handX: 19, handY: 8 };
      });

      // === 4 Distinct Cartoon Strike Poses for Case 3 (Randomly Chosen) ===
      // Motion 0: Two-Handed Classic Spider-Man Web-Yank Pose
      spideySprites.STRIKE_TWOWEB = bakeSpideyPose((api) => {
        api.drawLimb(10, 16, 6, 21, 1.5, 3, 4);  api.drawLimb(6, 21, 8, 25, 1.4, 1, 2);
        api.drawLimb(14, 16, 18, 21, 1.5, 3, 4); api.drawLimb(18, 21, 16, 25, 1.4, 1, 2);
        api.drawLimb(12, 11, 12, 16, 2.6, 3, 4); api.drawLimb(12, 10, 12, 14, 2.1, 1, 2);
        api.drawLimb(10, 11, 4, 5, 1.5, 1, 2);   api.drawLimb(14, 11, 20, 5, 1.5, 1, 2);
        drawHead(api, 12, 8);
        return { handX: 12, handY: 5, hand2X: 4, hand2Y: 5, hand1X: 20, hand1Y: 5 };
      });

      // Motion 1: Coiled Superhero Meteor Fist-Lunge Pose
      spideySprites.STRIKE_PUNCH = bakeSpideyPose((api) => {
        api.drawLimb(11, 15, 6, 19, 1.5, 3, 4);  api.drawLimb(6, 19, 4, 24, 1.4, 1, 2);
        api.drawLimb(13, 15, 15, 20, 1.5, 3, 4); api.drawLimb(15, 20, 12, 25, 1.4, 1, 2);
        api.drawLimb(12, 10, 11, 16, 2.5, 3, 4); api.drawLimb(12, 9, 12, 13, 2.0, 1, 2);
        api.drawLimb(14, 10, 21, 4, 1.7, 1, 2);  api.drawLimb(9, 12, 4, 14, 1.4, 1, 2);
        drawHead(api, 12, 7);
        return { handX: 21, handY: 4 };
      });

      // Motion 2: Acrobatic Twin-Foot Spider Dropkick Pose
      spideySprites.STRIKE_DROPKICK = bakeSpideyPose((api) => {
        api.drawLimb(12, 14, 18, 12, 1.6, 3, 4); api.drawLimb(18, 12, 22, 10, 1.6, 1, 2);
        api.drawLimb(12, 16, 18, 16, 1.6, 3, 4); api.drawLimb(18, 16, 22, 15, 1.6, 1, 2);
        api.drawLimb(8, 13, 13, 15, 2.5, 3, 4);  api.drawLimb(8, 12, 11, 14, 2.0, 1, 2);
        api.drawLimb(8, 11, 4, 6, 1.4, 1, 2);    api.drawLimb(7, 14, 4, 19, 1.4, 1, 2);
        drawHead(api, 6, 10);
        return { handX: 22, handY: 12 };
      });

      // Motion 3: Crouched Back-Arch Web-Whip Spin Pose
      spideySprites.STRIKE_SPIN = bakeSpideyPose((api) => {
        api.drawLimb(11, 14, 5, 11, 1.5, 3, 4);  api.drawLimb(5, 11, 4, 6, 1.4, 1, 2);
        api.drawLimb(13, 15, 18, 18, 1.5, 3, 4); api.drawLimb(18, 18, 19, 24, 1.4, 1, 2);
        api.drawLimb(12, 12, 12, 16, 2.6, 3, 4); api.drawLimb(12, 11, 12, 15, 2.0, 1, 2);
        api.drawLimb(10, 13, 19, 5, 1.5, 1, 2);  api.drawLimb(14, 12, 5, 18, 1.4, 1, 2);
        drawHead(api, 12, 8);
        return { handX: 19, handY: 5 };
      });
    }

    function bakePropSprites() {
      // Park Tree (18x24)
      {
        const W = 18, H = 24;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        const buf = new Uint8Array(W * H);
        for (let y = 14; y < 23; y++) { buf[y * W + 8] = 4; buf[y * W + 9] = 5; }
        const puffs = [{ x: 9, y: 8, r: 6.2 }, { x: 5.5, y: 11, r: 4.2 }, { x: 12.5, y: 11, r: 4.2 }];
        for (let y = 1; y < 17; y++) {
          for (let x = 1; x < W - 1; x++) {
            for (const p of puffs) {
              if ((x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r) {
                const v = (y - 3) / 12 + (BAYER2[y & 1][x & 1] - 1.5) * 0.14;
                buf[y * W + x] = v < 0.35 ? 1 : (v < 0.72 ? 2 : 3);
              }
            }
          }
        }
        g.fillStyle = PAL.INDIGO_OUTLINE;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (buf[y * W + x]) continue;
          if ((x > 0 && buf[y * W + x - 1]) || (x < W - 1 && buf[y * W + x + 1]) ||
              (y > 0 && buf[(y - 1) * W + x]) || (y < H - 1 && buf[(y + 1) * W + x])) g.fillRect(x, y, 1, 1);
        }
        const cols = ['', '#68c870', '#389c58', '#267346', '#80523c', '#583428'];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (buf[y * W + x]) { g.fillStyle = cols[buf[y * W + x]]; g.fillRect(x, y, 1, 1); }
        }
        treeSprite = c;
      }

      // Water Tower (16x22)
      {
        const W = 16, H = 22;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = PAL.INDIGO_OUTLINE;
        g.fillRect(4, 15, 2, 7); g.fillRect(10, 15, 2, 7);
        g.fillRect(5, 17, 6, 1); g.fillRect(5, 20, 6, 1);
        g.fillRect(3, 5, 10, 11);
        for (let y = 6; y <= 14; y++) {
          for (let x = 4; x <= 11; x++) {
            g.fillStyle = (y === 8 || y === 12) ? '#38405a' : (x < 8 ? '#b88258' : '#80543c');
            g.fillRect(x, y, 1, 1);
          }
        }
        for (let row = 0; row < 5; row++) {
          const x0 = 7 - row, w = 2 + row * 2;
          g.fillStyle = PAL.INDIGO_OUTLINE; g.fillRect(x0 - 1, 1 + row, w + 2, 1);
          g.fillStyle = row < 2 ? '#8c9ab4' : '#5e6c88'; g.fillRect(x0, 1 + row, w, 1);
        }
        waterTowerSprite = c;
      }

      // Yellow NY Pixel Taxi (14x8)
      {
        const W = 14, H = 8;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d');
        g.fillStyle = PAL.INDIGO_OUTLINE;
        g.fillRect(1, 2, 12, 5); g.fillRect(3, 0, 8, 3);
        g.fillStyle = PAL.TAXI_YEL;
        g.fillRect(2, 3, 10, 3); g.fillRect(4, 1, 6, 2);
        g.fillStyle = PAL.TAXI_SHADE;
        g.fillRect(2, 5, 10, 1);
        g.fillStyle = '#82d4ff';
        g.fillRect(4, 2, 3, 1); g.fillRect(8, 2, 2, 1);
        g.fillStyle = '#ffffff'; g.fillRect(6, 0, 2, 1);
        g.fillStyle = '#141933';
        g.fillRect(2, 6, 3, 2); g.fillRect(9, 6, 3, 2);
        taxiSprite = c;
      }
    }

    // Pre-Baked 28x32 DMC / Samira Sharp-Serif PC-98 Pixel Style Rank Sprites (D / C / B / A / S)
    function bakeStyleRankSprites() {
      const GLYPHS = [
        // 0: D (sharp top-left spear + gothic bow + bottom-left razor spur)
        [
          '........###########...',
          '......##############..',
          '....######....#######.',
          '..#####........######.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####......#####.',
          '.....#####.....######.',
          '....######....#######.',
          '...#################..',
          '..################....',
          '.######...............',
          '####..................',
          '##....................'
        ],
        // 1: C (sharp DMC beak top-left + curved spine + flared bottom tail)
        [
          '......#############...',
          '....#################.',
          '..########.....######.',
          '.######..........####.',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '#####.................',
          '.#####..........####..',
          '..######.......######.',
          '...##################.',
          '....################..',
          '......############....',
          '......................',
          '......................'
        ],
        // 2: B (gothic blade top-left + twin angular lobes + bottom-left spur)
        [
          '.....############.....',
          '...###############....',
          '..######.....######...',
          '.....#####....#####...',
          '.....#####....#####...',
          '.....#####....#####...',
          '.....#####...######...',
          '.....#############....',
          '.....############.....',
          '.....#############....',
          '.....#####...######...',
          '.....#####....######..',
          '.....#####.....#####..',
          '.....#####.....#####..',
          '.....#####.....#####..',
          '.....#####.....#####..',
          '.....#####.....#####..',
          '.....#####....######..',
          '....################..',
          '...################...',
          '..######..............',
          '.####.................',
          '##....................',
          '......................',
          '......................'
        ],
        // 3: A (slanted dynamic apex + flared crossbar + razor bottom-left blade)
        [
          '...........######.....',
          '..........#######.....',
          '.........#########....',
          '........##########....',
          '........#####.#####...',
          '.......#####..#####...',
          '.......#####..#####...',
          '......#####...#####...',
          '......#####...#####...',
          '.....#####....#####...',
          '.....#####....#####...',
          '....###############...',
          '...#################..',
          '..##################..',
          '..#####.......######..',
          '.#####........######..',
          '.#####........######..',
          '#####..........#####..',
          '#####..........######.',
          '####...........#######',
          '###.............######',
          '##....................',
          '#.....................',
          '......................',
          '......................'
        ],
        // 4: S (iconic fiery DMC S: razor top-right crest + bold diagonal + razor bottom-left spur)
        [
          '.......##############.',
          '.....################.',
          '....#######.....####..',
          '...######.............',
          '..######..............',
          '..#####...............',
          '..######..............',
          '...#######............',
          '....#########.........',
          '......##########......',
          '........##########....',
          '..........#########...',
          '............########..',
          '..............######..',
          '..............######..',
          '..............######..',
          '.............#######..',
          '............########..',
          '..####....#########...',
          '.##################...',
          '################......',
          '#############.........',
          '#####.................',
          '###...................',
          '#.....................'
        ]
      ];

      // 4-tone PC-98 palettes per rank: [bevelHi, topTone, midTone, deepTone, outline]
      const PALETTES = [
        ['#ffffff', '#d8e6f8', '#8aa0c2', '#4a5c80', '#0a0f24'], // D: Steely Silver
        ['#ffffff', '#a8f8ff', '#38d8f8', '#1c6ca8', '#081228'], // C: Electric Ice Cyan
        ['#fff8d0', '#ffd068', '#ff8828', '#b83218', '#1c0a18'], // B: Blazing Amber
        ['#ffeaff', '#ff98f8', '#e83cf0', '#7e189c', '#180824'], // A: Neon Magenta
        ['#ffffff', '#fff278', '#ffa028', '#d82038', '#140410']  // S: Fiery Gold-Crimson
      ];

      styleRankSprites.length = 0;
      const W = 28, H = 32;
      const ox = 3, oy = 3;

      for (let idx = 0; idx < GLYPHS.length; idx++) {
        const rows = GLYPHS[idx];
        const pal = PALETTES[idx];
        const mask = new Uint8Array(W * H);

        for (let ry = 0; ry < rows.length; ry++) {
          const line = rows[ry];
          for (let rx = 0; rx < line.length; rx++) {
            if (line.charAt(rx) === '#') {
              const x = ox + rx, y = oy + ry;
              if (x >= 0 && x < W && y >= 0 && y < H) {
                mask[y * W + x] = 1;
              }
            }
          }
        }

        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const g = c.getContext('2d');

        // 1) Crisp 2px drop shadow
        g.fillStyle = '#070914';
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (mask[y * W + x]) {
              if (x + 2 < W && y + 2 < H) g.fillRect(x + 2, y + 2, 1, 1);
            }
          }
        }

        // 2) Thick 2px dark outline around letter silhouette
        g.fillStyle = pal[4];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (mask[y * W + x]) continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < W && ny >= 0 && ny < H && mask[ny * W + nx]) {
                  near = true; break;
                }
              }
            }
            if (near) g.fillRect(x, y, 1, 1);
          }
        }

        // 3) Metallic/flame Bayer4 dither gradient + diagonal sheen + 1px top-left bevel
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!mask[y * W + x]) continue;
            const topEmpty = (y === 0) || !mask[(y - 1) * W + x];
            const leftEmpty = (x === 0) || !mask[y * W + (x - 1)];
            const botEmpty = (y === H - 1) || !mask[(y + 1) * W + x];
            if (topEmpty || (leftEmpty && y < H * 0.65)) {
              g.fillStyle = pal[0];
              g.fillRect(x, y, 1, 1);
              continue;
            }
            if (botEmpty) {
              g.fillStyle = pal[3];
              g.fillRect(x, y, 1, 1);
              continue;
            }
            // Diagonal metallic/fire wave + vertical gradient with Bayer4 dithering
            const sheen = Math.sin((x * 0.32 + y * 0.24) + idx * 0.9) * 0.16;
            const t = Math.max(0, Math.min(1, (y - oy) / 23.0 + sheen));
            const b4 = BAYER4[y & 3][x & 3] / 16.0;
            let col;
            if (t < 0.34) {
              col = (t / 0.34) > b4 ? pal[2] : pal[1];
            } else if (t < 0.72) {
              col = ((t - 0.34) / 0.38) > b4 ? pal[3] : pal[2];
            } else {
              col = pal[3];
            }
            g.fillStyle = col;
            g.fillRect(x, y, 1, 1);
          }
        }

        styleRankSprites.push(c);
      }
    }