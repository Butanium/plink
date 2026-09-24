// shot_f.js: shot F, the far bank. It picks up E's take without a cut: Clawd remembers the flower, bounds out of the
// pool to the ledge it grows on, hops up and sits on the lip with its feet dangling over the water, and one last drop
// gathers on a foot and falls: plink, like the first. Starts at story.json shots.F; beats come from PLK.beat().
(() => {
  const { S, G, ZM, MX, WL, BED, POOL, U, C, JUMP, DRIP, beat, mark, wade, sky, water, banks, stones, FLOWER, flowerGlint, ledgeY,
    ring, landings, bubbles, splashes, falls, noteGlyph, withLegs, collars } = PLK;

  // A smooth path through keys [[t, v], ...] (v a number or an array): Catmull-Rom tangents, at rest at both ends.
  function glide(t, keys) {
    const n = keys.length;
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0; while (t >= keys[i + 1][0]) i++;
    const arr = Array.isArray(keys[0][1]), val = (j, c) => arr ? keys[j][1][c] : keys[j][1];
    const slope = (j, c) => j === 0 || j === n - 1 ? 0 : (val(j + 1, c) - val(j - 1, c)) / (keys[j + 1][0] - keys[j - 1][0]);
    const t0 = keys[i][0], h = keys[i + 1][0] - t0, s = (t - t0) / h;
    const at = (c) => (2 * s ** 3 - 3 * s ** 2 + 1) * val(i, c) + (s ** 3 - 2 * s ** 2 + s) * h * slope(i, c)
      + (3 * s ** 2 - 2 * s ** 3) * val(i + 1, c) + (s ** 3 - s ** 2) * h * slope(i + 1, c);
    return arr ? keys[0][1].map((_, c) => at(c)) : at(0);
  }

  // ------------------------------------------------------------ where things are
  // The last drop: it hangs from the tip of the front-view leg at x = 1..2u (index 2) and falls from where story.json
  // says (drip.x, drip.h), so the foot is placed from the drip, and the seat from the foot.
  const DROP = S.falls.find((f) => Math.abs(f.t - DRIP.t) < 1e-3), R_DROP = clamp(DROP.a * 2.2, 3, 9);
  const LEG = 2, LEG_H = 2.1;                                     // the dripping leg, and how far the legs dangle (u)
  const X_TIP = MX(DRIP.x), Y_TIP = WL - ZM * DRIP.h - 2.1 * R_DROP;
  const X_SIT = X_TIP - 1.5 * U, GY_SIT = Y_TIP - (LEG_H - .05) * U + 2 * U;   // Clawd's ground point when seated
  const GY_STAND = ledgeY(X_SIT) + 3;                                           // standing on the lip, before sitting
  // The bounds out of the pool: each lands on its step mark (its splash, and one note of the melody) and takes off
  // where the last one landed, when the feet leave the water (its exit mark). The last landing is the hop spot.
  const X_POOL = MX(JUMP.xTo);
  const LANDS = ['F.wade0', 'F.wade1', 'F.wade2'].map((b) => mark(b, 'step'));
  const UPS = S.marks.filter((m) => m.kind === 'exit' && /^F\.(go|wade\d)$/.test(m.beat)).sort((a, b) => a.t - b.t);
  if (UPS.length !== LANDS.length) throw new Error(`shot F: ${UPS.length} exit marks for ${LANDS.length} bounds (story.json cues)`);
  const BOUNDS = LANDS.map((m, k) => ({ up: UPS[k].t, down: m.t, x0: k ? MX(LANDS[k - 1].x) : X_POOL, x1: MX(m.x) }));
  const X_HOP = BOUNDS[BOUNDS.length - 1].x1;
  const ground = (x) => lerp(POOL, BED, ease(seg(x, X_POOL + 60, X_HOP)));      // out of the deep pool into the shallows
  const TUCK = [[-.3, -.95], [.35, -.95], [-.35, -.85], [.3, -.85]];            // legs in the air (dx, dh in u), as in E

  const tLook = beat('F.look'), tGo = BOUNDS[0].up, tLanded = BOUNDS[BOUNDS.length - 1].down;
  const tHop = beat('F.hop'), tPerch = beat('F.perch'), tSit = beat('F.sit'), tGather = beat('F.gather'), tLove = beat('F.love');
  const tFall = DRIP.t - Math.sqrt(2 * DRIP.h / G);

  // Clawd's legs when not wading: each hangs from its hip and swings by swing(i) radians; cut at the waterline if clip
  function dangle(o, { gy, swing = () => 0, clip = false }) {
    const V = VIEWS[o.view || 'front'], { dk } = tintCols(o), far = mixCol(dk, PAL.ink, .22);
    const sq = (o.sq || 0) + (o.take || 0), cut = clip ? (WL - (gy + (o.dy || 0) * U)) / ((1 - sq) * (o.sy ?? 1)) : Infinity;
    return { ...o, noLegs: true, draw: (u, sw) => V.legs.forEach(([lx, isFar], i) => {
      const top = -2.05 * u, len = Math.min(LEG_H * u, cut - top);
      if (len < 1.5) return;
      boilSeed(`leg ${o.boilKey} ${i}`);
      push(); translate((lx + .5) * u, top); rotate(swing(i));
      paint(rectPts(-.5 * u, 0, u, len, u * .04), { wash: isFar ? far : dk, washOp: 255, ink: PAL.ink, sw: sw * .8 });
      pop();
    }) };
  }

  const moodKeys = [[beat('E.laugh'), 'laugh'], [tLook, 'hopeful', { lookX: 1, lookY: -.8 }], [tGo - .2, 'happy', { lookX: .6, lookY: -.3 }],
    [tHop - .4, 'determined', { lookX: .3, lookY: -1 }], [tSit + .05, 'relieved', { emote: null }], [tGather, 'neutral', { lookX: .45, lookY: 1 }],
    [tLove, 'love']];

  // Clawd in the water: looking up at the flower, then bounding out of the pool. Returns { x, gy, o, legs }.
  function waterPose(t) {
    const mood = emotions(t, moodKeys);
    let x = X_POOL, dy = 0, sq = 0, tuck = 0;
    for (const b of BOUNDS) {
      const j = jump(t, b.up, b.down, 1.4);
      dy += j.dy; sq += j.sq;
      if (t >= b.up) x = lerp(b.x0, b.x1, ease(seg(t, b.up, b.down)));
      if (t > b.up && t < b.down) tuck = seg(t, b.up, b.up + .07) * (1 - seg(t, b.down - .09, b.down));
    }
    const crouch = .22 * ease(seg(t, tHop - .2, tHop - .02));
    const face = turn(t, tGo - .2, tGo - .08, .125, .25);
    const k = t < tGo - .2 ? .35 : .25, lift = {};
    TUCK.forEach(([dx, dh], i) => { lift[i] = { dx: dx * tuck, dh: dh * tuck }; });
    const o = { ...mood, ...face, boilKey: 'clawd', noShadow: true, dx: (mood.dx || 0) * k, dy: (mood.dy || 0) * k + dy,
      sq: (mood.sq || 0) + sq + crouch, aL: tuck > 0 ? lerp(mood.aL ?? .2, 1.1, tuck) : mood.aL };
    return { x, gy: ground(x), o, legs: { lift, gy: ground(x) } };
  }
  // The hop up onto the ledge, turning to face us in the air; it lands standing on the lip, then plops down to sit.
  // Returns { x, gy, o, swing } (swing(i): how far dangling leg i swings, in radians).
  function ledgePose(t) {
    const mood = emotions(t, moodKeys);
    const still = kf(t, [[tSit, .4], [tGather + .2, .4], [tGather + .5, 0], [tLove, 0], [tLove + .3, .6]]);   // calm while the drop gathers
    const k = seg(t, tHop, tPerch), fly = t < tPerch, sat = t >= tSit;
    const x = lerp(X_HOP, X_SIT, ease(k));
    const gy = fly ? lerp(ground(X_HOP), GY_STAND, k) - 1.4 * U * 4 * k * (1 - k) : lerp(GY_STAND, GY_SIT, easeIn(seg(t, tPerch + .06, tSit)));
    const sq = fly ? -.16 * Math.sin(Math.PI * Math.min(1, k * 1.4))
      : sat ? .26 * Math.exp(-7 * (t - tSit)) * Math.cos(17 * (t - tSit)) : .14 * Math.exp(-12 * (t - tPerch)) * Math.cos(22 * (t - tPerch));
    const face = turn(t, tHop + .08, tHop + .28, .25, 0);
    const swingA = fly ? .35 * Math.sin(Math.PI * k) : !sat ? 0 : kf(t, [[tSit, .5], [tSit + .5, .28], [tGather, .22], [tGather + .35, 0], [tLove, 0], [tLove + .4, .3]]);
    const swing = (i) => fly ? -swingA * (i % 2 ? .8 : 1) : !sat ? 0 : swingA * Math.sin(TAU * 1.25 * (t - tSit) + [0, 2.8, .5, 3.4][i]) + (i === LEG ? 0 : .02 * Math.sin(t * 3 + i));
    const tot = sq + (mood.sq || 0) * still;
    const o = { ...mood, ...face, boilKey: 'clawd', noShadow: true, sq: tot, dx: (mood.dx || 0) * still, rot: (mood.rot || 0) * still,
      dy: !sat ? 0 : (mood.dy || 0) * still * .5 - 2 * tot };
    return { x, gy, o, swing };
  }
  // Clawd at any time of the shot, in the { x, gy, o, legs } form E uses (the dangling legs counted straight down)
  const DANGLE = { dx: 0, dh: LEG_H - 1.85 };
  function pose(t) {
    if (t < tLook) return wade.jumpPose(t);
    if (t < tHop) return waterPose(t);
    const P = ledgePose(t);
    return { x: P.x, gy: P.gy, o: P.o, legs: { lift: [DANGLE, DANGLE, DANGLE, DANGLE], gy: P.gy } };
  }
  // the drops shaken off the feet on each takeoff fall from where a foot really is (not from the synth's 3–35 cm)
  wade.placeFalls(pose, [...UPS, mark('F.hop', 'exit')]);

  // The melody's notes (SCORE.notes): each bound's note skims out behind Clawd from its splash and floats up, higher for a
  // higher note (as the trot's do); the last drop's note pops off its ring.
  function melody(t) {
    const s = 8 * clamp(2.6 / CAM.zoom, 1, 2);
    for (const n of S.notes) {
      const a = t - n.t, bound = /^F\.wade\d$/.test(n.beat);
      if (!(bound || n.beat === 'F.drip') || a <= 0 || a >= .9) continue;
      const out = easeOut(seg(a, 0, .22)), up = easeOut(seg(a, .08, .9)) * (40 + 36 * Math.log2(n.f / 880));
      noteGlyph(MX(n.x) + (bound ? -95 : 30) * out, WL - 14 - up, s, a / .9, 'note ' + n.beat);
    }
  }

  // ------------------------------------------------------------ F: the far bank
  function shotF(t, lt, dur) {
    const end = t - lt + dur, ts = t - lt;
    // camera: E's own at first, handing over over a second (no bump in the motion); along with the bounds and up to the
    // ledge; down to the dangling foot for the drop (as close as B was to the toe), then back up to the face, as B did
    const own = glide(t, [[ts, wade.wadeCam(ts)], [tLanded + .1, [X_HOP + 60, WL - 200, 1.3]],
      [tSit + .5, [X_SIT + 70, GY_SIT - 20, 1.75]], [tGather + .05, [X_SIT + 70, GY_SIT - 15, 1.8]],
      [tGather + .65, [X_TIP + 15, (Y_TIP + WL) / 2 + 8, 3.2]], [DRIP.t + .3, [X_TIP + 15, (Y_TIP + WL) / 2 + 12, 3.25]],
      [DRIP.t + .85, [X_SIT + 75, GY_SIT - 110, 2.3]], [end, [X_SIT + 80, GY_SIT - 115, 2.4]]]);
    const hand = ease(seg(t, ts, ts + 1)), e = hand < 1 ? wade.wadeCam(t) : own;
    camBegin(...own.map((v, i) => lerp(e[i], v, hand)));
    const lean = kf(t, [[tSit, 0], [tSit + .6, -.1], [tLove, -.1], [tLove + .5, -.16]]) + .05 * spring(t, tLove + .1, 4, 9);
    sky(t); water(t); banks(t, { flower: { lean, bob: 6 * spring(t, tLove + .1, 4, 9) } }); stones();
    flowerGlint(t, tLook + .05, { lean });   // it catches the light as Clawd looks up at it
    landings(t); bubbles(t, 120); splashes(t, false); falls(t);

    // ---- Clawd
    let P;
    if (t < tHop) P = t < tLook ? wade.jumpPose(Math.max(t, ts)) : waterPose(t);   // before the look, still E's take
    else { const L = ledgePose(t); P = { x: L.x, gy: L.gy, o: dangle(L.o, { gy: L.gy, swing: L.swing, clip: L.gy > WL - LEG_H * U }) }; }
    clawd(P.x, P.gy, U, P.legs ? withLegs(P.o, P.legs) : P.o);
    if (P.legs) collars(P.x, P.o, P.legs, t);
    splashes(t, true);
    melody(t);

    // ---- the last drop: it gathers at the tip of the still foot, hangs, and lets go (falls() paints its fall and ring)
    if (t > tGather && t < tFall) {
      boilSeed('gather');
      const r = R_DROP * ease(seg(t, tGather + .15, tFall - .12)) * (1 + .06 * Math.sin((t - tGather) * 14) * seg(t, tFall - .3, tFall));
      if (r > .8) {
        const y = Y_TIP + 2.1 * r;
        paint([[X_TIP, y - r * 2.1], [X_TIP + r * .5, y - r * 1.1], [X_TIP + r * .95, y - r * .1], [X_TIP + r * .6, y + r * .75], [X_TIP, y + r],
          [X_TIP - r * .6, y + r * .75], [X_TIP - r * .95, y - r * .1], [X_TIP - r * .5, y - r * 1.1]], { wash: mixCol(C.foam, C.water, .15), ink: PAL.ink, sw: .4 });
        if (r > 3) paint(ellPts(X_TIP - r * .35, y - r * .25, r * .22, r * .3, 8), { wash: PAL.cream, ink: null });
      }
    }
    // its bubble, under the ring: one plink, like the first
    const bk = seg(t, DRIP.t, DRIP.t + .36);
    if (t >= DRIP.t && bk < 1) {
      boilSeed('dripb');
      const r = 11 * (1 + .2 * bk) * backOut(Math.min(1, bk * 5)), y = WL + 22 - 20 * easeOut(bk);
      paint(ellPts(X_TIP + 2 * Math.sin(bk * 9), y, r, r * (1 - .1 * Math.sin(bk * 20)), 14), { wash: C.foam, washOp: 150, ink: PAL.ink, sw: .45 });
      paint(ellPts(X_TIP - r * .35, y - r * .4, r * .25, r * .18, 8), { wash: PAL.cream, ink: null });
    }
    if (t >= DRIP.t + .36) ring(X_TIP, WL + 2, 3 + 26 * seg(t, DRIP.t + .36, DRIP.t + .75), seg(t, DRIP.t + .36, DRIP.t + .75), 'drippop');

    const irisAt = toScreen((X_SIT + FLOWER.x) / 2 - 35, GY_SIT - 5 * U);
    camEnd();
    const tIris = beat('F.iris');
    if (t > tIris) iris(...irisAt, t < end - .3 ? lerp(1500, 470, ease(seg(t, tIris, end - .6))) : lerp(470, 0, easeIn(seg(t, end - .3, end - .08))));
  }

  PLK.shot = PLK.shot || {};
  PLK.shot.F = shotF;
})();
