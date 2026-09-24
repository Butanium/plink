// shot_d.js: shot D, the trot, and what D and E share. D and E are one continuous take: Clawd high-steps across (each
// foot comes up out of the water dripping and slaps down into its own splash), stops, spots the deep pool and jumps
// in (shot_e.js). One camera, one mood timeline and one painter run through both. Beats come from PLK.beat().
(() => {
  const { S, G, PXM, ZM, MX, WL, BED, U, TROT, JUMP, beat, mark, X_IN, sky, water, banks, stones, landings, bubbles, falls, splashes, noteGlyph, bodyFrame, legSole, reachFor, withLegs, collars } = PLK;

  // ------------------------------------------------------------ the trot's footfalls (story.json "trot")
  // Footfall k lands at tDown(k): the near front foot for even k, the near back for odd k. Its foot left the water at
  // tUp(k) (`lift` s after the other foot landed) and it stays put on the bed until it lifts again: the body moves
  // over planted feet, so every splash, exit bubble and drip stays under the foot that made it.
  const D0 = S.story.shots.D, I = TROT.interval, N = TROT.n, T0 = TROT.t0;
  const tDown = (k) => T0 + k * I;
  const tUp = (k) => tDown(k) - I + TROT.lift;
  const bodyAt = (k) => MX(TROT.x0 + TROT.speed * I * k);                       // body x at footfall k
  const footAt = (k) => bodyAt(k) + TROT.feet[k % 2] * PXM;                    // where footfall k's foot lands
  const tEnd = tDown(N - 1), X_END = bodyAt(N - 1);
  const marks = [...Array(N).keys()].map((k) => mark(`D.trot#${k}`, 'step'));
  const nScore = S.marks.filter((m) => m.kind === 'step' && /^D\.trot#\d+$/.test(m.beat)).length;
  if (nScore !== N) throw new Error(`score has ${nScore} trot footfalls, story.json trot.n is ${N}: regenerate the score`);
  marks.forEach((m, k) => { if (Math.abs(MX(m.x) - footAt(k)) > 1) console.warn(`footfall ${k}: splash at ${MX(m.x)}, foot at ${footAt(k)}`); });
  [[0, 1.4], [1, -2.1]].forEach(([j, rest]) => {    // the feet start where shot C leaves them (rest offsets, in u)
    if (Math.abs(MX(TROT.from[j]) - (X_IN + rest * U)) > 1) console.warn(`trot.from[${j}] is not where shot C leaves that foot`);
  });

  // the stream bed: where Clawd stomped in (BED), rising to a gravel bar for the trot, so more leg shows
  const GY = WL + 18;
  const ground = (x) => lerp(BED, GY, ease(seg(x, X_IN, X_IN + 2.5 * U)));

  // the body lurches forward mid-stride and nearly stops at each footfall
  const surge = (p) => p - .75 * Math.sin(TAU * p) / TAU;
  function bodyX(t) {
    if (t < tUp(0)) return X_IN;
    if (t < T0) return lerp(X_IN, bodyAt(0), ease(seg(t, tUp(0), T0)));
    if (t >= tEnd) return X_END;
    const k = Math.floor((t - T0) / I);
    return lerp(bodyAt(k), bodyAt(k + 1), surge((t - tDown(k)) / I));
  }

  // One foot through its swings: on the bed, pulled up through the water, over the surface on a high arc (up fast, a
  // hang, then a plunge that speeds up), slapping the surface at `down` and reaching the bed tB later. Between two
  // swings it slips `slip` forward under the water (unseen; its splash is long gone), so the legs don't bunch up.
  const PULL = .08, SLIP = TROT.slip * PXM;
  const arcH = (p) => p < .4 ? easeOut(p / .4) : p < .68 ? 1 + .06 * Math.sin(Math.PI * (p - .4) / .28) : 1 - easeIn((p - .68) / .32);
  function footPath(t, x, swings) {
    let bed = ground(x) - .2 * U, landed = null;
    for (const s of swings) {
      const bed1 = ground(s.x1) - .2 * U, p = (t - s.up) / (s.down - s.up);
      const x0 = landed == null ? x : x + SLIP * ease(seg(t, landed, s.up - PULL));
      if (t < s.up - PULL) return [x0, bed];
      if (t < s.up) return [x0, lerp(bed, WL, easeIn(seg(t, s.up - PULL, s.up)))];
      if (t < s.down) return [lerp(x0, s.x1, ease(p / .85)), WL - s.h * arcH(p)];
      if (t < s.down + s.tB) return [s.x1, lerp(WL, bed1, easeOut(seg(t, s.down, s.down + s.tB)))];
      x = s.x1; bed = bed1; landed = s.down + s.tB;
    }
    return [x, bed];
  }
  // The swings of each side-view leg (far back, far front, near back, near front). The far leg at each end steps with
  // the near one, a little lower and later, hidden behind it: a planted far leg would fill the gap under a lifted
  // near foot, and that gap is what shows the foot is out of the water. So the front pair and the back pair take turns.
  const H_STEP = .95 * U;
  const farAt = (k) => footAt(k) + (k % 2 ? .5 : .2) * U;
  const LEGS = [[1, -1.6, farAt, .85], [0, 1.8, farAt, .85], [1, -2.1, footAt, 1], [0, 1.4, footAt, 1]].map(([par, rest, at, hk], i) => {
    const swings = [];
    for (let k = par; k < N; k += 2) {
      swings.push({ up: tUp(k) + (hk < 1 ? .04 : 0), down: tDown(k), x1: at(k), h: hk * H_STEP * (1 + .12 * k + .1 * (hash(k + 3) - .5)), tB: marks[k].tBottom });
    }
    return { start: X_IN + rest * U, swings };
  });

  // How the body rides the steps: it rises as a foot comes up and drops with the plunge, then gives under the
  // impact (down and squashed, deepest when the foot hits the bed), leaning back to lift a front foot and forward to
  // lift a back one. The arm pumps with the back foot. Later steps are bigger: the trot turns into a dance.
  const rise = (p) => p <= 0 || p >= 1 ? 0 : p < .45 ? easeOut(p / .45) : p < .7 ? 1 : 1 - easeIn((p - .7) / .3);
  const give = (a, tB) => a < 0 ? 0 : a < tB ? Math.sin(Math.PI / 2 * a / tB) : Math.exp(-9 * (a - tB)) * Math.cos(15 * (a - tB));
  function stepBody(t) {
    const b = { dy: 0, sq: 0, rot: 0, arm: 0 };
    for (let k = 0; k < N; k++) {
      const big = 1 + .15 * k, len = tDown(k) - tUp(k), r = rise((t - tUp(k)) / len), g = give(t - tDown(k), marks[k].tBottom);
      b.dy += -.42 * big * r + .2 * big * g;
      b.sq += .12 * big * g;
      b.rot += (k % 2 ? .035 : -.045) * big * r;
      b.arm += (k % 2 ? 1 : -.45) * rise((t - .05 - tUp(k)) / len);
    }
    return b;
  }

  // ------------------------------------------------------------ moods and gaze, D through E
  const tLook = () => beat('D.spot') - .5;
  const moodKeys = () => [[beat('C.laugh'), 'laugh'], [tUp(0) - .09, 'excited', { emote: null }], [tDown(1) + .08, 'playful'],
    [beat('D.spot'), 'surprised', { emote: '!' }], [beat('D.idea'), 'mischief'],
    [beat('E.crouch'), 'determined'], [JUMP.takeoff + .22, 'excited'], [JUMP.land + .03, 'surprised'], [beat('E.laugh'), 'laugh']];
  // after the "!" the takes are halved: the idea and the decision to jump are smaller beats, and the jump is coming
  const mood = (t) => { const m = emotions(t, moodKeys()), f = 1 - .5 * seg(t, beat('D.spot') + .3, beat('D.spot') + .45) * (1 - seg(t, JUMP.takeoff - .05, JUMP.takeoff));
    return { ...m, dy: (m.dy || 0) * f, sq: (m.sq || 0) * f }; };
  // down at the feet while stomping; up and ahead at the pool when it's spotted (the eyes lead the camera)
  function gaze(t) {
    const k = ease(seg(t, tLook(), tLook() + .12)), j = ease(seg(t, JUMP.takeoff - .2, JUMP.takeoff));
    return { lookX: lerp(lerp(.45, .95, k), .7, j), lookY: lerp(lerp(.75, .05, k), .8, j) };
  }
  // how much of the mood's own idle motion shows: little while the steps drive the body
  const moodBody = (t) => 1 - .88 * seg(t, D0 + .02, D0 + .3) * (1 - seg(t, tEnd + .3, tEnd + .7));

  // ------------------------------------------------------------ Clawd through the trot
  // a leg reaching for its foot on the bed stretches at most .8u; when a take throws the body higher, the foot comes along
  const plant = (x, gy, o, i, fx, fy) => { const L = reachFor(x, gy, o, i, fx, fy); return { dx: L.dx, dh: Math.min(L.dh, .8) }; };
  function trotPose(t) {
    const x = bodyX(t), gy = ground(x), m = mood(t), b = stepBody(t), w = moodBody(t);
    const o = { ...m, ...gaze(t), view: 'side', boilKey: 'clawd', noShadow: true,
      dx: (m.dx || 0) * w, dy: (m.dy || 0) * w + b.dy, sq: (m.sq || 0) * w + b.sq, rot: (m.rot || 0) * w + b.rot,
      aL: lerp(.25 + .85 * b.arm, m.aL ?? .2, w) };
    const lift = {};
    LEGS.forEach((L, i) => { const [fx, fy] = footPath(t, L.start, L.swings); lift[i] = plant(x, gy, o, i, fx, fy); });
    return { x, gy, o, legs: { lift, gy } };
  }

  // ------------------------------------------------------------ the camera, D through E
  // From where shot C's camera ends, in close on the feet for the trot (leading Clawd), following its look out to the
  // pool, then along the jump. Keys: [t, [x, y, zoom], hold?]; a held key is passed at rest.
  function spline(t, K) {
    if (t <= K[0][0]) return K[0][1];
    const n = K.length - 1;
    if (t >= K[n][0]) return K[n][1];
    let i = 0; while (t >= K[i + 1][0]) i++;
    const slope = (j) => j === 0 || j === n || K[j][2] ? K[j][1].map(() => 0) : K[j][1].map((v, d) => (K[j + 1][1][d] - K[j - 1][1][d]) / (K[j + 1][0] - K[j - 1][0]));
    const [t0, p0] = K[i], [t1, p1] = K[i + 1], h = t1 - t0, s = (t - t0) / h, m0 = slope(i), m1 = slope(i + 1);
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = 3 * s * s - 2 * s * s * s, h11 = s * s * s - s * s;
    return p0.map((v, d) => h00 * v + h10 * h * m0[d] + h01 * p1[d] + h11 * h * m1[d]);
  }
  let camKeys = null;
  function wadeCam(t) {
    if (!camKeys) {
      const xl = MX(JUMP.xTo), spot = beat('D.spot');
      camKeys = [[D0, [X_IN + 60, WL - 150, 1.4]]];                      // = shot C's last framing (shot_c.js)
      for (let k = 0; k < N; k++) camKeys.push([tDown(k), [bodyAt(k) + 110, WL - 118, 1.72]]);
      camKeys.push([tLook() + .05, [X_END + 112, WL - 120, 1.72], true],
        [spot + .2, [X_END + 215, WL - 150, 1.42]], [JUMP.takeoff, [X_END + 205, WL - 160, 1.46], true],
        [JUMP.land, [xl + 30, WL - 175, 1.32]], [JUMP.land + 1.4, [xl + 25, WL - 160, 1.4]], [JUMP.land + 4, [xl + 15, WL - 150, 1.5]]);
    }
    const c = spline(t, camKeys), sh = t > JUMP.land ? shakeXY(t, 12 * Math.exp(-(t - JUMP.land) * 7)) : [0, 0];
    return [c[0] + sh[0], c[1] + sh[1], c[2]];
  }

  // ------------------------------------------------------------ the painter, D through E
  // Each footfall rings one note of the melody (SCORE.notes): water_fx's note glyph pops out of its splash, skims out
  // from under the body (forward off a front foot, back off a back foot) and floats up, higher for a higher note.
  // (notes(t) drifts every note to one side, which would carry a front foot's note across the body.)
  function trotNotes(t) {
    const s = 8 * clamp(2.6 / CAM.zoom, 1, 2);
    for (const n of S.notes) {
      const a = t - n.t, k = n.beat.startsWith('D.trot#') ? +n.beat.slice(7) : -1;
      if (k < 0 || a <= 0 || a >= .9) continue;
      const out = easeOut(seg(a, 0, .22)), up = easeOut(seg(a, .08, .9)) * (40 + 36 * Math.log2(n.f / 880));
      noteGlyph(MX(n.x) + (k % 2 ? -80 : 45) * out, WL - 14 - up, s, a / .9, 'note ' + n.beat);
    }
  }
  function paintWade(t, P) {
    camBegin(...wadeCam(t));
    sky(t); water(t); banks(t); stones();
    landings(t); bubbles(t, 120); splashes(t, false); falls(t);
    clawd(P.x, P.gy, U, withLegs(P.o, P.legs));
    collars(P.x, P.o, P.legs, t);
    splashes(t, true);
    trotNotes(t);
    camEnd();
  }

  // ------------------------------------------------------------ drops shaken off the feet
  // The synth lets the drips and blobs of a foot leaving the water fall from 3–35 cm, far above Clawd. Here each one
  // is re-released from where a foot (or else Clawd's dripping underside) really is at the moment that lands it on its
  // sound: f.t stays, f.x and f.h move. pose(t) = { x, gy, o, legs }; exits = the exit marks whose falls to move
  // (default: the trot's lifts and the jump's takeoff). A fall belongs to the latest of all the score's exits before
  // it (within 1.3 s); a drip cue's own drop is left to its shot.
  const TROT_EXITS = () => [...marks.map((m, k) => mark(`D.trot#${k}.lift`, 'exit')), S.marks.find((m) => m.kind === 'exit' && Math.abs(m.t - JUMP.takeoff) < 1e-6)];
  function placeFalls(pose, exits = TROT_EXITS()) {
    const all = S.marks.filter((m) => m.kind === 'exit').sort((a, b) => a.t - b.t), drips = S.marks.filter((m) => m.kind === 'drip');
    const tf = (y) => Math.sqrt(2 * Math.max(0, WL - y) / (G * ZM));
    for (const f of S.falls) {
      if ((f.src !== 'exit' && f.src !== 'drip') || drips.some((d) => Math.abs(d.t - f.t) < .01)) continue;
      const m = all.filter((e) => e.t <= f.t + 1e-6 && f.t - e.t < 1.3).pop();
      if (!m || !exits.includes(m)) continue;
      let at = null;
      for (let tr = f.t; tr > f.t - .45 && !at; tr -= 1 / 480) {      // the latest release that lands on time
        const P = pose(tr), soles = [0, 1, 2, 3].map((i) => legSole(P.x, P.gy, P.o, i, P.legs.lift[i])).filter(([, y]) => y < WL - 1);
        const ok = soles.filter(([, y]) => f.t - tr >= tf(y));
        if (ok.length) at = ok[Math.floor(hash(f.id + .5) * ok.length)];
      }
      if (!at) {                     // no foot up: it drips off Clawd's underside (or, with Clawd in the pool, just rings)
        const lx = (hash(f.id + 7) - .5) * 5 * U, under = (tr) => { const P = pose(tr); return bodyFrame(P.x, P.gy, P.o).toWorld(lx, -2 * U); };
        const [x0, y0] = under(f.t - .06);
        at = y0 < WL - 1 ? under(f.t - tf(y0)) : [x0, WL - .5];
      }
      f.x = (at[0] + (hash(f.id * 3.1) - .5) * .6 * U - MX(0)) / PXM;
      f.h = (WL - at[1]) / ZM;
    }
  }

  // ------------------------------------------------------------ D: the trot
  function shotD(t) { paintWade(t, trotPose(t)); }

  PLK.wade = { I, N, tUp, tDown, bodyAt, X_END, GY, ground, footPath, LEGS, plant, mood, gaze, moodBody, trotPose, wadeCam, paintWade, placeFalls };
  PLK.shot = PLK.shot || {};
  PLK.shot.D = shotD;
})();
