// shot_a.js: shot A, the bank. Clawd looks across the stream and the camera follows its gaze to the flower on the far
// ledge, then comes back to find Clawd still longing for it. Clawd looks down at the water between, and lifts a foot
// over it: the cut to B comes down with that foot. Starts at story.json shots.A; beats come from PLK.beat().
(() => {
  const { BANK, U, beat, X_BANK, sky, water, banks, stones, flowerGlint, FLOWER, withLegs } = PLK;

  // ------------------------------------------------------------ A: the bank
  function shotA(t, lt, dur) {
    const tGaze = beat('A.gaze'), tPan = beat('A.pan'), tFlower = beat('A.flower'), tBack = beat('A.back'), tHome = beat('A.home');
    const tDown = beat('A.lookDown'), tUp = beat('A.footUp');
    // camera: on Clawd; along its gaze across the stream (pulling back on the way, so the water between reads) to the
    // flower; back to Clawd; then in close for the foot
    const onClawd = [X_BANK + 150, BANK - 120], atFlower = [FLOWER.x - 70, FLOWER.y - 75];
    const xy = kf(t, [[0, [onClawd[0] - 15, onClawd[1]]], [tPan, onClawd], [tFlower, atFlower], [tBack, [atFlower[0] + 8, atFlower[1] - 3]],
      [tHome, [X_BANK + 125, BANK - 112]], [dur, [X_BANK + 117, BANK - 84]]]);
    const zoom = kf(t, [[0, 1.46], [tPan, 1.5], [(tPan + tFlower) / 2, .82], [tFlower, 1.55], [tBack, 1.62], [(tBack + tHome) / 2, 1.05], [tHome, 1.7], [dur, 1.85]]);
    camBegin(xy[0], xy[1], zoom);
    sky(t); water(t); banks(t); stones();
    flowerGlint(t, tFlower - .1, {}, .8);
    // Clawd: its eyes go to the flower first and light up; later it looks down at the water, nervous
    const mood = emotions(t, [[0, 'neutral', { lookX: .7, lookY: .1 }], [tGaze, 'hopeful', { lookX: 1, lookY: -.6 }],
      [tDown, 'nervous', { lookX: .8, lookY: .9 }]]);
    const face = turn(t, tDown - .3, tDown - .1, .125, .25);   // 3/4 while it longs for the flower, side-on for the step
    // when the camera finds it again it strains toward the flower: up on its toes, the near arm reaching out
    const reach = kf(t, [[tHome - .15, 0], [tHome + .2, 1], [tDown - .35, 1], [tDown - .05, 0]]);
    // the near front foot rises and reaches out over the water, hovering (anticipation for the cut)
    const up = backOut(seg(t, tUp, tUp + .65)), hover = wob(lt, 2.2) * .28 * up;
    const o = { ...mood, ...face, boilKey: 'clawd', dy: (mood.dy || 0) * .5 - .45 * reach, rot: (mood.rot || 0) + .05 * reach - .09 * up,
      aL: lerp(mood.aL ?? .2, 1.05, reach), sq: (mood.sq || 0) - .05 * reach };
    const toes = .45 * reach;
    clawd(X_BANK, BANK, U, withLegs(o, { lift: { 0: { dh: toes }, 1: { dx: -.3 * up, dh: toes }, 2: { dx: -.2 * up, dh: toes }, 3: { dx: .8 * up, dh: -1.3 * up + hover + toes } }, gy: BANK }));
    const eye = toScreen(X_BANK, BANK - 4 * U);
    camEnd();
    if (lt < .55) iris(...eye, lerp(0, 1600, easeIn(lt / .55)));
  }

  PLK.shot = PLK.shot || {};
  PLK.shot.A = shotA;
})();
