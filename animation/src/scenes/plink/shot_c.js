// shot_c.js: shot C, in on purpose. Starts at story.json shots.C; beats come from PLK.beat().
(() => {
  const { WL, BANK, BED, U, C, STEP_IN, beat, X_BANK, X_IN, sky, water, banks, stones, landings, bubbles, falls, splashes, withLegs, collars } = PLK;

  // ------------------------------------------------------------ C: in on purpose
  function shotC(t, lt, dur) {
    const tStep = STEP_IN.t;
    const cam = kf(lt, [[0, [X_BANK + 30, BANK - 5 * U, 2.35]], [.7, [X_IN + 40, WL - 150, 1.45]], [dur, [X_IN + 60, WL - 150, 1.4]]]);
    const shake = t > tStep ? shakeXY(t, 5 * Math.exp(-(t - tStep) * 9)) : [0, 0];
    camBegin(cam[0] + shake[0], cam[1] + shake[1], cam[2]);
    sky(t); water(t); banks(t); stones();
    landings(t); bubbles(t); splashes(t, false); falls(t);
    // a hop from the bank into the water, landing on the slap
    const k = seg(t, beat('C.hop'), tStep), x = lerp(X_BANK, X_IN, ease(k)), gy = lerp(BANK, BED, easeIn(k));
    const hop = t < tStep ? { dy: -1.6 * 4 * k * (1 - k), sq: t < tStep - .3 ? .16 * ease(seg(t, tStep - .5, tStep - .3)) : -.12 } : { dy: 0, sq: .24 * Math.exp(-8 * (t - tStep)) * Math.cos(20 * (t - tStep)) };
    const mood = emotions(t, [[t - lt, 'determined'], [tStep + .05, 'surprised'], [beat('C.laugh'), 'laugh']]);
    const o = { ...mood, view: 'side', boilKey: 'clawd', noShadow: t > tStep - .1, dy: (mood.dy || 0) + hop.dy, sq: (mood.sq || 0) + hop.sq };
    const legs = { lift: t < tStep ? { 3: { dx: .55 * (1 - k), dh: -.6 }, 1: { dh: -.4 } } : {}, gy };
    clawd(x, gy, U, withLegs(o, legs));
    collars(x, o, legs, t);
    splashes(t, true);
    camEnd();
  }


  PLK.shot = PLK.shot || {};
  PLK.shot.C = shotC;
})();
