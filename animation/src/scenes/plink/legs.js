// legs.js: Clawd's legs drawn by hand — reaching, dipping, trotting — cut off at the waterline, plus the foam
// collar where a leg meets the water.
(() => {
  const { WL, U, C, arc } = PLK;

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
  // The transform clawd() gives a Clawd drawn at (x, gy) with pose o: body-local ↔ world.
  function bodyFrame(x, gy, o) {
    const sq = (o.sq || 0) + (o.take || 0), r = o.rot || 0, c = Math.cos(r), s = Math.sin(r);
    const sx = (o.flip ? -1 : 1) * (o.sx ?? 1) * (1 + sq * .6) * (1 + clamp(o.smear || 0) * .35), sy = (o.sy ?? 1) * (1 - sq);
    const tx = x + (o.dx || 0) * U, ty = gy + (o.dy || 0) * U;
    return {
      toWorld: (lx, ly) => [tx + c * sx * lx - s * sy * ly, ty + s * sx * lx + c * sy * ly],
      toLocal: (wx, wy) => { const dx = wx - tx, dy = wy - ty; return [(c * dx + s * dy) / sx, (-s * dx + c * dy) / sy]; },
      waterY: (lx) => (WL - ty - s * sx * lx) / (c * sy),      // body-local y of the waterline at body-local x
    };
  }
  // leg i's sole (the middle of its bottom edge) in body-local px, and the lift that puts it at a world point
  const soleLocal = (o, i, L) => { const [lx] = VIEWS[o.view || 'front'].legs[i]; return [(lx + (L.dx || 0) + .5) * U, (-2.05 + 1.85 + (L.dh || 0)) * U]; };
  const legSole = (x, gy, o, i, L = {}) => bodyFrame(x, gy, o).toWorld(...soleLocal(o, i, L));
  function reachFor(x, gy, o, i, wx, wy) {
    const [lx0] = VIEWS[o.view || 'front'].legs[i], [lx, ly] = bodyFrame(x, gy, o).toLocal(wx, wy);
    return { dx: lx / U - .5 - lx0, dh: ly / U + 2.05 - 1.85 };
  }
  function withLegs(o, { lift = {}, walk = null, gy = null } = {}) {
    const view = o.view || 'front', V = VIEWS[view], { dk } = tintCols(o), far = mixCol(dk, PAL.ink, .22);
    const F = gy == null ? null : bodyFrame(0, gy, o);
    return { ...o, noLegs: true, draw: (u, sw) => V.legs.forEach(([lx, isFar], i) => {
      const { dx, h } = legPose(i, lift, walk, view), top = -2.05 * u;
      const bottom = Math.min(top + h * u, F ? F.waterY((lx + dx + .5) * u) : Infinity);
      if (bottom - top < 1.5) return;
      boilSeed(`leg ${o.boilKey} ${i}`);
      paint(rectPts((lx + dx) * u, top, u, bottom - top, u * .04), { wash: isFar ? far : dk, washOp: 255, ink: PAL.ink, sw: sw * .8 });
    }) };
  }
  // where a leg meets the water, a little collar of foam (world coordinates, drawn after Clawd)
  function collars(x, o, { lift = {}, walk = null, gy }, t) {
    const V = VIEWS[o.view || 'front'], F = bodyFrame(x, gy, o);
    V.legs.forEach(([lx, isFar], i) => {
      const { dx, h } = legPose(i, lift, walk, o.view || 'front'), cx = (lx + dx + .5) * U, wy = F.waterY(cx);
      if (wy < -2.05 * U || wy > (-2.05 + h) * U) return;        // this leg doesn't reach down to the water
      const [wx] = F.toWorld(cx, wy);
      boilSeed('collar' + i);
      arc(wx, WL + (isFar ? -2 : 3), U * .85, .1, Math.PI - .1, 2, mixCol(C.foam, C.water, isFar ? .35 : .1), 8);
      arc(wx, WL + (isFar ? -2 : 3), U * .85, Math.PI + .3, TAU - .3, 1.2, mixCol(C.foam, C.water, .4), 6);
    });
  }


  Object.assign(PLK, { WALK_PH, legPose, bodyFrame, legSole, reachFor, withLegs, collars });
})();
