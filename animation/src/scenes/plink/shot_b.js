// shot_b.js: shot B, the toe-tap. Starts at story.json shots.B; beats come from PLK.beat().
(() => {
  const { S, MX, WL, BANK, U, C, DIP, beat, X_BANK, sky, water, banks, ring, drops, landings, noteGlyph, withLegs } = PLK;

  // ------------------------------------------------------------ B: the toe-tap
  function shotB(t, lt, dur) {
    const xd = MX(DIP.x), tTouch = DIP.touch, tPlink = DIP.plink, t0 = t - lt;
    const cam = kf(lt, [[0, [xd + 30, WL - 18, 3.0]], [1.35, [xd + 34, WL - 12, 3.1]], [1.9, [X_BANK + 20, BANK - 5 * U, 2.5]], [dur, [X_BANK + 30, BANK - 5 * U, 2.35]]]);
    camBegin(...cam);
    sky(t); water(t); banks(t); drops(t, false);
    // the foot: down to the surface, a touch, back up
    const down = kf(t, [[t0, 0], [tTouch, 1], [tTouch + .2, 1.03], [tPlink - .05, .55], [t0 + 1.6, .1]]);
    const reach = { dx: .8, dh: -1.3 + down * 2.35 };
    // Just before the cut Clawd turns back to the side, resolved, into the pose shot C opens on, so nothing pops at the cut.
    const tBack = t0 + dur - .4, r = ease(seg(t, tBack + .1, tBack + .3));
    const mood = emotions(t, [[t0, 'nervous', { lookX: .8, lookY: .9 }], [beat('B.surprise'), 'surprised', { lookX: .6, lookY: .7 }],
                              [beat('B.delight'), 'starstruck', { emote: 'music' }], [tBack - .05, 'determined']]);
    const face = t < beat('B.turn') ? { view: 'side' } : t < tBack ? turn(t, beat('B.turn'), beat('B.turn') + .2, .25, .125) : turn(t, tBack, tBack + .2, .125, .25);
    const lift = face.view !== 'side' ? {} : t < tBack ? { 3: reach, 2: { dx: -.2 } } : { 3: { dx: .55 * r, dh: -.6 * r }, 1: { dh: -.4 * r } };
    clawd(X_BANK, BANK, U, withLegs({ ...mood, ...face, boilKey: 'clawd' }, { lift, gy: BANK }));
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
    drops(t, true); landings(t);   // the droplets the touch flicks up, ticking back down
    // the plink is the melody's first note: a note pops up off the water where it sounded
    const N = S.notes.find((n) => n.beat === 'B.plink'), kn = seg(t, N.t, N.t + .9);   // drifts right, away from the lifting foot
    if (kn > 0 && kn < 1) noteGlyph(MX(N.x) + 12 + 22 * kn + 3 * Math.sin(kn * 6), WL - 12 - 40 * easeOut(kn), 8, kn, 'bnote');
    camEnd();
  }


  PLK.shot = PLK.shot || {};
  PLK.shot.B = shotB;
})();
