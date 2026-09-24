// water_fx.js: everything the water does, painted from SCORE — rings, thrown drops on their real flights, bubbles,
// footfall crowns, drips. A drop's ring appears on the frame its tick sounds; a bubble lives as long as it rings.
(() => {
  const { S, G, PXM, ZM, MX, WL, POOL, U, C, STEPS, TROT, warm, mark } = PLK;
  const FLAT = .28;                                    // rings and crowns lie on the water as ellipses this flat
  const LINE = mixCol(PAL.ink, C.waterDk, .45);        // outlines of water shapes: dark teal, not black
  const DROP = mixCol(C.foam, C.water, .22), BUBBLE = mixCol(C.foam, C.water, .45);
  const SHEET_IN = mixCol(C.foam, C.water, .4), SHEET_OUT = mixCol(C.foam, C.water, .05);
  const HERO = mark('E.land', 'step'), HERO_X = MX(HERO.x);   // the jump's landing: the film's big splash
  const EXITS = S.marks.filter((m) => m.kind === 'exit'), TAKEOFF = EXITS.find((m) => Math.abs(m.t - S.jump.takeoff) < 1e-6);
  const angDiff = (a, b) => { const d = (a - b) % TAU; return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d; };

  // ------------------------------------------------------------ rings
  // Light marks on the water are painted as thin washes: p5.brush mixes ink like pigment, so a pale line over the
  // darker water all but vanishes (only its ends show).
  function arc(x, y, r, a0, a1, w, col, n = 12) {
    const P = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([x + Math.cos(a) * r, y + Math.sin(a) * r * FLAT]); }
    paint(ribbon(P, w, w * .8), { wash: col, ink: null });
  }
  function ring(x, y, r, k, key) {
    if (k < 0 || k > 1 || r < 1) return;
    boilSeed(key);
    const col = mixCol(C.foam, C.water, k * .8), w = Math.max(.9, 3 * (1 - k)) * clamp(r / 30, .7, 1.6), n = Math.round(clamp(r / 5, 4, 12));
    arc(x, y, r, .12, Math.PI - .12, w, col, n);                                  // the near half of the ring
    arc(x, y, r, Math.PI + .2, TAU - .2, w * .6, col, Math.max(4, n - 2));       // the far half, thinner
  }

  // ------------------------------------------------------------ crowns
  // The sheet a footfall throws up: a ring of water around the foot, seen from a little above, that rises, flares out
  // like a tulip, tears at the rim into spikes and falls back. Its far half is the inside of the sheet (a shade darker),
  // its near half a low lumpy lip that rises at both sides into horns. SCORE's drops still inside the sheet are painted
  // under it, so they appear as they fly clear of it: the crown tears into the drops you hear.
  // A foot pulling out throws a small one too (the water it drags up falls back around it); the jump's takeoff one
  // under each pair of legs (dx: the crown's offset from its mark, px).
  function crownAt(m, t, dx = 0) {
    const hero = m === HERO, exit = m.kind === 'exit', E = exit ? 0 : (m.v / 1.5) ** 2, a = t - m.t;
    const life = hero ? .27 : exit ? .2 : .2 + .06 * E, pre = hero ? .025 : .015;   // pre: already up on the impact frame
    if (a < 0 || a > life) return null;
    const k = (a + pre) / (life + pre), rise = easeOut(clamp(k / .3)), fall = ease(seg(k, .33, 1));
    // Rb: the crown's foot, Rp / Hp: its rim's radius and height at the peak, back: the far rim's middle (× H)
    const g = hero ? { Rb: 3.4 * U, Rp: 7 * U, Hp: 7.2 * U, lip: .6 * U, back: .8, flat: FLAT, n: 11, sw: .9 }
      : m === TAKEOFF ? { Rb: .9 * U, Rp: 1.5 * U, Hp: 1.1 * U, lip: .3 * U, back: .6, flat: .2, n: 5, sw: .5 }
      : exit ? { Rb: .55 * U, Rp: 1.15 * U, Hp: .8 * U, lip: .25 * U, back: .6, flat: .2, n: 5, sw: .45 }
      : { Rb: .75 * U, Rp: (1.5 + .6 * E) * U, Hp: (1.6 + .8 * E) * U, lip: .4 * U, back: .7, flat: .2, n: 7, sw: .6 };
    const up = (.15 + .85 * rise) * (1 - fall);
    // it falls back into the water where it came from, rather than flattening into a disc
    const c = { ...g, hero, m, k, rise, fall, dx, cx: MX(m.x) + dx, H: g.Hp * up, lip: g.lip * up,
      R: g.Rb + (g.Rp - g.Rb) * easeOut(clamp(k / .35)) * (1 - .55 * fall), key: 'crown' + m.t + ' ' + dx };
    c.spikes = spikesOf(c);
    return c;
  }
  // The rim's spikes, fixed per crown: one at each horn, the others scattered; as the sheet falls they stand longer,
  // like the fingers it tears into.
  function spikesOf(c) {
    const out = [[Math.PI + .1, 1], [TAU - .1, 1]], seed = c.m.t * 17 + c.dx * .1;
    for (let i = 0; i < c.n; i++) out.push([(i + .5 + (hash(seed + i) - .5) * .6) / c.n * TAU, 0]);
    return out.map(([p, horn], i) => ({ p, horn, w: TAU / c.n * (horn ? .5 : .32 + .14 * hash(seed + i * 3.1)),
      len: c.H * (horn ? .45 + .15 * hash(seed + i) : .16 + .22 * hash(seed + i * 7.7)) * (.35 + .65 * c.rise) * (1 + 2 * c.fall) }));
  }
  // A point of the rim at angle p (0 = right, PI/2 = nearest the camera, PI = left, 3PI/2 = far side).
  function rimAt(c, p) {
    const s = Math.sin(p), side = Math.cos(p) ** 2, foam = Math.pow(Math.abs(Math.sin(p * 7 + c.m.t)), .6);   // lumpy lip
    const h = s < 0 ? c.H * (c.back + (1 - c.back) * side) : lerp(c.R * c.flat * s + c.lip * (.5 + foam), c.H, Math.pow(side, 1.5));
    let b = 0;
    for (const sp of c.spikes) { const d = Math.abs(angDiff(p, sp.p)) / sp.w; if (d < 1) b = Math.max(b, sp.len * Math.pow(1 - d, 1.7)); }
    const dx = Math.cos(p) * (.7 + .5 * side), n = Math.hypot(dx, 1);   // the horns fling outward
    return [c.cx + c.R * Math.cos(p) + b * dx / n, WL + c.R * c.flat * s - h - b / n];
  }
  function rimPts(c, p0, p1, n) {
    const ps = [];
    for (let i = 0; i <= n; i++) ps.push(p0 + (p1 - p0) * i / n);
    for (const sp of c.spikes) { const q = p0 + ((sp.p - p0) % TAU + TAU) % TAU; if (q > p0 && q < p1) ps.push(q); }   // sharp tips
    return ps.sort((a, b) => a - b).map((p) => rimAt(c, p));
  }
  // The sheet's side edge, from the foot of the crown (s = 0) to the rim's end (s = 1): it rises straight, then flares
  // out, like a tulip opening. side = -1 (left) or 1.
  function wall(c, side, n = 6) {
    const P = [], x0 = c.cx + side * c.Rb, x1 = rimAt(c, side < 0 ? Math.PI : 0)[0], y0 = WL + 3, y1 = WL - c.H;
    const bz = (a, b, d, s) => lerp(lerp(a, b, s), lerp(b, d, s), s);
    for (let i = 1; i < n; i++) P.push([bz(x0, x0, x1, i / n), bz(y0, y0 - .7 * c.H, y1, i / n)]);
    return P;
  }
  // Outlines go only round the edges you see against the air, never where the water meets the water.
  const edge = (P, sw) => inkLine(P, sw, LINE, 'ink', 0);
  // The far half of the sheet (its inside, seen over the near rim) between angles p0 and p1 of the far side. An end
  // that isn't one of the sheet's own side edges is cut straight down to the water.
  function farSheet(c, p0, p1) {
    const rim = rimPts(c, p0, p1, Math.max(4, Math.round((p1 - p0) / Math.PI * (c.hero ? 40 : 20))));
    const L = p0 <= Math.PI + 1e-6 ? [[c.cx - c.Rb, WL + 3], ...wall(c, -1)] : [[rim[0][0], WL + 3]];
    const R = p1 >= TAU - 1e-6 ? [...wall(c, 1).reverse(), [c.cx + c.Rb, WL + 3]] : [[rim[rim.length - 1][0], WL + 3]];
    paint([...L, ...rim, ...R], { wash: SHEET_IN, ink: null });
    paint([...rim, ...rim.map(([x, y]) => [x, y + c.H * .2]).reverse()], { wash: SHEET_OUT, ink: null });   // the torn rim is foam
    edge([...L, ...rim, ...R], c.sw);
  }
  // The big splash stands behind Clawd, who stays readable in the middle of it. A footfall's crown is painted whole in
  // front of Clawd (behind, the body would hide it): the foot comes down into it.
  function crownBack(c) {
    if (!c.hero) return;
    boilSeed(c.key + 'b');
    farSheet(c, Math.PI, TAU);
  }
  function crownFront(c) {
    boilSeed(c.key + 'f');
    if (!c.hero) farSheet(c, Math.PI, TAU);
    const base = [];
    for (let i = 0; i <= 12; i++) { const p = Math.PI - Math.PI * i / 12; base.push([c.cx + c.Rb * Math.cos(p), WL + 3 + c.Rb * c.flat * .35 * Math.sin(p)]); }
    const top = [...wall(c, 1), ...rimPts(c, 0, Math.PI, c.hero ? 32 : 16), ...wall(c, -1).reverse()];
    paint([...top, ...base], { wash: SHEET_OUT, ink: null });
    if (c.fall < .75) edge(top, c.sw * (1 - c.fall));   // a fallen lip is foam on the water, not a line across the legs
  }
  // Is (x, y) inside a crown's sheet (between its far rim and the water)? Drops there are painted under the sheet.
  function inSheet(c, x, y) {
    const u = (x - c.cx) / c.R;
    if (Math.abs(u) >= 1 || y > WL + 3) return false;
    return y > rimAt(c, TAU - Math.acos(u))[1];
  }

  // ------------------------------------------------------------ thrown drops
  function dropAt(d, t) {
    const T = d.tLand - d.tl, s = t - d.tl;
    return { x: MX(d.x0 + d.vx * s), y: WL + d.front * 12 - ZM * d.vz * s * (1 - s / T), vx: PXM * d.vx, vy: -ZM * d.vz * (1 - 2 * s / T) };
  }
  const dropR = (d) => clamp(1.3 + d.a * 1.35, 2, 12);
  // One drop: a round head leading, a tail trailing along its path, longer the faster it flies (a smear: a fast drop
  // reads as flying instead of hopping from frame to frame). Drops only a few pixels wide on screen are specks.
  function drop(x, y, r, vx, vy) {
    const z = CAM ? CAM.zoom : 1, rs = r * z;   // rs: the radius on screen
    const sp = Math.hypot(vx, vy) || 1, ux = vx / sp, uy = vy / sp, tail = r * 1.2 + sp * .006, a0 = Math.atan2(uy, ux);
    if (rs < 4) { paint(ellPts(x - ux * tail * .3, y - uy * tail * .3, r + tail * .3, r, 8, 0, a0), { wash: DROP, ink: null }); return; }
    const P = [];
    for (let i = 0; i <= 8; i++) { const a = a0 - Math.PI / 2 + Math.PI * i / 8; P.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    P.push([x - ux * tail, y - uy * tail]);
    // in close-ups the outline keeps the weight it has in the wide shots, and small drops get a paler one: at full
    // weight it would turn them into dark specks
    paint(P, { wash: DROP, ink: mixCol(LINE, DROP, .5 * (1 - seg(rs, 6, 12))), sw: .35 * Math.min(1, 1.6 / z) });
  }
  // While the big splash is up, drops flying in front of Clawd's body go behind it (the face must read), and drops
  // still inside a crown's sheet are painted under it.
  function hidden(x, y, t, crowns) {
    if (t > HERO.t && t < HERO.t + .7 && Math.abs(x - HERO_X) < 3.5 * U && y > POOL - 8.7 * U) return true;
    return crowns.some((c) => inSheet(c, x, y));
  }
  function drops(t, front, cap = 260, crowns = liveCrowns(t)) {
    const live = [];
    for (const d of S.drops) {
      if (t < d.tl || t > d.tLand) continue;
      const p = dropAt(d, t);
      if ((d.front >= 0 && !hidden(p.x, p.y, t, crowns)) === front) live.push([d, p]);
    }
    live.sort((a, b) => b[0].amp - a[0].amp);
    for (const [d, p] of live.slice(0, cap)) { boilSeed('d' + d.id); drop(p.x, p.y, dropR(d), p.vx, p.vy); }
  }
  // A drop's ring is born on the frame it lands, the frame its tick sounds; the bigger ones kick up a little plip.
  function landings(t, cap = 70) {
    const live = [];
    for (const d of S.drops) { const a = t - d.tLand; if (a >= 0 && a <= .55 && d.a >= .7) live.push([d, a]); }
    const w = ([d, a]) => d.a * (1 - a / .55);
    live.sort((p, q) => w(q) - w(p));
    for (const [d, a] of live.slice(0, cap)) {
      const x = MX(d.xl), y = WL + d.front * 12, sz = Math.sqrt(d.a / 2);
      ring(x, y, (5 + 60 * Math.sqrt(a / .55)) * sz, a / .55, 'r' + d.id);
      if (a < .08 && d.a > 2) plip(x, y, sz, a / .08, 'p' + d.id);
    }
  }
  function plip(x, y, s, k, key) {
    boilSeed(key);
    const h = 16 * s * Math.sin(Math.PI * Math.min(1, .25 + k)), w = 6 * s;
    paint([[x - 1.5 * w, y + 1], [x - 1.2 * w, y - h * .8], [x - .55 * w, y - h * .2], [x, y - h], [x + .55 * w, y - h * .2],
      [x + 1.2 * w, y - h * .8], [x + 1.5 * w, y + 1]], { wash: SHEET_OUT, ink: LINE, sw: .3 });
  }

  // ------------------------------------------------------------ bubbles, drips
  // Bubbles rise to the surface around the foot and last as long as they ring (a little longer, to be seen). A tuned
  // bubble (a note of the melody) rises into view under the foot and pops, like the film's first plink.
  function bubbles(t, cap = 80) {
    for (const b of S.bubbles) if (b.src === 'note' && t >= b.t && t < b.t + NOTE_LIFE + .45) noteBubble(t, b);
    const live = S.bubbles.filter((b) => b.src !== 'note' && t >= b.t && t <= b.t + Math.max(b.dur, .12) + .05);
    live.sort((a, b) => b.amp - a.amp);
    for (const b of live.slice(0, cap)) {
      const life = Math.max(b.dur, .12), k = (t - b.t) / life, x = MX(b.x) + (hash(b.id) - .5) * 30, y = WL + 2 + 10 * hash(b.id + 5);
      boilSeed('b' + b.id);
      if (k <= 1) {   // small ones are flecks of foam; big ones little domes of water catching the light
        const r = clamp(b.r * 2.2, 2, 14) * backOut(Math.min(1, k * 4));
        if (r < 4.5) { paint(ellPts(x, y, r, r * .8, 8), { wash: C.foam, ink: null }); continue; }
        paint(ellPts(x, y, r, r * .85, 12), { wash: BUBBLE, ink: LINE, sw: .25 });
        paint(ellPts(x - r * .35, y - r * .3, r * .3, r * .2, 6, 0, -.4), { wash: C.foam, ink: null });
      } else ring(x, y, 6 + 40 * (k - 1), (k - 1) * 3, 'bp' + b.id);
    }
  }
  const NOTE_LIFE = .38;
  function noteBubble(t, b) {
    const k = (t - b.t) / NOTE_LIFE, x = MX(b.x), r = b.r * 3.2;
    boilSeed('note' + b.id);
    if (k >= 1) { ring(x, WL + 2, 4 + 45 * Math.sqrt((k - 1) / (.45 / NOTE_LIFE)), (k - 1) / (.45 / NOTE_LIFE), 'np' + b.id); return; }
    const y = WL + 34 - 32 * easeOut(k), s = backOut(Math.min(1, k * 5));
    paint(ellPts(x + 2 * Math.sin(k * 9), y, r * s, r * s * (1 - .12 * Math.sin(k * 20)), 16), { wash: BUBBLE, ink: LINE, sw: .45 });
    paint(ellPts(x - r * .35 * s, y - r * .4 * s, r * .25 * s, r * .18 * s, 8), { wash: C.foam, ink: null });
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
          [x - r * .6, y + r * .75], [x - r * .95, y - r * .1], [x - r * .5, y - r * 1.1]], { wash: DROP, ink: LINE, sw: .4 });
      } else ring(x, WL + 4, 6 + 55 * Math.sqrt((s - tf) / .6), (s - tf) / .6, 'fr' + f.id);
    }
  }

  // ------------------------------------------------------------ after the big splash
  // Once the crown has fallen: a wave ring runs off across the pool, and a collar of foam hugs Clawd at the waterline.
  function wave(a) {
    for (const [i, d, R1] of [[0, 0, 16 * U], [1, .25, 11 * U]]) {
      const k = seg(a, .06 + d, 1.4 + d);
      if (k <= 0 || k >= 1) continue;
      const r = lerp(3.8 * U, R1, easeOut(k)), w = lerp(7, 1.5, k), col = mixCol(C.foam, C.water, .15 + .75 * k);
      boilSeed('wave' + i);
      arc(HERO_X, WL + 2, r, .08, Math.PI - .08, w, col, 24);
      arc(HERO_X, WL + 2, r, Math.PI + .15, TAU - .15, w * .5, col, 20);
    }
  }
  function collar(a) {
    const on = ease(seg(a, .16, .3)) * (1 - .6 * seg(a, .5, 1.4));
    if (on <= .01) return;
    const W = 5.3 * U, h = .6 * U * on, n = 14, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = HERO_X - W + 2 * W * u, bump = .55 + .45 * Math.abs(Math.sin(u * 11 + a * 5));
      top.push([x, WL + 3 - h * bump * Math.sin(Math.PI * (.08 + .84 * u))]);
      bot.push([x, WL + 5 + h * .45 * Math.sin(Math.PI * u)]);
    }
    boilSeed('collar');
    paint([...top, ...bot.reverse()], { wash: SHEET_OUT, ink: null });
    if (on > .3) edge(top, .5);   // not while it's still a sliver: that reads as a line under Clawd
  }
  // Sunlight on the water, once the sun is out: the crest of each bigger drop's ring, and of the big wave, catches it
  // for a moment.
  function glints(t) {
    const w = seg(warm(t), .3, 1);
    if (w <= 0) return;
    const out = [];
    for (const d of S.drops) {
      const a = t - d.tLand;
      if (d.a < 2.5 || a < .05 || a > .3) continue;
      const k = (a - .05) / .25, rr = (5 + 60 * Math.sqrt(a / .55)) * Math.sqrt(d.a / 2), side = hash(d.id) < .5 ? -1 : 1;
      out.push([MX(d.xl) + side * rr * .5, WL + d.front * 12 + rr * FLAT * .85, (4 + 1.2 * d.a) * Math.sin(Math.PI * k), 'g' + d.id]);
    }
    const a = t - HERO.t, kw = seg(a, .2, 1.2);
    if (kw > 0 && kw < 1) {
      const r = lerp(3.8 * U, 16 * U, easeOut(seg(a, .06, 1.4)));
      for (let i = 0; i < 4; i++) {
        const k = frac(kw * 2.2 + hash(i + 70)), p = .5 + (i - 1.5) * .45;
        out.push([HERO_X + r * Math.cos(p), WL + 2 + r * FLAT * Math.sin(p), 10 * Math.sin(Math.PI * k) * (1 - kw), 'gw' + i]);
      }
    }
    for (const [x, y, r, key] of out.sort((p, q) => q[2] - p[2]).slice(0, 8)) {
      if (r * w < 1.5) continue;
      boilSeed(key);
      glow(x, y, r * w * 2.6, '#FFF1C8', .7 * w);
      paint(starPts(x, y, r * w, .2, 4, 0), { wash: PAL.cream, ink: null });
    }
  }

  // ------------------------------------------------------------ a foot pulling out
  // The water a lifting foot drags up with it: a neck of water under the foot that thins, snaps and falls back, while
  // the foot carries the rest off as drips (falls). Painted behind Clawd, so the leg covers whatever of it the foot
  // is still holding. Plus the ring of the hole closing.
  function clinging(t, m) {
    const a = t - m.t;
    if (a < 0 || a > .5) return;
    ring(MX(m.x), WL + 2, 4 + 40 * Math.sqrt(a / .5), a / .5, 'xr' + m.t);
    if (m === TAKEOFF || a > .22) return;
    const k = a / .22, up = easeOut(clamp(k / .35)), sink = easeIn(seg(k, .35, 1));
    const x = MX(m.x), h = 1.5 * U * up * (1 - sink), rb = .2 * U * (1 - sink), wb = .5 * U, wn = .09 * U;
    if (h < 4) return;
    const bead = rb > 2 * wn, cy = WL - h + rb, top = bead ? cy + Math.sqrt(rb * rb - wn * wn) : WL - h, L = [], R = [];
    for (let i = 0; i <= 6; i++) {   // from a mound on the water up a narrowing neck to a bead under the foot
      const u = i / 6, y = lerp(WL + 3, top, u), w = lerp(wb, wn, Math.sqrt(u));
      L.push([x - w, y]); R.push([x + w, y]);
    }
    const P = [...L];
    if (bead) { const a0 = Math.acos(-wn / rb), a1 = TAU + Math.acos(wn / rb); for (let i = 1; i < 10; i++) { const q = lerp(a0, a1, i / 10); P.push([x + rb * Math.cos(q), cy + rb * Math.sin(q)]); } }
    P.push(...R.reverse());
    boilSeed('cling' + m.t);
    paint(P, { wash: SHEET_IN, ink: null });
    edge(P, .45);
  }

  // ------------------------------------------------------------ the melody
  // A note of the melody pops off the water where its tuned bubble rang: the ink glyph of shot B's first note (head,
  // stem, flag), popping in, drifting up and away from Clawd (side: -1 = to the left), shrinking out. Paint it after
  // Clawd, or his body hides it. Shot B pops the first note itself; the jump's root is left to the big splash. The
  // glyph is s = 8 at shot B's zoom and grows in wider shots, so it reads at about the same size on screen.
  const NOTE_GLYPH = .9;
  function noteGlyph(x, y, s, k, key) {
    boilSeed(key);
    const sw = clamp(s / 15, .4, 2);
    push(); translate(x, y); rotate(.12 * Math.sin(k * 8));
    scale(backOut(Math.min(1, k * 5)) * (1 - easeIn(seg(k, .7, 1))));
    paint(ellPts(0, 1.2 * s, .7 * s, .5 * s, 12, 0, -.3), { wash: PAL.ink, ink: null });
    inkLine([[.6 * s, 1.1 * s], [.6 * s, -1.6 * s], [1.6 * s, -1 * s]], sw * .8, PAL.ink, 'ink', 0);
    pop();
  }
  function notes(t, side = -1) {
    const s = 8 * clamp(2.6 / (CAM ? CAM.zoom : 1), 1, 2), g = s / 8;
    for (const n of S.notes) {
      const k = (t - n.t) / NOTE_GLYPH;
      if (k <= 0 || k >= 1 || n.kind === 'dip' || n.beat === HERO.beat) continue;
      noteGlyph(MX(n.x) + side * (12 + 22 * k) * g + 3 * Math.sin(k * 6), WL - (12 + 40 * easeOut(k)) * g, s, k, 'note ' + n.beat);
    }
  }

  // ------------------------------------------------------------ the splashes, behind and in front of Clawd
  // At the takeoff the feet stand where the trot's last two footfalls put them: a pair's centre sits a little right of
  // its mark (its far leg stands right of the near one), +0.1u for the front pair (even k) and +0.25u for the back.
  const LAST_FEET = [TROT.n - 2, TROT.n - 1].map((k) => MX(mark(`D.trot#${k}`, 'step').x) + (k % 2 ? .25 : .1) * U);
  const CROWNS = [...STEPS.map((m) => [m, 0]), ...EXITS.flatMap((m) => m === TAKEOFF ? LAST_FEET.map((x) => [m, x - MX(m.x)]) : [[m, 0]])];
  const liveCrowns = (t) => CROWNS.map(([m, dx]) => crownAt(m, t, dx)).filter(Boolean);
  // One footfall's crown, the part on one side of Clawd.
  function crown(t, m, front) {
    const c = crownAt(m, t);
    if (c) (front ? crownFront : crownBack)(c);
  }
  function splashes(t, front) {
    const crowns = liveCrowns(t), a = t - HERO.t;
    if (!front && a > 0 && a < 1.7) wave(a);
    if (!front) for (const m of EXITS) clinging(t, m);
    drops(t, front, 220, crowns);
    for (const c of crowns) (front ? crownFront : crownBack)(c);
    if (front && a > 0 && a < 1.5) collar(a);
    if (front) glints(t);
  }


  Object.assign(PLK, { arc, ring, drops, landings, bubbles, crown, falls, splashes, notes, noteGlyph });
})();
