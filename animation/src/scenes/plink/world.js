// world.js: the stream and its banks — sky, water, the current, the far pool, banks, the flower, stones.
(() => {
  const { MX, WL, BANK, BANK_L, BANK_R, C, warm, JUMP } = PLK;

  // ------------------------------------------------------------ the world
  function sky(t) {
    const w = warm(t);
    boilSeed('sky');
    paint(rectPts(-3000, -1600, 9000, WL + 1600), { wash: mixCol(C.skyCold, C.skyWarm, w), ink: null });
    for (let i = 0; i < 6; i++) {   // low clouds drift and part as the sun comes out
      boilSeed('cloud' + i);
      const x = -700 + i * 620 + 120 * hash(i) + t * 10 * (1 + hash(i + 9)) + w * (i % 2 ? 700 : -600);
      paint(ellPts(x, 150 + 90 * hash(i + 3), 250 + 120 * hash(i + 5), 64 + 26 * hash(i + 7), 20, 5),
        { fill: mixCol('#DCE3E5', '#FFF1D6', w), fillOp: 150 * (1 - .55 * w), bleed: .25, tex: .4, ink: null });
    }
    if (w > .02) glow(2150, 170, 300 * w, '#FFE3A6', w);
    boilSeed('hills');
    paint(ellPts(900, WL + 220, 2600, 420, 40, 2), { wash: mixCol(C.hillCold, C.hillWarm, w), ink: PAL.ink, sw: .6 });
    paint(ellPts(2900, WL + 180, 1500, 360, 32, 2), { wash: mixCol(mixCol(C.hillCold, PAL.indigo, .15), C.hillWarm, w * .8), ink: PAL.ink, sw: .6 });
  }

  function water(t) {
    const w = warm(t);
    boilSeed('water');
    paint(rectPts(-3000, WL - 22, 9000, 1400), { wash: mixCol(C.water, '#5AAFA9', w * .4), ink: null });
    paint(rectPts(-3000, WL + 150, 9000, 1300), { wash: mixCol(C.water, C.waterDk, .45), ink: null });   // deeper water nearer the camera
    inkLine([[-3000, WL - 22], [800, WL - 24], [4000, WL - 21]], .8, PAL.ink, 'ink', .5);
    flow(t, -Infinity, Infinity);
    pool();
  }
  // the current: short light strokes drifting downstream (to the right), each on its own seed
  function flow(t, x0, x1) {
    const w = warm(t);
    for (let i = 0; i < 34; i++) {
      const row = hash(i + 40), y = WL - 10 + row * 170, span = 3800;
      const x = -600 + ((hash(i) * span + t * (40 + 50 * row)) % span), l = 40 + 70 * hash(i + 80);
      if (x + l < x0 || x > x1 || (x0 > -Infinity && y < WL)) continue;
      boilSeed('flow' + i);
      paint(ribbon([[x, y], [x + l * .5, y - 2], [x + l, y]], 2.2, .8), { wash: mixCol(C.foam, C.water, .45 - .2 * w), ink: null });
      if (w > .3 && i % 3 === 0) glow(x + l / 2, y, 14 + 10 * hash(i + 7), '#FFF0C8', (w - .3) * .6);
    }
  }
  // the deep pool of shot E: darker water, all of it under the surface line
  function pool() {
    boilSeed('pool');
    paint(ellPts(MX(JUMP.xTo), WL + 44, 290, 30, 26, 4), { fill: C.waterDk, fillOp: 140, bleed: .15, tex: .5, ink: null });
  }

  // o.flower: flower options (lean, bob) for a shot that acts with it
  function banks(t, o = {}) {
    boilSeed('bankL');
    const L = BANK_L;
    paint([[-3000, BANK + 4], [L - 140, BANK], [L - 20, BANK + 2], [L + 18, WL + 6], [L + 30, WL + 40], [L - 10, H + 900], [-3000, H + 900]],
      { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: null });
    paint([[L - 34, BANK + 8], [L + 12, WL + 4], [L + 28, WL + 40], [L - 4, WL + 60]], { wash: C.soil, ink: null });
    bankEdges(L, -1);
    ledge(t);
    boilSeed('bankR');
    const R = BANK_R;
    paint([[4000, BANK + 2], [R + 140, BANK], [R + 20, BANK + 2], [R - 18, WL + 6], [R - 30, WL + 40], [R + 10, H + 900], [4000, H + 900]],
      { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: null });
    bankEdges(R, 1);
    // grass tufts, swaying
    for (const [x0, n, key, y] of [[-900, 30, 'tL', BANK], [LEDGE.x0 + 740, 24, 'tR', BANK], [LEDGE.x0 + 30, 9, 'tT', LEDGE.top]]) {
      for (let i = 0; i < n; i++) {
        boilSeed(key + i);
        const x = x0 + i * 38 + 20 * hash(i + x0), sw = wob(t, .4, hash(i) * 3) * 4;
        for (const k of [-1, 0, 1]) inkLine([[x + k * 6, y + 2], [x + k * 9 + sw, y - 16 - 8 * hash(i + k + 3)]], .6, mixCol(C.grass, PAL.cream, .3), 'inkfine', .4);
      }
    }
    flower(t, FLOWER.x, FLOWER.y, o.flower);
  }

  // A bank's visible edges, as lines no bigger than the canvas (outlines of the huge bank polygons don't survive a
  // zoomed camera): the top, and the side facing the water. side = -1 for the near (left) bank, 1 for the far one.
  function bankEdges(x, side) {
    boilSeed('edge' + side);
    const s = side;
    inkLine([[x + s * 1000, BANK + 5], [x + s * 520, BANK + 2], [x + s * 140, BANK], [x + s * 20, BANK + 2]], 1, PAL.ink, 'ink', .3);
    inkLine([[x + s * 20, BANK + 2], [x - s * 18, WL + 6], [x - s * 30, WL + 40], [x - s * 12, WL + 300], [x + s * 10, H + 500]], 1, PAL.ink, 'ink', .4);
  }

  // The far bank rises into a grassy ledge at the back of the water, its front cut into an earth face by the stream.
  // The flower grows on top, and at the end Clawd sits on its lip with its feet dangling over the water.
  const X0 = BANK_R - 430;
  const LEDGE = { x0: X0, x1: X0 + 450, top: 548, base: WL - 18 };
  // the grass line along the top, left to right: a lip over the water, a flat top, a long slope down into the bank
  const LEDGE_TOP = (() => {
    const { x0, top } = LEDGE;
    return [[x0 - 8, top + 34], [x0 + 8, top + 11], [x0 + 45, top + 2], [x0 + 150, top - 3], [x0 + 260, top - 2], [x0 + 350, top + 6],
      [x0 + 430, top + 26], [x0 + 520, top + 66], [x0 + 620, BANK - 4], [x0 + 720, BANK + 3]];
  })();
  // the height of the ledge's grass line at x
  const ledgeY = (x) => { const P = LEDGE_TOP; let i = 0; while (i < P.length - 2 && x > P[i + 1][0]) i++; return lerp(P[i][1], P[i + 1][1], clamp((x - P[i][0]) / (P[i + 1][0] - P[i][0]))); };
  const FLOWER = { x: X0 + 380, y: ledgeY(X0 + 380) + 2 };
  function ledge(t) {
    const { x0, x1, top, base } = LEDGE, P = LEDGE_TOP;
    boilSeed('ledge');
    // the mound, all grass
    paint([...P, [x0 + 720, base + 30], [x0 - 4, base + 4]], { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: PAL.ink, sw: 1 });
    // where the stream has cut into it: an earth face under an overhanging lip of turf
    const face = [[x0 - 2, top + 30], [x0 + 60, top + 20], [x0 + 200, top + 16], [x1 - 100, top + 22], [x1 - 40, top + 40], [x1 - 22, top + 90], [x1 - 6, base + 3],
      [x0 + 250, base + 5], [x0 + 6, base + 3], [x0 - 6, base - 34], [x0 - 12, top + 74]];
    paint(face, { wash: C.soil, fill: mixCol(C.soil, PAL.ink, .4), fillOp: 100, bleed: .08, tex: .8, ink: PAL.ink, sw: .8 });
    paint([[x0 + 2, base - 26], [x1 - 14, base - 22], [x1 - 6, base + 3], [x0 + 6, base + 3]], { fill: mixCol(C.soil, PAL.ink, .6), fillOp: 120, bleed: .1, tex: .6, ink: null });
    for (let i = 0; i < 3; i++) {   // a few stones in the earth
      const px = x0 + 70 + i * 140 + 40 * hash(i + 20), py = top + 70 + 45 * hash(i + 30);
      paint(ellPts(px, py, 8 + 5 * hash(i + 40), 6 + 3 * hash(i + 50), 12, 1, .3 * hash(i)), { wash: C.stone, ink: PAL.ink, sw: .4 });
    }
    for (let i = 0; i < 7; i++) {   // roots hanging out from under the lip
      boilSeed('root' + i);
      const rx = x0 + 22 + i * 58 + 20 * hash(i + 70), ry = top + 22, l = 14 + 22 * hash(i + 80), s = wob(t, .3, hash(i)) * 1.5;
      inkLine([[rx, ry], [rx + 4 + s, ry + l * .5], [rx - 2 + s * 2, ry + l]], .6, mixCol(C.soil, PAL.ink, .65), 'inkfine', .5);
    }
    boilSeed('ledgeLip');   // the turf lip over the face
    paint([...P.slice(0, 7), [x0 + 430, top + 38], [x0 + 300, top + 26], [x0 + 150, top + 24], [x0 + 40, top + 30], [x0 + 6, top + 44]],
      { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: PAL.ink, sw: 1 });
    boilSeed('ledgeFoam');
    paint(ribbon([[x0 + 4, base + 6], [x0 + 200, base + 8], [x1 - 10, base + 7]], 2.6, 1.2), { wash: mixCol(C.foam, C.water, .3), ink: null });
  }

  // The flower. o.lean tips its head (radians, + to the right), o.bob nods it down (px).
  function flower(t, x, y, o = {}) {
    boilSeed('flower');
    const { hx, hy } = flowerHead(t, x, y, o);
    inkLine([[x, y], [lerp(x, hx, .35) + 2, y - 60], [hx, hy]], 1.1, '#4F7A3A', 'ink', .6);
    paint(ellPts(x + 16, y - 50, 16, 7, 12, 1, -.5), { wash: C.grass, ink: PAL.ink, sw: .5 });
    paint(ellPts(x - 13, y - 30, 13, 6, 12, 1, .5), { wash: C.grass, ink: PAL.ink, sw: .5 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + .3 + (o.lean || 0);
      paint(ellPts(hx + Math.cos(a) * 17, hy + Math.sin(a) * 17, 15, 9, 12, 1, a), { wash: PAL.rose, ink: PAL.ink, sw: .6 });
    }
    paint(ellPts(hx, hy, 9, 9, 12, 1), { wash: PAL.ochre, ink: PAL.ink, sw: .6 });
  }
  // the flower catching the light for a moment (from t0, `len` s), to draw the eye to it
  function flowerGlint(t, t0, o = {}, len = .7) {
    const k = seg(t, t0, t0 + len);
    if (k <= 0 || k >= 1) return;
    const { hx, hy } = flowerHead(t, FLOWER.x, FLOWER.y, o), a = Math.sin(k * Math.PI);
    boilSeed('glint');
    glow(hx, hy, 70 * a, '#FFE9B0', .9 * a);
    paint(starPts(hx + 14, hy - 16, 16 * a, .3, 4, k * 2), { wash: PAL.cream, ink: null });
  }
  function flowerHead(t, x = FLOWER.x, y = FLOWER.y, o = {}) {
    const sway = wob(t, .35) * 5, l = o.lean || 0, len = 118;
    return { hx: x + sway + Math.sin(l) * len, hy: y - Math.cos(l) * len + (o.bob || 0) };
  }

  // the stones in the stream: one between the trot and the pool (Clawd jumps over it), one at the foot of the ledge
  function stones() { stone(MX(.2), WL - 14, 90, 's1'); stone(X0 - 70, WL - 10, 70, 's2'); }
  function stone(x, top, w, key) {
    boilSeed(key);
    paint([[x - w / 2, WL + 20], [x - w / 2 + 10, top + 16], [x - w / 4, top], [x + w / 3, top + 2], [x + w / 2 - 6, top + 18], [x + w / 2, WL + 24]],
      { wash: C.stone, fill: C.stoneDk, fillOp: 90, bleed: .08, tex: .6, ink: PAL.ink, sw: .9 });
  }


  Object.assign(PLK, { sky, water, flow, pool, banks, flower, flowerHead, flowerGlint, stone, stones, LEDGE, FLOWER, ledgeY });
})();
