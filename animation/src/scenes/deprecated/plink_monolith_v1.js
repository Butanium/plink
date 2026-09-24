// plink.js: "Plink" (see STORYBOARD.md). Clawd means to cross a stream without getting wet, falls for the sound of
// its first toe-tap, and splashes all the way across.
//
// Every splash, droplet, bubble and drip here is drawn from SCORE (plink_score.js): the same physical events that
// synthesize assets/plink.wav. A droplet is painted on its real flight (launched at tl, landing at tLand, so its
// ring appears on the frame its tick sounds), each bubble lives as long as it rings, each footfall's crown rises
// when its slap sounds. Only events loud enough to hear are in SCORE, so only those get painted.
(() => {
  const S = SCORE;
  const G = 9.81;
  const PXM = 900, ZM = 1300;              // px per metre along the stream, and for heights (arcs drawn a touch tall)
  const MX = (m) => 560 + m * PXM;         // world x (px) of a stream position (m)
  const WL = 700;                          // Clawd's waterline; the water's far edge sits a little higher
  const BANK = WL - 26, BED = WL + 30, POOL = WL + 53;
  const BANK_L = MX(-0.4), BANK_R = MX(2.2);
  const U = 24;                            // Clawd's size in the world: the camera zooms, Clawd doesn't
  const C = {
    skyCold: '#B6C6CC', skyWarm: '#F4D8A2', hillCold: '#7F9C90', hillWarm: '#9EB86E', grass: '#7AA159',
    soil: '#8B6F54', water: '#4E9EA4', waterDk: '#2F737B', foam: '#EEF7F3', stone: '#A6A194', stoneDk: '#7E796D',
  };
  const warm = (t) => ease(seg(t, 11.4, 15.8));
  S.drops.forEach((d, i) => { d.id = i; d.xl = d.x0 + d.vx * (d.tLand - d.tl); });
  S.falls.forEach((f, i) => { f.id = i; });
  S.bubbles.forEach((b, i) => { b.id = i; });
  const STEPS = S.marks.filter((m) => m.kind === 'step');
  const TROT = S.trot, JUMP = S.jump, DIP = S.dip, DRIP = S.marks.find((m) => m.kind === 'drip');

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

  function banks(t) {
    boilSeed('bankL');
    const L = BANK_L;
    paint([[-3000, BANK + 4], [L - 140, BANK], [L - 20, BANK + 2], [L + 18, WL + 6], [L + 30, WL + 40], [L - 10, H + 900], [-3000, H + 900]],
      { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: PAL.ink, sw: 1 });
    paint([[L - 34, BANK + 8], [L + 12, WL + 4], [L + 28, WL + 40], [L - 4, WL + 60]], { wash: C.soil, ink: null });
    boilSeed('bankR');
    const R = BANK_R;
    paint([[4000, BANK + 2], [R + 140, BANK], [R + 20, BANK + 2], [R - 18, WL + 6], [R - 30, WL + 40], [R + 10, H + 900], [4000, H + 900]],
      { wash: C.grass, fill: mixCol(C.grass, PAL.ink, .3), fillOp: 70, bleed: .06, tex: .5, ink: PAL.ink, sw: 1 });
    // grass tufts, swaying; the flower Clawd wants waits on the far bank
    for (const [x0, n, key] of [[-900, 30, 'tL'], [R + 40, 30, 'tR']]) {
      for (let i = 0; i < n; i++) {
        boilSeed(key + i);
        const x = x0 + i * 38 + 20 * hash(i + x0), sw = wob(t, .4, hash(i) * 3) * 4;
        for (const k of [-1, 0, 1]) inkLine([[x + k * 6, BANK + 2], [x + k * 9 + sw, BANK - 16 - 8 * hash(i + k + 3)]], .6, mixCol(C.grass, PAL.cream, .3), 'inkfine', .4);
      }
    }
    flower(t, MX(2.5), BANK);
  }

  function flower(t, x, y) {
    boilSeed('flower');
    const sway = wob(t, .35) * 5, hx = x + sway, hy = y - 118;
    inkLine([[x, y], [x + sway * .5, y - 60], [hx, hy]], 1.1, '#4F7A3A', 'ink', .6);
    paint(ellPts(x + 16, y - 50, 16, 7, 12, 1, -.5), { wash: C.grass, ink: PAL.ink, sw: .5 });
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + .3;
      paint(ellPts(hx + Math.cos(a) * 17, hy + Math.sin(a) * 17, 15, 9, 12, 1, a), { wash: PAL.rose, ink: PAL.ink, sw: .6 });
    }
    paint(ellPts(hx, hy, 9, 9, 12, 1), { wash: PAL.ochre, ink: PAL.ink, sw: .6 });
  }

  function stone(x, top, w, key) {
    boilSeed(key);
    paint([[x - w / 2, WL + 20], [x - w / 2 + 10, top + 16], [x - w / 4, top], [x + w / 3, top + 2], [x + w / 2 - 6, top + 18], [x + w / 2, WL + 24]],
      { wash: C.stone, fill: C.stoneDk, fillOp: 90, bleed: .08, tex: .6, ink: PAL.ink, sw: .9 });
  }

  // ------------------------------------------------------------ the water's events (all from SCORE)
  // Light marks on the water are painted as thin washes: p5.brush mixes ink like pigment, so a pale line over the
  // darker water all but vanishes (only its ends show).
  function arc(x, y, r, a0, a1, w, col, n = 12) {
    const P = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([x + Math.cos(a) * r, y + Math.sin(a) * r * .28]); }
    paint(ribbon(P, w, w * .8), { wash: col, ink: null });
  }
  function ring(x, y, r, k, key) {
    if (k < 0 || k > 1 || r < 1) return;
    boilSeed(key);
    const col = mixCol(C.foam, C.water, k * .8), w = Math.max(.9, 3 * (1 - k)) * clamp(r / 30, .7, 1.6);
    arc(x, y, r, .12, Math.PI - .12, w, col);                    // the near half of the ring
    arc(x, y, r, Math.PI + .2, TAU - .2, w * .6, col, 10);       // the far half, thinner
  }

  // Each thrown drop on its flight. `front` picks the drops on the camera's side of the foot (drawn over Clawd).
  function drops(t, front, cap = 260) {
    const live = S.drops.filter((d) => t >= d.tl && t <= d.tLand && (d.front >= 0) === front);
    live.sort((a, b) => b.amp - a.amp);
    for (const d of live.slice(0, cap)) {
      const T = d.tLand - d.tl, s = t - d.tl;
      const x = MX(d.x0 + d.vx * s), y = WL + d.front * 12 - ZM * d.vz * s * (1 - s / T);
      const vy = -ZM * d.vz * (1 - 2 * s / T), vx = PXM * d.vx, ang = Math.atan2(vy, vx);
      const r = clamp(d.a * 1.9, 2.2, 11), stretch = 1 + clamp(Math.hypot(vx, vy) / 1400, 0, 1.4);
      boilSeed('d' + d.id);
      paint(ellPts(x, y, r * stretch, r * .75, 10, 0, ang), { wash: mixCol(C.foam, C.water, .12), ink: r > 7 ? mixCol(PAL.ink, C.water, .4) : null, sw: .3 });
    }
  }
  // A drop's ring is born on the frame it lands, the frame its tick sounds.
  function landings(t) {
    for (const d of S.drops) {
      const a = t - d.tLand;
      if (a < 0 || a > .55 || d.a < .7) continue;
      ring(MX(d.xl), WL + d.front * 12, (5 + 60 * Math.sqrt(a / .55)) * Math.sqrt(d.a / 2), a / .55, 'r' + d.id);
    }
  }
  // Bubbles rise to the surface around the foot and last as long as they ring (a little longer, to be seen).
  function bubbles(t, cap = 80) {
    const live = S.bubbles.filter((b) => t >= b.t && t <= b.t + Math.max(b.dur, .12) + .05);
    live.sort((a, b) => b.amp - a.amp);
    for (const b of live.slice(0, cap)) {
      const life = Math.max(b.dur, .12), k = (t - b.t) / life, x = MX(b.x) + (hash(b.id) - .5) * 30, y = WL + 2 + 10 * hash(b.id + 5);
      boilSeed('b' + b.id);
      if (k <= 1) {
        const r = clamp(b.r * 2.2, 2, 14) * backOut(Math.min(1, k * 4));
        paint(ellPts(x, y, r, r, 10), { wash: C.foam, washOp: 230, ink: PAL.ink, sw: .3 });
      } else ring(x, y, 6 + 40 * (k - 1), (k - 1) * 3, 'bp' + b.id);
    }
  }
  // The sheet of water a footfall throws up, rising with the slap and tearing into the drops.
  function crown(t, m, front) {
    const a = t - m.t, life = .18 + .06 * m.v;
    if (a < 0 || a > life) return;
    const k = a / life, x = MX(m.x), hgt = (20 + 12 * m.v * m.v) * Math.sin(Math.PI * Math.pow(k, .55)), w = 40 + 16 * m.v * m.v;
    boilSeed('crown' + m.t + front);
    // behind the foot the full sheet; in front of it only a low jagged lip, so the character stays readable
    const hh = hgt * (front ? .42 : 1), base = WL + (front ? 14 : -2);
    const n = m.v > 2 ? 11 : 7, pts = [[x - w * (.5 + .3 * k), base]];
    for (let i = 0; i <= n; i++) {
      const u = i / n, px = x + (u - .5) * w * (1 + .6 * k), tip = i % 2 ? .5 : 1;
      pts.push([px, base - hh * tip * (1 - .5 * Math.abs(u - .5)) * (.8 + .4 * hash(i + m.t))]);
    }
    pts.push([x + w * (.5 + .3 * k), base]);
    paint(pts, { wash: mixCol(C.foam, C.water, front ? .18 : .05), ink: mixCol(PAL.ink, C.water, .3), sw: .5 });
  }
  // Drips and blobs falling from a lifted foot: drawn from where they fell (height h) to the frame they land.
  function falls(t) {
    for (const f of S.falls) {
      const tf = Math.sqrt(2 * f.h / G), s = t - (f.t - tf), x = MX(f.x);
      if (s < 0 || s > tf + .6) continue;
      boilSeed('f' + f.id);
      if (s <= tf) {
        const y = WL - ZM * (f.h - .5 * G * s * s), r = clamp(f.a * 2.2, 3, 9);
        paint([[x, y - r * 2.1], [x + r * .5, y - r * 1.1], [x + r * .95, y - r * .1], [x + r * .6, y + r * .75], [x, y + r],
          [x - r * .6, y + r * .75], [x - r * .95, y - r * .1], [x - r * .5, y - r * 1.1]], { wash: mixCol(C.foam, C.water, .15), ink: PAL.ink, sw: .4 });
      } else ring(x, WL + 4, 6 + 55 * Math.sqrt((s - tf) / .6), (s - tf) / .6, 'fr' + f.id);
    }
  }
  function splashes(t, front) {
    for (const m of STEPS) crown(t, m, front);
    drops(t, front);
  }

  // ------------------------------------------------------------ Clawd, with legs we can place
  // Legs drawn by hand (through the draw hook) so a foot can reach, hover, dip or dangle, the legs can trot (the kit's
  // side-view walk, same formula), and whatever is below the waterline is simply not drawn: the water hides it.
  // lift[i] = { dx, dh } in u for leg i of the view's leg list (side view: far back, far front, near back, near front);
  // gy = the ground Clawd stands on (to find the waterline in the body's own coordinates).
  const WALK_PH = [0, .5, .5, 0];
  function legPose(i, lift, walk, view) {
    const L = lift[i] || {};
    let dx = L.dx || 0, h = 1.85 + (L.dh || 0);
    if (walk != null && view === 'side') { const ph = (walk + WALK_PH[i]) * TAU; dx += Math.sin(ph) * .55; h -= Math.max(0, Math.cos(ph)) * .8; }
    return { dx, h };
  }
  function withLegs(o, { lift = {}, walk = null, gy = null } = {}) {
    const view = o.view || 'front', V = VIEWS[view], { dk } = tintCols(o), far = mixCol(dk, PAL.ink, .22);
    const sq = (o.sq || 0) + (o.take || 0);
    const clip = gy == null ? Infinity : (WL - (gy + (o.dy || 0) * U)) / ((1 - sq) * (o.sy ?? 1));
    return { ...o, noLegs: true, draw: (u, sw) => V.legs.forEach(([lx, isFar], i) => {
      const { dx, h } = legPose(i, lift, walk, view), top = -2.05 * u, bottom = Math.min(top + h * u, clip);
      if (bottom - top < 1.5) return;
      boilSeed(`leg ${o.boilKey} ${i}`);
      paint(rectPts((lx + dx) * u, top, u, bottom - top, u * .04), { wash: isFar ? far : dk, washOp: 255, ink: PAL.ink, sw: sw * .8 });
    }) };
  }
  // where a leg meets the water, a little collar of foam (world coordinates, drawn after Clawd)
  function collars(x, o, { lift = {}, walk = null, gy }, t) {
    const V = VIEWS[o.view || 'front'], s = (o.flip ? -1 : 1) * (1 + ((o.sq || 0) + (o.take || 0)) * .6);
    const bodyBottom = gy + (o.dy || 0) * U - 2.05 * U * (1 - (o.sq || 0));
    V.legs.forEach(([lx, isFar], i) => {
      const { dx, h } = legPose(i, lift, walk, o.view || 'front');
      if (bodyBottom + h * U < WL || bodyBottom > WL) return;
      const cx = x + (lx + dx + .5) * U * s;
      boilSeed('collar' + i);
      arc(cx, WL + (isFar ? -2 : 3), U * .85, .1, Math.PI - .1, 2, mixCol(C.foam, C.water, isFar ? .35 : .1), 8);
      arc(cx, WL + (isFar ? -2 : 3), U * .85, Math.PI + .3, TAU - .3, 1.2, mixCol(C.foam, C.water, .4), 6);
    });
  }
  // The stream in front of Clawd's submerged part (drawn after Clawd).


  // Where each shot puts Clawd
  const X_BANK = MX(DIP.x) - (0.9 + .8 + .5) * U;         // on the near bank, near front foot able to reach the dip point
  const X_IN = MX(STEPS[0].x) - (0.9 + .55 + .5) * U;     // stomped in: that foot lands on the first splash
  const trotX = (t) => MX(TROT.x0 + TROT.speed * clamp(t - TROT.t0, -1, (TROT.n - 1) * TROT.interval));
  const trotWalk = (t) => .25 + (Math.min(t, TROT.t0 + (TROT.n - 1) * TROT.interval) - TROT.t0) / (2 * TROT.interval);

  // ------------------------------------------------------------ A: the bank (0 – 3.6)
  function shotA(t, lt, dur) {
    const cam = kf(lt, [[0, [1480, 430, .6]], [1.15, [1470, 430, .62]], [2.25, [330, 560, 1.55]], [dur, [300, 590, 1.85]]]);
    camBegin(...cam);
    sky(t); water(t); banks(t); stone(MX(0.5), WL - 14, 90, 's1'); stone(MX(1.7), WL - 10, 70, 's2');
    const mood = emotions(lt, [[0, 'hopeful', { lookX: .9, lookY: -.3 }], [1.25, 'nervous', { lookX: .8, lookY: .9 }]]);
    // the near front foot rises and reaches out over the water, hovering (anticipation for the cut)
    const up = backOut(seg(lt, 2.35, 3.0)), hover = wob(lt, 2.2) * .18 * up;
    const o = { ...mood, view: 'side', boilKey: 'clawd', lookX: mood.lookX, dy: (mood.dy || 0) * .5 };
    clawd(X_BANK, BANK, U, withLegs({ ...o, rot: -.06 * up }, { lift: { 3: { dx: .8 * up, dh: -1.3 * up + hover }, 2: { dx: -.2 * up } }, gy: BANK }));
    const eye = toScreen(X_BANK, BANK - 4 * U);
    camEnd();
    if (lt < .55) iris(...eye, lerp(0, 1600, easeIn(lt / .55)));
  }

  // ------------------------------------------------------------ B: the toe-tap (3.6 – 7.0)
  function shotB(t, lt, dur) {
    const xd = MX(DIP.x), tTouch = DIP.touch, tPlink = DIP.plink;
    const cam = kf(t, [[3.6, [xd + 30, WL - 18, 3.0]], [4.95, [xd + 34, WL - 12, 3.1]], [5.5, [X_BANK + 20, BANK - 5 * U, 2.5]], [7.0, [X_BANK + 30, BANK - 5 * U, 2.35]]]);
    camBegin(...cam);
    sky(t); water(t); banks(t);
    // the foot: down to the surface, a touch, back up
    const down = kf(t, [[3.6, 0], [tTouch, 1], [tTouch + .2, 1.03], [tPlink - .05, .55], [5.2, .1]]);
    const reach = { dx: .8, dh: -1.3 + down * 2.35 };
    const mood = emotions(t, [[3.6, 'nervous', { lookX: .8, lookY: .9 }], [tPlink + .12, 'surprised', { lookX: .6, lookY: .7 }],
                              [5.75, 'starstruck', { emote: 'music' }]]);
    const face = t < 5.3 ? { view: 'side' } : turn(t, 5.3, 5.5, .25, .125);
    clawd(X_BANK, BANK, U, withLegs({ ...mood, ...face, boilKey: 'clawd' }, { lift: face.view === 'side' ? { 3: reach, 2: { dx: -.2 } } : {}, gy: BANK }));
    // where the toe meets the water: rings, then one bubble pinched off as it lifts, floating up and popping
    for (const [i, t0] of [[0, tTouch], [1, tTouch + .16], [2, tPlink]]) ring(xd, WL + 2, 4 + 70 * Math.sqrt(seg(t, t0, t0 + 1.1)), seg(t, t0, t0 + 1.1), 'dipr' + i);
    const k = seg(t, tPlink, tPlink + .38);
    if (t >= tPlink && k < 1) {
      boilSeed('dipb');
      const r = DIP.r * 1000 * 4.2 * (1 + .25 * k), y = WL + 26 - 26 * easeOut(k);
      paint(ellPts(xd + 2 * Math.sin(k * 9), y, r, r * (1 - .12 * Math.sin(k * 20)), 16), { wash: C.foam, washOp: 150, ink: PAL.ink, sw: .45 });
      paint(ellPts(xd - r * .35, y - r * .4, r * .25, r * .18, 8), { wash: '#FFFFFF', ink: null });
    }
    if (t >= tPlink + .38) ring(xd, WL, 3 + 30 * seg(t, tPlink + .38, tPlink + .8), seg(t, tPlink + .38, tPlink + .8), 'dippop');
    camEnd();
  }

  // ------------------------------------------------------------ C: in on purpose (7.0 – 10.6)
  function shotC(t, lt, dur) {
    const tStep = STEPS[0].t;
    const cam = kf(t, [[7.0, [X_BANK + 30, BANK - 5 * U, 2.35]], [7.7, [X_IN + 40, WL - 150, 1.45]], [10.6, [X_IN + 60, WL - 150, 1.4]]]);
    const shake = t > tStep ? shakeXY(t, 5 * Math.exp(-(t - tStep) * 9)) : [0, 0];
    camBegin(cam[0] + shake[0], cam[1] + shake[1], cam[2]);
    sky(t); water(t); banks(t); stone(MX(0.5), WL - 14, 90, 's1');
    landings(t); bubbles(t); splashes(t, false); falls(t);
    // a hop from the bank into the water, landing on the slap
    const k = seg(t, tStep - .3, tStep), x = lerp(X_BANK, X_IN, ease(k)), gy = lerp(BANK, BED, easeIn(k));
    const hop = t < tStep ? { dy: -1.6 * 4 * k * (1 - k), sq: t < tStep - .3 ? .16 * ease(seg(t, tStep - .5, tStep - .3)) : -.12 } : { dy: 0, sq: .24 * Math.exp(-8 * (t - tStep)) * Math.cos(20 * (t - tStep)) };
    const mood = emotions(t, [[7.0, 'determined'], [tStep + .05, 'surprised'], [tStep + .6, 'laugh']]);
    const o = { ...mood, view: 'side', boilKey: 'clawd', noShadow: t > tStep - .1, dy: (mood.dy || 0) + hop.dy, sq: (mood.sq || 0) + hop.sq };
    const legs = { lift: t < tStep ? { 3: { dx: .55 * (1 - k), dh: -.6 }, 1: { dh: -.4 } } : {}, gy };
    clawd(x, gy, U, withLegs(o, legs));
    collars(x, o, legs, t);
    splashes(t, true);
    camEnd();
  }

  // ------------------------------------------------------------ D: the trot (10.6 – 15.8)
  function shotD(t, lt, dur) {
    const x = t < TROT.t0 ? lerp(X_IN, trotX(TROT.t0), ease(seg(t, 10.6, TROT.t0))) : trotX(t);
    const cam = [x + 120 + 40 * ease(seg(t, 14.3, 15.2)), WL - 140, 1.32 - .05 * seg(t, 14.4, 15.4)];
    camBegin(...cam);
    sky(t); water(t); banks(t); stone(MX(0.5), WL - 14, 90, 's1'); stone(MX(1.7), WL - 10, 70, 's2');
    landings(t); bubbles(t); splashes(t, false); falls(t);
    const mood = emotions(t, [[10.6, 'excited'], [12.4, 'playful'], [14.45, 'surprised', { lookX: .9, lookY: .2, emote: '!' }], [15.05, 'mischief', { lookX: .8 }]]);
    const bounce = t < 14.6 ? -Math.abs(Math.sin(trotWalk(t) * TAU)) * .35 : 0;
    const o = { ...mood, view: 'side', boilKey: 'clawd', noShadow: true, dy: (mood.dy || 0) * .5 + bounce };
    const legs = { walk: t < TROT.t0 - .36 ? 0 : trotWalk(t), gy: BED };
    clawd(x, BED, U, withLegs(o, legs));
    collars(x, o, legs, t);
    splashes(t, true);
    camEnd();
  }

  // ------------------------------------------------------------ E: the jump (15.8 – 18.4)
  function shotE(t, lt, dur) {
    const x0 = trotX(99), x1 = MX(JUMP.xTo), tUp = JUMP.takeoff, tDown = JUMP.land;
    const k = seg(t, tUp, tDown), x = lerp(x0, x1, ease(k)), gy = t < tDown ? lerp(BED, POOL, easeIn(k)) : POOL;
    const hop = jump(t, tUp, tDown, 5.5);
    const shake = t > tDown ? shakeXY(t, 12 * Math.exp(-(t - tDown) * 7)) : [0, 0];
    camBegin(lerp(x0 + 140, x1 + 40, ease(seg(t, tUp - .1, tDown + .1))) + shake[0], WL - 190 + shake[1], kf(t, [[15.8, 1.3], [tDown, 1.12], [18.4, 1.2]]));
    sky(t); water(t); banks(t); stone(MX(1.7), WL - 10, 70, 's2');
    landings(t); bubbles(t, 120); splashes(t, false); falls(t);
    const mood = emotions(t, [[15.8, 'determined'], [tUp, 'excited'], [tDown + .03, 'surprised'], [tDown + .5, 'laugh']]);
    const crouch = t < tUp ? .2 * ease(seg(t, 15.8, tUp - .05)) : 0;
    const o = { ...mood, view: t < tDown + .4 ? 'side' : 'q', boilKey: 'clawd', noShadow: true,
      dy: (mood.dy || 0) * .4 + hop.dy, sq: (mood.sq || 0) + hop.sq + crouch, aL: t > tUp && t < tDown ? 1.3 : mood.aL, aR: t > tUp && t < tDown ? 1.3 : mood.aR };
    const legs = { gy };
    clawd(x, gy, U, withLegs(o, legs));
    collars(x, o, legs, t);
    splashes(t, true);
    camEnd();
    boilSeed('wipe');
    if (lt > dur - .3) brushWipe((lt - (dur - .3)) / .6, [C.waterDk, C.water]);
  }

  // ------------------------------------------------------------ F: the last drop (18.4 – 21.5)
  function shotF(t, lt, dur) {
    const xd = MX(DRIP.x), tipY = WL - ZM * DRIP.h;          // the foot the drop falls from, straight above its ring
    const tf = Math.sqrt(2 * DRIP.h / G), tFall = DRIP.t - tf;
    const lift = .55, xc = xd - (3 + 1.3 + .5) * U, gy = tipY - lift * U + .2 * U;
    camBegin(xc + 80, (gy + WL) / 2 - 40, kf(t, [[18.4, 1.75], [21.5, 1.95]]));
    sky(t); water(t); banks(t);
    boilSeed('rock');
    const R = 96, rcx = xc - 20, rcy = gy + .82 * R;
    const rock = ellPts(rcx, rcy, R * 1.15, R, 30, 2).map(([px, py]) => [px, Math.min(py, WL + 6)]);
    paint(rock, { wash: C.stone, fill: C.stoneDk, fillOp: 110, bleed: .1, tex: .7, ink: PAL.ink, sw: 1 });
    paint(ellPts(rcx - 30, rcy - 40, 50, 22, 16, 2, -.2), { fill: '#C9C4B6', fillOp: 120, bleed: .2, tex: .5, ink: null });
    arc(rcx, WL + 6, R * 1.05, .1, Math.PI - .1, 2.4, mixCol(C.foam, C.water, .15));
    falls(t);
    const mood = emotions(t, [[18.4, 'relieved'], [19.3, 'hopeful', { lookX: .5, lookY: .95 }], [DRIP.t + .15, 'love']]);
    clawd(xc, gy, U, withLegs({ ...mood, view: 'front', boilKey: 'clawd', noShadow: true }, { lift: { 3: { dx: 1.3, dh: -lift + .05 * wob(t, .8) } } }));
    // the drop gathers at the tip of the foot, hangs, and lets go
    if (t > 19.2 && t < tFall) {
      boilSeed('gather');
      const r = 10 * ease(seg(t, 19.2, tFall - .08));
      paint([[xd, tipY - 1], [xd + r * .7, tipY + r * .5], [xd + r, tipY + r * 1.2], [xd + r * .6, tipY + r * 1.9], [xd, tipY + r * 2.1],
        [xd - r * .6, tipY + r * 1.9], [xd - r, tipY + r * 1.2], [xd - r * .7, tipY + r * .5]], { wash: mixCol(C.foam, C.water, .15), ink: PAL.ink, sw: .45 });
      if (r > 4) paint(ellPts(xd - r * .35, tipY + r * 1.05, r * .22, r * .3, 8), { wash: '#FFFFFF', ink: null });
    }
    // its bubble, under the ring: one plink, like the first
    const k = seg(t, DRIP.t, DRIP.t + .4);
    if (t >= DRIP.t && k < 1) {
      boilSeed('dripb');
      const r = 10 * (1 + .2 * k), y = WL + 24 - 24 * easeOut(k);
      paint(ellPts(xd, y, r, r, 14), { wash: C.foam, washOp: 150, ink: PAL.ink, sw: .45 });
    }
    const ringAt = toScreen(xd, WL + 4);
    camEnd();
    boilSeed('wipe');
    if (lt < .3) brushWipe(.5 + lt / .6, [C.waterDk, C.water]);
    const tIris = 20.45;
    if (t > tIris) iris(...ringAt, t < dur + 18.4 - .35 ? lerp(1600, 140, ease(seg(t, tIris, 21.1))) : lerp(140, 0, easeIn(seg(t, 21.15, 21.45))));
  }

  shots([[0, shotA], [3.6, shotB], [7.0, shotC], [10.6, shotD], [15.8, shotE], [18.4, shotF]]);
})();
