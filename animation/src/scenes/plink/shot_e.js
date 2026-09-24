// shot_e.js: shot E, the jump. The second half of the take that starts in shot_d.js (same camera, moods and painter):
// Clawd crouches where the trot stopped, leaps and lands in the deep pool. Beats come from PLK.beat().
(() => {
  const { MX, POOL, JUMP, beat, wade } = PLK;
  const { X_END, GY, ground, footPath, LEGS, plant, mood, gaze, trotPose, paintWade, placeFalls } = wade;

  // legs in the air: tucked up, the front pair forward, the back pair back; they reach down again just before landing
  const TUCK = [[-.3, -.95], [.35, -.95], [-.35, -.85], [.3, -.85]];

  // ------------------------------------------------------------ E: the jump, up to the next shot
  function jumpPose(t) {
    const t0 = JUMP.takeoff, t1 = JUMP.land, x1 = MX(JUMP.xTo), k = seg(t, t0, t1);
    const x = lerp(X_END, x1, k), gy = t < t0 ? ground(X_END) : lerp(GY, POOL, easeIn(k));
    const m = mood(t), hop = jump(t, t0, t1, 6), crouch = t < t0 ? ease(seg(t, beat('E.crouch'), t0 - .05)) : 0;
    // the mood's own hops and stretches: damped in the air (the arc carries it: a hang at the top, not a second
    // stretch) and in the pool (it's deep: Clawd bobs rather than jumps)
    const air = t > t0 && t < t1, fly = seg(t, t0 - .1, t0) * (1 - seg(t, t1 - .05, t1));
    const dyk = t < t1 ? 1 - .85 * fly : .35, sqk = 1 - .7 * fly;
    const o = { ...m, ...(t < t1 ? gaze(t) : {}), boilKey: 'clawd', noShadow: true,
      ...(t < t1 + .35 ? { view: 'side' } : turn(t, t1 + .35, t1 + .55, .25, .125)),
      dy: (m.dy || 0) * dyk + hop.dy, sq: (m.sq || 0) * sqk + hop.sq + .16 * crouch, rot: ((m.rot || 0) * (1 - .5 * crouch) + .04 * crouch) * (1 - seg(t, t0, t0 + .1)),
      aL: air ? lerp(-.5, 1.3, easeOut(seg(t, t0, t0 + .12))) : t < t0 ? lerp(m.aL ?? .2, -.5, crouch) : m.aL };
    // planted where the trot left them until the takeoff, then tucked; after landing they hang in the pool
    const tuck = seg(t, t0 - .03, t0 + .1) * (1 - seg(t, t1 - .12, t1)), lift = {};
    LEGS.forEach((L, i) => {
      const [fx, fy] = footPath(t, L.start, L.swings), planted = t < t0 + .1 ? plant(x, gy, o, i, fx, fy) : { dx: 0, dh: 0 };
      lift[i] = { dx: lerp(planted.dx, TUCK[i][0], tuck), dh: lerp(t < t0 + .1 ? planted.dh : 0, TUCK[i][1], tuck) };
    });
    return { x, gy, o, legs: { lift, gy } };
  }
  const wadePose = (t) => t < beat('E.crouch') ? trotPose(t) : jumpPose(t);
  placeFalls(wadePose);

  function shotE(t) { paintWade(t, jumpPose(t)); }

  PLK.wade.jumpPose = jumpPose;
  PLK.shot = PLK.shot || {};
  PLK.shot.E = shotE;
})();
