// Sound of a foot stepping into water, synthesized from the acoustics of bubbles and droplets.
//
// physics layer  makeStep / makeWalk : step parameters -> list of acoustic events
// audio layer    render              : events -> stereo PCM
//
// Event kinds:
//   mode  : exponentially decaying sinusoid with a linear frequency glide (bubbles, thuds)
//   burst : enveloped band-limited noise (slaps, droplet ticks, spray, slosh grains)
//   chirp : a tone with harmonics along a pitch curve (birds, giggles; scores only)
//   swish : noise through a band sweeping in frequency (whooshes; scores only)

export const SR = 48000;
const G = 9.81;
const MINNAERT = 3.26; // f·r [Hz·m] of an air bubble in water at 1 atm: sqrt(3γp0/ρ) / 2π

// ---------------------------------------------------------------- randomness

export function makeRng(seed) {
  let s = seed >>> 0;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
  return {
    u,
    normal,
    range: (lo, hi) => lo + (hi - lo) * u(),
    logn: (median, sigma) => median * Math.exp(sigma * normal()),
    // Gamma(2, theta): rises from 0, peaks at theta, long tail
    gamma2: (theta) => -theta * Math.log((1 - u()) * (1 - u())),
    poisson(mean) {
      if (mean <= 0) return 0;
      if (mean > 40) return Math.max(0, Math.round(mean + Math.sqrt(mean) * normal()));
      const L = Math.exp(-mean);
      let k = 0, p = 1;
      do { k++; p *= u(); } while (p > L);
      return k - 1;
    },
    // density per unit log-radius ∝ r^-gamma on [lo, hi]
    powerLaw(lo, hi, gamma) {
      if (Math.abs(gamma) < 1e-6) return lo * Math.pow(hi / lo, u());
      const a = Math.pow(lo, -gamma), b = Math.pow(hi, -gamma);
      return Math.pow(a + (b - a) * u(), -1 / gamma);
    },
    chance: (p) => u() < p,
  };
}

// ---------------------------------------------------------------- physics layer

export const DEFAULTS = {
  depth: 0.12,     // water depth [m]
  footSpeed: 1.5,  // downward foot speed when it meets the surface [m/s]
  slap: 1,         // how flat the sole meets the surface: 0 = slices in, 1 = flat slap
  spray: 1,        // multiplier on water thrown up (blobs + droplets)
  bubbles: 1,      // multiplier on entrained bubbles
  xi: 0.15,        // pitch-rise factor of near-surface bubbles (van den Doel's ξ)
  alpha: 0.5,      // bubble loudness ∝ r^alpha
  hardness: 0.3,   // ground under the water: 0 = sand/mud, 1 = concrete
  exit: false,     // also lift the foot back out
  stance: 0.6,     // s between entry and lift-off
  ambience: 0.3,   // leftover water movement between events (lapping, stray bubbles)
  reverb: 0.08,
  mix: {},         // per-component gain on top of the physics, e.g. { cloud: 2 }
};

export const PRESETS = {
  puddle: { depth: 0.02, footSpeed: 2.0, hardness: 0.9, spray: 1.4, slap: 1 },
  ankle: { depth: 0.12, footSpeed: 1.5, hardness: 0.3, slap: 0.6 },
  shin: { depth: 0.25, footSpeed: 1.4, hardness: 0.2, spray: 0.8, bubbles: 1.3, slap: 0.5 },
};

const R0 = 0.002; // reference bubble radius for loudness scaling

// Minnaert bubble with van den Doel's damping d = 0.043 f + 0.0014 f^1.5 and rising pitch
// f(t) = f0 (1 + xi·d·t), capped when the bubble reaches the surface.
// attackCycles: how many periods the excitation takes; a drip's pinch-off is near-instant (the crisp start of a
// "plink"), a bubble torn out of a turbulent pocket is excited over about a cycle.
function bubble(src, t, r, amp, xi, pan, { damp = 1, cap = 1.6, attackCycles = 0.3 } = {}) {
  const f = MINNAERT / r;
  const d = (0.043 * f + 0.0014 * Math.pow(f, 1.5)) * damp;
  return { kind: 'mode', src, t, f, d, sigma: xi * d, fEnd: f * cap, amp, attack: attackCycles / f, pan, r };
}

function burst(src, t, amp, attack, decay, hp, lp, pan) {
  return { kind: 'burst', src, t, amp, attack, decay, hp, lp, pan };
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// Painter metadata. When a score asks for it (p.world = { x, m }: the foot's position in metres and a separate
// random stream), events carry `meta` describing where they happen, so an animation can draw each droplet, bubble
// and drip in sync with its sound. Plain makeStep/makeWalk never set p.world and render exactly as before.
function tag(ev, n0, meta) {
  for (let i = n0; i < ev.length; i++) ev[i].meta = meta;
}
// a thrown droplet or blob: launched at tl from the crown around the foot (radius rim, m), lands at tLand
function flight(p, tl, tLand, vz, a, rim = 0.05) {
  const { x, m } = p.world, phi = m.u() * 2 * Math.PI, vh = vz * m.range(0.25, 1.0);
  return { kind: 'fly', tl, tLand, x0: x + rim * Math.cos(phi), vx: vh * Math.cos(phi), vz, a, front: Math.sin(phi) };
}

// One parcel of trapped air torn into n bubbles around a size scale, all within a few ms.
// Bubbles near the surface (D -> 1) are louder and glide up in pitch.
function pocket(ev, rng, p, src, t, scale, n, amp, xiScale, pan, damp = 1.6) {
  const n0 = ev.length;
  for (let i = 0; i < n; i++) {
    const r = clamp(scale * rng.logn(1, 0.4), 0.0002, 0.012);
    const D = rng.u() ** 2;
    ev.push(bubble(src, t + Math.abs(rng.normal()) * 0.002, r, amp * D * Math.pow(r / R0, p.alpha),
      p.xi * xiScale * (0.3 + D), pan + rng.range(-0.05, 0.05), { damp, attackCycles: 1 }));
  }
  if (p.world) tag(ev, n0, { kind: 'bubble', x: p.world.x + p.world.m.normal() * 0.04 });
}

// Water hitting water. The knock lasts about the contact time a/v, which also caps how bright it is
// (a 2 mm drip at 2 m/s: ~1 ms, a dull "tup"); its pressure grows as a·v².
function impact(ev, rng, src, t, a, v, k, pan) {
  const tc = a / v;
  ev.push(burst(src, t, k * (a / 0.001) * (v / 1.5) ** 2, 0.5 * tc, tc * rng.range(1, 2), 250,
    clamp((2 * v) / a, 1500, 8000), pan));
}

// A blob of water (equivalent radius `size`) landing at speed v: a splat plus a few bubbles.
function miniSplash(ev, rng, p, src, t, size, v, pan) {
  const s = size / 0.002;
  impact(ev, rng, src, t, size, v, 0.012, pan);
  const nb = rng.poisson(0.4 + (0.6 * s * v) / 1.5);
  for (let i = 0; i < nb; i++) {
    const r = size * rng.range(0.15, 0.6);
    ev.push(bubble(src, t + rng.range(5e-4, 4e-3), r, 0.1 * rng.u() ** 2 * Math.pow(r / R0, p.alpha),
      p.xi * rng.range(0.5, 2), pan + rng.range(-0.05, 0.05), { cap: 1.8 }));
  }
}

// A fine droplet of radius a landing at vertical speed vz. The impact itself is soft (p ∝ a·v², and these
// drops are slow) and mist is silent; what makes a drop audible is the bubble it sometimes traps.
function dropImpact(ev, rng, p, src, t, a, vz, pan) {
  if (a >= 0.0004) impact(ev, rng, src, t, a, vz, 0.018, pan);
  if (rng.chance(clamp((a - 0.0006) / 0.003, 0, 0.5))) {
    const r = a * rng.range(0.8, 1.6);
    ev.push(bubble(src, t + rng.range(5e-4, 3e-3), r, 0.06 * rng.range(0.3, 1) * Math.pow(r / R0, p.alpha),
      p.xi * rng.range(0.7, 2), pan, { cap: 1.8 }));
  }
}

function entry(p, rng, t0, pan, ev) {
  const v = p.footSpeed;
  const E = (v / 1.5) ** 2;                   // kinetic-energy scale relative to a normal step
  const k = Math.pow(v / 1.5, 1.5);
  const deep = Math.min(p.depth / 0.15, 2);   // 0 = film of water, 1 = ankle deep
  const film = Math.max(0, 1 - deep);         // thin water gets squeezed out from under the sole
  const tBottom = p.depth / (0.6 * v);        // the foot decelerates on its way down

  // slap: the sole's contact line sweeps the surface in a few ms (heel), then the forefoot lands
  const slap = (t, amp) => {
    for (let i = 0; i < 14; i++) {
      const dt = rng.gamma2(0.0012);
      ev.push(burst('slap', t + dt, amp * rng.logn(0.5, 0.4) * Math.exp(-dt / 0.004), 1e-4,
        rng.range(0.001, 0.004), 400, rng.range(3000, 9000), pan + rng.range(-0.05, 0.05)));
    }
    // air cushion trapped under the sole: a big, heavily damped pocket
    ev.push({ kind: 'mode', src: 'slap', t, f: rng.range(160, 300), d: rng.range(90, 160), sigma: 0, fEnd: 0,
      amp: 0.5 * amp, attack: 0.001, pan });
    ev.push(burst('slap', t, 0.4 * amp, 0.002, 0.018, 60, 500, pan));
  };
  const slapAmp = 0.6 * k * p.slap;
  slap(t0, slapAmp);
  slap(t0 + rng.range(0.025, 0.05), slapAmp * rng.range(0.35, 0.6));

  // heel hits the ground under the water; water above it muffles what reaches the air
  const muffle = 1 / (1 + 3 * deep);
  const fThud = 60 + 90 * p.hardness;
  ev.push({ kind: 'mode', src: 'thud', t: t0 + tBottom, f: fThud, d: 50 + 70 * p.hardness, sigma: -1.5, fEnd: 0.8 * fThud,
    amp: 0.5 * muffle * k, attack: 0.002, pan });
  ev.push(burst('thud', t0 + tBottom, 0.4 * muffle * p.hardness * k, 3e-4, 0.003 + 0.01 * (1 - p.hardness),
    80, 800 + 5000 * p.hardness * muffle, pan));

  // crown: the sheet thrown up around the foot tears into ligaments and droplets
  const nCrown = rng.poisson(200 * E * p.spray * (1 + film));
  for (let i = 0; i < nCrown; i++) {
    ev.push(burst('crown', t0 + rng.gamma2(0.012), 0.05 * rng.logn(1, 0.6), 1e-4, rng.range(5e-4, 3e-3),
      1500, 10000, pan + rng.range(-0.3, 0.3)));
  }

  // fizz: small bubbles entrained at the crown
  const nFizz = rng.poisson(400 * E * p.bubbles * (0.3 + 0.7 * Math.min(deep, 1)));
  for (let i = 0; i < nFizz; i++) {
    const r = rng.powerLaw(0.00035, 0.0015, 1.0);
    const D = rng.u() ** 2;
    ev.push(bubble('fizz', t0 + 0.003 + rng.gamma2(0.022), r, 0.12 * D * Math.pow(r / R0, p.alpha), p.xi * D,
      pan + rng.range(-0.2, 0.2)));
    if (p.world) tag(ev, ev.length - 1, { kind: 'bubble', x: p.world.x + p.world.m.normal() * 0.06 });
  }

  // cloud: air dragged down by the foot, torn into pockets of bubbles
  const nPockets = rng.poisson(35 * E * p.bubbles * Math.min(deep, 1.5));
  for (let i = 0; i < nPockets; i++) {
    const t = t0 + 0.005 + rng.gamma2(0.025 + 0.02 * deep);
    const scale = clamp(rng.logn(0.0025 * (0.7 + 0.3 * Math.min(deep, 1.5)), 0.5), 0.0008, 0.008);
    pocket(ev, rng, p, 'cloud', t, scale, 1 + rng.poisson(2.5), 0.15, 1, pan + rng.range(-0.15, 0.15));
  }

  // the air cavity above the foot pinches off: a few large, near-surface bubbles ("bloop")
  if (deep > 0.5) {
    const n = 1 + rng.poisson(1.5 * Math.min(deep, 1.5) * E);
    for (let i = 0; i < n; i++) {
      const r = rng.range(0.004, 0.009) * (0.8 + 0.3 * Math.min(deep, 1.5));
      ev.push(bubble('bloop', t0 + tBottom * rng.range(0.5, 1.2) + rng.range(0, 0.04), r,
        0.2 * rng.range(0.4, 1) * Math.pow(r / 0.006, p.alpha), p.xi * rng.range(1, 2.5), pan, { damp: 2.5, cap: 1.5 }));
      if (p.world) tag(ev, ev.length - 1, { kind: 'bubble', x: p.world.x + p.world.m.normal() * 0.02 });
    }
  }

  // slosh: water rushing back around the foot, low grains + gurgling pockets
  if (deep > 0.1) {
    const nSlosh = rng.poisson(160 * Math.min(deep, 1.5) * E);
    const fade = (t) => Math.exp(-(t - t0) / 0.2);
    for (let i = 0; i < nSlosh; i++) {
      const t = t0 + 0.03 + rng.gamma2(0.06 + 0.03 * deep);
      ev.push(burst('slosh', t, 0.03 * fade(t) * rng.logn(1, 0.5), 0.003,
        rng.range(0.006, 0.025), 120, rng.range(700, 1800), pan + rng.range(-0.3, 0.3)));
    }
    const nGurgle = rng.poisson(12 * Math.min(deep, 1.5) * E * p.bubbles);
    for (let i = 0; i < nGurgle; i++) {
      const t = t0 + 0.05 + rng.gamma2(0.08);
      pocket(ev, rng, p, 'gurgle', t, clamp(rng.logn(0.003, 0.5), 0.001, 0.008),
        1 + rng.poisson(1.5), 0.14 * fade(t), 1.5, pan + rng.range(-0.3, 0.3));
    }
  }

  // thrown-up water falls back on ballistic flights T = 2 vz / g: blobs splat, fine droplets tick
  const nBlobs = rng.poisson(25 * E * p.spray * (1 + film + 0.5 * Math.min(deep, 1)));
  for (let i = 0; i < nBlobs; i++) {
    const vz = Math.min(rng.logn(0.5 * v, 0.45), 2.5);
    const tl = t0 + rng.gamma2(0.008);
    const tLand = tl + ((2 * vz) / G) * rng.range(0.85, 1.05);
    const size = rng.powerLaw(0.001, 0.008, 1.5), n0 = ev.length;
    miniSplash(ev, rng, p, 'spray', tLand, size, vz, pan + rng.range(-0.5, 0.5));
    if (p.world) tag(ev, n0, flight(p, tl, tLand, vz, size));
  }
  const nDrops = rng.poisson(250 * E * p.spray * (1 + film));
  for (let i = 0; i < nDrops; i++) {
    const vz = Math.min(rng.logn(0.6 * v, 0.45), 2.8);
    const tl = t0 + rng.gamma2(0.006);
    const tLand = tl + ((2 * vz) / G) * rng.range(0.85, 1.05);
    const a = rng.powerLaw(0.0002, 0.0015, 1.5), n0 = ev.length;
    dropImpact(ev, rng, p, 'drop', tLand, a, vz, pan + rng.range(-0.5, 0.5));
    if (p.world) tag(ev, n0, flight(p, tl, tLand, vz, a));
  }
}

function exit(p, rng, t0, pan, ev) {
  const deep = Math.min(p.depth / 0.15, 2);
  // water closing in behind the heel as it leaves: near-surface pockets gliding up ("shlup")
  const nPockets = rng.poisson(10 * Math.min(deep, 1.5) * p.bubbles + 2);
  for (let i = 0; i < nPockets; i++) {
    pocket(ev, rng, p, 'exit', t0 + rng.gamma2(0.015), clamp(rng.logn(0.003, 0.4), 0.001, 0.008),
      1 + rng.poisson(2), 0.07, 2.5, pan);
  }
  // sheets of water sliding off the shoe land back
  const nBlobs = rng.poisson(8 * Math.min(deep, 1.2) + 2);
  for (let i = 0; i < nBlobs; i++) {
    const n0 = ev.length;
    miniSplash(ev, rng, p, 'exit', t0 + 0.02 + rng.gamma2(0.03), rng.powerLaw(0.001, 0.006, 1.5),
      rng.range(0.8, 2), pan + rng.range(-0.1, 0.1));
    if (p.world) tag(ev, n0, { kind: 'fall', x: p.world.x + p.world.m.normal() * 0.03, h: p.world.m.range(0.03, 0.1) });
  }
  // drips from the swinging foot, further and further apart: the classic "plink"
  let td = t0 + rng.range(0.12, 0.2);
  const nDrips = 2 + rng.poisson(5 * Math.min(deep, 1.2) + 1);
  for (let k = 0; k < nDrips; k++) {
    const h = rng.range(0.1, 0.35), vz = Math.sqrt(2 * G * h);
    const a = rng.range(0.0015, 0.0028);
    const dp = pan + 0.05 * k, n0 = ev.length;
    impact(ev, rng, 'drip', td, a, vz, 0.018, dp);
    if (rng.chance(0.75)) {
      const r = a * rng.range(0.6, 1.3);
      ev.push(bubble('drip', td + rng.range(0.001, 0.004), r, 0.08 * rng.range(0.4, 1) * Math.pow(r / R0, p.alpha),
        p.xi * rng.range(1, 3), dp, { cap: 2 }));
    }
    if (p.world) tag(ev, n0, { kind: 'fall', x: p.world.x + 0.04 * k, h, a });
    td += rng.logn(0.06 * Math.pow(1.35, k), 0.4);
  }
}

// After a step the water settles: ripples lapping at the legs and the odd bubble surfacing, densest right after
// the footfall and dying away over about a second.
function ripples(p, rng, t0, ev) {
  if (p.ambience <= 0) return;
  const deep = Math.min(p.depth / 0.15, 2);
  const settle = () => t0 + 0.15 + rng.gamma2(0.35);
  const nLap = rng.poisson(40 * p.ambience * (0.3 + deep));
  for (let i = 0; i < nLap; i++) {
    ev.push(burst('ambience', settle(), 0.003 * rng.logn(1, 0.4), 0.012, rng.range(0.02, 0.05), 100,
      rng.range(400, 900), rng.range(-0.6, 0.6)));
  }
  const nBub = rng.poisson(4 * p.ambience * deep);
  for (let i = 0; i < nBub; i++) {
    ev.push(bubble('ambience', settle(), rng.range(0.001, 0.004), 0.01 * rng.u(), p.xi * rng.range(1, 3),
      rng.range(-0.6, 0.6)));
  }
}

export function makeStep(params = {}, seed = 1) {
  const p = { ...DEFAULTS, ...params };
  const rng = makeRng(seed);
  const ev = [];
  const t0 = 0.05;
  entry(p, rng, t0, 0, ev);
  let duration = t0 + 1.3;
  if (p.exit) {
    exit(p, rng, t0 + p.stance, 0, ev);
    duration = t0 + p.stance + 1.0;
  }
  ripples(p, rng, t0, ev);
  return { events: ev, duration, params: p };
}

export function makeWalk(params = {}, seed = 1, { steps = 6, interval = 0.85 } = {}) {
  const p = { ...DEFAULTS, ...params };
  const rng = makeRng(seed);
  const ev = [];
  let t = 0.1;
  for (let i = 0; i < steps; i++) {
    const pan = (i % 2 ? 0.2 : -0.2) + rng.range(-0.05, 0.05);
    // no two steps alike: uneven bottom, varying push, a heavier footfall now and then
    const pi = { ...p, footSpeed: p.footSpeed * rng.logn(1, 0.2), depth: p.depth * rng.logn(1, 0.15),
      spray: p.spray * rng.logn(1, 0.4), bubbles: p.bubbles * rng.logn(1, 0.3) };
    entry(pi, rng, t, pan, ev);
    ripples(pi, rng, t, ev);
    exit(pi, rng, t + 1.2 * interval + rng.range(-0.04, 0.04), pan, ev);
    t += interval * rng.logn(1, 0.07);
  }
  return { events: ev, duration: t + 1.2 * interval + 1.0, params: p };
}

// ---------------------------------------------------------------- scores: the film's cues (synth/CUES.md)

// Equal-tempered frequency of a note name ("A5", "C#6", "Bb4"); a number passes through as Hz.
export function pitch(n) {
  if (typeof n === 'number') return n;
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error(`not a note: ${n}`);
  const semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (semi + 12 * (Number(m[3]) - 4)) / 12);
}

// A bubble tuned to pitch f, i.e. of Minnaert radius r = 3.26/f. It glides up into its pitch from `glide` below
// within `rise` s (a bubble nearing the surface), then rings there instead of bursting at the cap, so a run of them
// reads as a melody. damp < 1 rings a little longer than van den Doel's damping.
function tuned(t, f, amp, pan, { glide = 0.05, rise = 0.02, damp = 0.35, attackCycles = 1 } = {}) {
  const f0 = f / (1 + glide), d = (0.043 * f + 0.0014 * Math.pow(f, 1.5)) * damp;
  return { kind: 'mode', src: 'note', t, f: f0, d, sigma: glide / rise, fEnd: f, amp, attack: attackCycles / f0, pan,
    r: MINNAERT / f, hold: true };
}

// A shy first touch of still water with a toe. On contact the surface snaps onto the toe (a soft "tk"), the water
// pushed aside goes "tup", a bubble or two is trapped at the contact line and a few droplets flick up and tick back
// down. As the toe lifts, the liquid bridge under it stretches and snaps ("tl-"), and the drop it leaves falls back
// and pinches off one bubble: the "plink" (a note of the melody when c.note is set). Returns the plink's time.
function dip(p, rng, c, ev) {
  const pan = c.pan ?? 0, t = c.t, meta = { kind: 'dip', x: c.x, touch: t, plink: c.plinkAt };
  let n0 = ev.length;
  ev.push(burst('dip', t, 0.03, 6e-4, 0.003, 300, 3500, pan));
  const fTup = rng.range(300, 380);
  ev.push({ kind: 'mode', src: 'dip', t, f: fTup, d: 70, sigma: 4, fEnd: 1.3 * fTup, amp: 0.08, attack: 0.003, pan });
  // water sliding around the toe as it presses in, fading
  for (let i = 0; i < 5; i++) {
    const dt = 0.004 + rng.gamma2(0.03);
    ev.push(burst('dip', t + dt, 0.018 * Math.exp(-dt / 0.08) * rng.logn(1, 0.3), 0.003, rng.range(0.01, 0.025), 150,
      rng.range(700, 1400), pan + rng.range(-0.1, 0.1)));
  }
  for (let i = 1 + rng.poisson(0.8); i > 0; i--) {
    const r = rng.range(0.0009, 0.0018);
    ev.push(bubble('dip', t + rng.range(0.003, 0.02), r, 0.03 * rng.range(0.5, 1) * Math.pow(r / R0, p.alpha),
      p.xi * rng.range(1, 2), pan, { attackCycles: 1 }));
  }
  tag(ev, n0, meta);
  // droplets flicked up by the meniscus around the toe
  for (let i = 3 + rng.poisson(2); i > 0; i--) {
    const vz = rng.range(0.25, 0.7), a = rng.range(0.0004, 0.0011), tl = t + rng.range(0, 0.012);
    const tLand = tl + (2 * vz) / G;
    n0 = ev.length;
    impact(ev, rng, 'dip', tLand, a, vz, 0.018, pan);
    if (rng.chance(0.6)) {
      const r = a * rng.range(0.9, 1.5);
      ev.push(bubble('dip', tLand + rng.range(5e-4, 2e-3), r, 0.03 * rng.range(0.4, 1) * Math.pow(r / R0, p.alpha),
        p.xi * rng.range(1, 2), pan, { cap: 1.8 }));
    }
    tag(ev, n0, flight(p, tl, tLand, vz, a, 0.012));
  }
  // the lift: the bridge snaps, and its drop falls back and pinches off the plink
  const tSnap = c.plinkAt - (c.fall ?? 0.03), fTl = rng.range(550, 700);
  n0 = ev.length;
  ev.push(burst('dip', tSnap, 0.02, 8e-4, 0.004, 400, 2500, pan));
  ev.push({ kind: 'mode', src: 'dip', t: tSnap, f: fTl, d: 110, sigma: 15, fEnd: 1.4 * fTl, amp: 0.05, attack: 0.002, pan });
  impact(ev, rng, 'dip', c.plinkAt - 0.002, 0.0015, 0.8, 0.018, pan);
  const r = c.note ? MINNAERT / pitch(c.note) : c.r ?? 0.0035;
  ev.push(c.note ? tuned(c.plinkAt, pitch(c.note), c.amp ?? 0.25, pan, c.tune)
    : bubble('dip', c.plinkAt, r, c.amp ?? 0.25, c.xi ?? 0.5, pan, { cap: 1.8 }));
  Object.assign(meta, { r, snap: tSnap });
  tag(ev, n0, meta);
  return c.plinkAt;
}

// One drop falling from height h (m) onto the water: a soft knock, then its bubble's plink (a note of the melody
// when c.note is set). Returns the plink's time.
function drip(p, rng, c, ev) {
  const h = c.h ?? 0.2, a = c.a ?? 0.0025, vz = Math.sqrt(2 * G * h), n0 = ev.length, pan = c.pan ?? 0;
  impact(ev, rng, 'drip', c.t, a, vz, 0.018, pan);
  ev.push(c.note ? tuned(c.t + 0.002, pitch(c.note), c.amp ?? 0.12, pan, c.tune)
    : bubble('drip', c.t + 0.002, c.r ?? a * 1.2, c.amp ?? 0.12, c.xi ?? 0.45, pan, { cap: 2 }));
  tag(ev, n0, { kind: 'fall', x: c.x, h, a });
  return c.t + 0.002;
}

// A lone tuned bubble: a note of the melody. Returns its time.
function note(c, ev) {
  ev.push(tuned(c.t, pitch(c.note), c.amp ?? 0.15, c.pan ?? 0, c.tune));
  if (c.x !== undefined) tag(ev, ev.length - 1, { kind: 'bubble', x: c.x });
  return c.t;
}

// A shallow stream babbling in the background (van den Doel's stream: a steady rain of mid-size bubbles) with a
// little lapping. Fades in and out over `fade` s so it can sit under a whole film.
function stream(p, rng, c, ev) {
  const { t0, t1, level = 1, fade = 1 } = c;
  const env = (t) => level * Math.min(1, (t - t0) / fade, (t1 - t) / fade);
  const nBub = rng.poisson(220 * (t1 - t0) * level);
  for (let i = 0; i < nBub; i++) {
    const t = rng.range(t0, t1), r = rng.powerLaw(0.0008, 0.006, 1.4), D = rng.u() ** 2;
    ev.push(bubble('stream', t, r, 0.03 * env(t) * D * Math.pow(r / R0, p.alpha), p.xi * (0.4 + D),
      rng.range(-0.8, 0.8), { damp: 1.3, attackCycles: 1 }));
  }
  const nLap = rng.poisson(18 * (t1 - t0) * level);
  for (let i = 0; i < nLap; i++) {
    const t = rng.range(t0, t1);
    ev.push(burst('stream', t, 0.004 * env(t) * rng.logn(1, 0.4), 0.012, rng.range(0.02, 0.05), 100,
      rng.range(400, 900), rng.range(-0.8, 0.8)));
  }
}

// One bird's phrase from t: a given song (`song` name) or a random one, each chirp at amp × 0.6–1, all panned alike.
const SONGS = {
  // "tsip-tsip": short high down-sweeps
  tsip: (rng) => Array.from({ length: 2 + rng.poisson(1.5) }, () => {
    const f = rng.range(4800, 6200);
    return { dur: rng.range(0.025, 0.04), fk: [[0, f], [1, 0.72 * f]], gap: rng.range(0.05, 0.09) };
  }),
  // "chirrup": trilled up-sweeps
  chirrup: (rng) => Array.from({ length: 1 + rng.poisson(1) }, () => {
    const f = rng.range(2600, 3300);
    return { dur: rng.range(0.06, 0.09), fk: [[0, f], [1, 1.45 * f]], vr: rng.range(35, 55), vd: 0.07, gap: rng.range(0.06, 0.1) };
  }),
  // "tee-too": a falling two-note whistle
  teetoo: (rng) => {
    const f = rng.range(2700, 3200);
    return [{ dur: 0.11, fk: [[0, f], [1, f]], vr: 12, vd: 0.01, gap: 0.06 },
      { dur: 0.13, fk: [[0, 0.84 * f], [1, 0.8 * f]], vr: 12, vd: 0.01, gap: 0 }];
  },
};
function birdPhrase(rng, ev, t, amp, pan, song) {
  const names = Object.keys(SONGS);
  let tc = t;
  for (const s of SONGS[song ?? names[Math.floor(rng.u() * names.length)]](rng)) {
    ev.push({ kind: 'chirp', src: 'birds', t: tc, dur: s.dur, fk: s.fk, vr: s.vr ?? 0, vd: s.vd ?? 0, harm: [1, 0.08],
      attack: 0.005, release: Math.min(0.015, s.dur / 2), amp: amp * rng.range(0.6, 1), pan });
    tc += s.dur + s.gap;
  }
}

// Birds once the sun is out: now and then one sings a short phrase somewhere off to a side, more often and a little
// louder as the light warms (from t to tFull). They fall quiet `hush` s before t1.
function birds(rng, c, ev) {
  const rate = c.rate ?? 0.45, tFull = c.tFull ?? c.t1;
  let t = c.t + rng.range(0.2, 0.8);
  while (t < c.t1 - (c.hush ?? 1)) {
    const w = clamp((t - c.t) / Math.max(tFull - c.t, 1e-3), 0.35, 1);
    const pan = rng.range(0.35, 0.85) * (rng.chance(0.5) ? -1 : 1);
    birdPhrase(rng, ev, t, 0.014 * w, pan);
    t += rng.gamma2(1 / (2 * rate * w)) + 0.3;
  }
}

// One bird, far off: a single phrase at the cue, softer than the birds' song.
function bird(rng, c, ev) {
  birdPhrase(rng, ev, c.t, 0.006, c.pan ?? 0.6, c.song);
}

// Cartoon sounds for what Clawd does. They are soft: the water stays in front.
const CARTOON = {
  // air rushing past a body: noise in a band sweeping from f0 to f1 Hz (upward for a take-off), swelling to its
  // loudest at `peak` of its length, gliding from pan to pan1
  whoosh(c, ev) {
    const pan = c.pan ?? 0;
    ev.push({ kind: 'swish', src: 'whoosh', t: c.t, dur: c.dur ?? 0.35, f0: c.f0 ?? 500, f1: c.f1 ?? 1500, q: c.q ?? 2.5,
      peak: c.peak ?? 0.35, amp: 0.1, pan, pan1: c.pan1 ?? pan });
  },
  // a "!": a big bubble snapping up to the surface, a quick upward glide that bursts
  pop(c, ev) {
    const f = pitch(c.note ?? 420);
    ev.push({ kind: 'mode', src: 'pop', t: c.t, f, d: 40, sigma: 60, fEnd: 2.2 * f, amp: 0.07, attack: 0.002, pan: c.pan ?? 0 });
  },
  // delight: a quick rising sparkle of tiny bells in the key (partials 1 and 2.76, as on a glockenspiel bar)
  twinkle(c, ev) {
    const pan = c.pan ?? 0, notes = c.notes ?? ['A6', 'D7', 'F#7', 'A7'];
    notes.forEach((n, i) => {
      const f = pitch(n), t = c.t + i * (c.gap ?? 0.065), a = 0.02 * (1 - 0.12 * i);
      const pi = pan + 0.12 * (i - (notes.length - 1) / 2);
      ev.push({ kind: 'mode', src: 'twinkle', t, f, d: 9, sigma: 0, fEnd: 0, amp: a, attack: 0.002, pan: pi });
      ev.push({ kind: 'mode', src: 'twinkle', t, f: 2.76 * f, d: 30, sigma: 0, fEnd: 0, amp: 0.3 * a, attack: 0.002, pan: pi });
    });
  },
  // a giggle without words: quick voiced blips ("hee-hee-hee"), each a breath of air then a voiced lift and drop in
  // pitch, the laugh sliding down as it runs out of breath
  giggle(c, ev, rng) {
    const n = c.n ?? 4, f = pitch(c.pitch ?? 'A5'), gap = c.gap ?? 0.1, pan = c.pan ?? 0;
    let t = c.t;
    for (let i = 0; i < n; i++) {
      const fi = f * Math.pow(2, (-0.8 * i) / 12) * rng.logn(1, 0.03), a = 0.02 * (1 - 0.1 * i), dur = rng.range(0.055, 0.075);
      ev.push(burst('giggle', t, 0.25 * a, 0.004, 0.012, 1200, 5000, pan));
      ev.push({ kind: 'chirp', src: 'giggle', t: t + 0.006, dur, fk: [[0, 0.94 * fi], [rng.range(0.25, 0.45), 1.06 * fi], [1, 0.86 * fi]],
        harm: [1, 0.5, 0.25, 0.1], attack: 0.008, release: 0.035, amp: a, pan });
      t += gap * rng.logn(1, 0.1);
    }
  },
  // a warm soft chime: a chord of bell tones (partials 1, 2, 3, the higher fading faster), gently rolled
  chime(c, ev) {
    const pan = c.pan ?? 0, notes = c.notes ?? ['D5', 'F#5', 'A5', 'D6'];
    notes.forEach((n, i) => {
      const f = pitch(n), t = c.t + i * (c.roll ?? 0.03), pi = pan + 0.2 * (i / Math.max(1, notes.length - 1) - 0.5);
      for (const [k, a, dk] of [[1, 1, 1], [2, 0.25, 2.5], [3, 0.08, 4]]) {
        ev.push({ kind: 'mode', src: 'chime', t, f: k * f, d: 2.2 * dk, sigma: 0, fEnd: 0, amp: 0.012 * a, attack: 0.015, pan: pi });
      }
    });
  },
  // a small body landing on grass (or plopping down to sit): the ground's dull thud gliding down, the blades crushed
  // under it (a brief rustle) and, when wet, water shaken off the feet pattering on the grass
  thump(c, ev, rng) {
    const w = c.weight ?? 1, pan = c.pan ?? 0, rustle = c.rustle ?? 1, f = rng.range(150, 190) * Math.pow(w, -0.3);
    ev.push({ kind: 'mode', src: 'thump', t: c.t, f, d: 45, sigma: -3, fEnd: 0.8 * f, amp: 0.1 * w, attack: 0.004, pan });
    ev.push(burst('thump', c.t, 0.05 * w, 0.003, 0.025, 40, 500, pan));
    for (let i = Math.round(14 * rustle); i > 0; i--) {
      const dt = rng.gamma2(0.015);
      ev.push(burst('thump', c.t + dt, 0.01 * w * rustle * rng.logn(1, 0.4) * Math.exp(-dt / 0.05), 0.002,
        rng.range(0.004, 0.012), 1500, rng.range(4000, 8000), pan + rng.range(-0.15, 0.15)));
    }
    for (let i = rng.poisson(8 * (c.wet ?? 0)); i > 0; i--) {
      ev.push(burst('thump', c.t + rng.range(0.01, 0.15), 0.006 * rng.logn(1, 0.5), 0.001, rng.range(0.003, 0.008), 600,
        rng.range(2500, 5000), pan + rng.range(-0.3, 0.3)));
    }
  },
  // a tiny glass "tink"
  tink(c, ev) {
    const f = pitch(c.note ?? 'A7'), pan = c.pan ?? 0;
    ev.push({ kind: 'mode', src: 'tink', t: c.t, f, d: 22, sigma: 0, fEnd: 0, amp: 0.02, attack: 0.001, pan });
    ev.push({ kind: 'mode', src: 'tink', t: c.t, f: 2.76 * f, d: 50, sigma: 0, fEnd: 0, amp: 0.006, attack: 0.001, pan });
  },
};
export const CUE_KINDS = ['step', 'exit', 'dip', 'drip', 'note', 'stream', 'birds', 'bird', ...Object.keys(CARTOON)];

// A timeline of cues, rendered as one scene. A cue is { kind, t (s), x (m), pan, gain, ...its own params }
// (synth/CUES.md); a cue with its own `seed` keeps its randomness when other cues are added or moved. Events carry
// painter metadata; `marks` lists the cues' own moments (footfalls, lifts, dips, drips, cartoon sounds) and `notes`
// the melody's tuned bubbles.
export function makeScore(cues, seed = 1, { duration, reverb } = {}) {
  const shared = makeRng(seed), sharedM = makeRng(seed ^ 0x2545f491);
  const ev = [], marks = [], notes = [];
  for (const c of cues) {
    const rng = c.seed === undefined ? shared : makeRng(c.seed);
    const m = c.seed === undefined ? sharedM : makeRng(c.seed ^ 0x2545f491);
    const p = { ...DEFAULTS, ...(c.params || {}), world: { x: c.x ?? 0, m } };
    const pan = c.pan ?? 0, mark = { kind: c.kind, t: c.t, x: c.x, beat: c.beat }, n0 = ev.length;
    let tNote;
    if (c.kind === 'step') {
      entry(p, rng, c.t, pan, ev);
      ripples(p, rng, c.t, ev);
      Object.assign(mark, { depth: p.depth, v: p.footSpeed, tBottom: p.depth / (0.6 * p.footSpeed) });
    } else if (c.kind === 'exit') exit(p, rng, c.t, pan, ev);
    else if (c.kind === 'dip') { tNote = dip(p, rng, c, ev); mark.plinkAt = c.plinkAt; }
    else if (c.kind === 'drip') { tNote = drip(p, rng, c, ev); mark.h = c.h ?? 0.2; }
    else if (c.kind === 'note') tNote = note(c, ev);
    else if (c.kind === 'stream') stream(p, rng, c, ev);
    else if (c.kind === 'birds') birds(rng, c, ev);
    else if (c.kind === 'bird') bird(rng, c, ev);
    else if (CARTOON[c.kind]) CARTOON[c.kind](c, ev, rng);
    else throw new Error(`unknown cue kind ${c.kind}`);
    if (c.gain !== undefined) for (let i = n0; i < ev.length; i++) ev[i].amp *= c.gain;
    if (c.kind !== 'stream' && c.kind !== 'birds') marks.push(mark);
    if (c.note) {
      notes.push({ t: tNote, note: c.note, f: pitch(c.note), r: MINNAERT / pitch(c.note), x: c.x,
        beat: c.kind === 'dip' ? c.plink ?? c.beat : c.beat, kind: c.kind });
    }
  }
  return { events: ev, duration, params: { ...DEFAULTS, reverb: reverb ?? DEFAULTS.reverb }, marks, notes };
}

// ---------------------------------------------------------------- audio layer

function panGains(pan) {
  const x = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(x), Math.sin(x)];
}

function biquad(x, type, fc, q, sr) {
  const w0 = (2 * Math.PI * Math.min(fc, 0.45 * sr)) / sr;
  const cs = Math.cos(w0), al = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al, a1 = (-2 * cs) / a0, a2 = (1 - al) / a0;
  b0 /= a0; b1 /= a0; b2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
}

function addMode(L, R, sr, e) {
  const n0 = Math.round(e.t * sr);
  if (n0 < 0 || n0 >= L.length || e.f >= 0.45 * sr) return;
  const len = Math.min(L.length - n0, Math.ceil((9.2 / e.d) * sr)); // until -80 dB
  const [gl, gr] = panGains(e.pan);
  const att = Math.max(1, Math.round(e.attack * sr));
  const step = (e.f * e.sigma) / sr;
  const lo = Math.min(e.f, e.fEnd), hi = Math.max(e.f, e.fEnd);
  let f = e.f, ph = 0, env = e.amp, decay = Math.exp(-e.d / sr), capped = step === 0;
  for (let i = 0; i < len; i++) {
    const w = i < att ? 0.5 - 0.5 * Math.cos((Math.PI * i) / att) : 1;
    const s = env * w * Math.sin(ph);
    L[n0 + i] += gl * s;
    R[n0 + i] += gr * s;
    ph += (2 * Math.PI * f) / sr;
    if (!capped) {
      f += step;
      if (f > hi || f < lo) {
        f = Math.min(hi, Math.max(lo, f));
        capped = true;
        if (e.sigma > 0 && !e.hold) decay = Math.exp((-4 * e.d) / sr); // bubble reaches the surface and bursts
      }
    }
    env *= decay;
  }
}

function addBurst(L, R, sr, e, rng) {
  const n0 = Math.round(e.t * sr);
  if (n0 < 0 || n0 >= L.length) return;
  const len = Math.min(L.length - n0, Math.ceil((3 * e.attack + 7 * e.decay) * sr) + 1);
  const x = new Float32Array(len);
  const ka = 1 / (e.attack * sr), kd = Math.exp(-1 / (e.decay * sr));
  let envD = 1;
  for (let i = 0; i < len; i++) {
    x[i] = (2 * rng.u() - 1) * (1 - Math.exp(-(i + 1) * ka)) * envD;
    envD *= kd;
  }
  if (e.hp) biquad(x, 'hp', e.hp, Math.SQRT1_2, sr);
  if (e.lp) biquad(x, 'lp', e.lp, Math.SQRT1_2, sr);
  let peak = 1e-12;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(x[i]));
  const [gl, gr] = panGains(e.pan);
  const g = e.amp / peak;
  for (let i = 0; i < len; i++) {
    L[n0 + i] += gl * g * x[i];
    R[n0 + i] += gr * g * x[i];
  }
}

// A tone with harmonics `harm` along a pitch curve: knots fk = [[u, Hz], ...] over its length (u from 0 to 1,
// exponential in between), vibrato at vr Hz of depth vd (a fraction of the pitch), raised-cosine attack and release.
function addChirp(L, R, sr, e) {
  const n0 = Math.round(e.t * sr);
  if (n0 < 0 || n0 >= L.length) return;
  const len = Math.min(L.length - n0, Math.round(e.dur * sr));
  const att = Math.max(1, Math.round(e.attack * sr)), rel = Math.max(1, Math.round(e.release * sr));
  const [gl, gr] = panGains(e.pan), harm = e.harm ?? [1], fk = e.fk;
  let ph = 0, j = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    while (j < fk.length - 2 && u > fk[j + 1][0]) j++;
    const [u0, f0] = fk[j], [u1, f1] = fk[j + 1];
    let f = f0 * Math.pow(f1 / f0, clamp((u - u0) / Math.max(u1 - u0, 1e-9), 0, 1));
    if (e.vd) f *= 1 + e.vd * Math.sin((2 * Math.PI * e.vr * i) / sr);
    ph += (2 * Math.PI * f) / sr;
    let s = 0;
    for (let h = 0; h < harm.length && (h + 1) * f < 0.45 * sr; h++) s += harm[h] * Math.sin((h + 1) * ph);
    const w = (i < att ? 0.5 - 0.5 * Math.cos((Math.PI * i) / att) : 1) *
      (len - i < rel ? 0.5 - 0.5 * Math.cos((Math.PI * (len - i)) / rel) : 1);
    L[n0 + i] += gl * e.amp * w * s;
    R[n0 + i] += gr * e.amp * w * s;
  }
}

// Noise through a resonant band (two state-variable filter stages of quality q) whose centre sweeps from f0 to f1 Hz,
// swelling to its loudest at `peak` of its length, panned from pan to pan1. Its noise has its own seed, so a stem
// holds exactly the samples it adds to the mix.
function addSwish(L, R, sr, e) {
  const n0 = Math.round(e.t * sr);
  if (n0 < 0 || n0 >= L.length) return;
  const rng = makeRng(n0 ^ 0x3c6ef372), len = Math.min(L.length - n0, Math.round(e.dur * sr));
  const x = new Float32Array(len);
  let low = 0, band = 0, low2 = 0, band2 = 0, peak = 1e-12;
  for (let i = 0; i < len; i++) {
    const u = i / len, fc = e.f0 * Math.pow(e.f1 / e.f0, u), f = 2 * Math.sin((Math.PI * Math.min(fc, sr / 8)) / sr);
    low += f * band;
    band += f * (2 * rng.u() - 1 - low - band / e.q);
    low2 += f * band2;
    band2 += f * (band - low2 - band2 / e.q);
    const w = u < e.peak ? Math.sin((0.5 * Math.PI * u) / e.peak) ** 2 : Math.cos((0.5 * Math.PI * (u - e.peak)) / (1 - e.peak)) ** 2;
    x[i] = band2 * w;
    peak = Math.max(peak, Math.abs(x[i]));
  }
  for (let i = 0; i < len; i++) {
    const [gl, gr] = panGains(e.pan + (e.pan1 - e.pan) * (i / len));
    L[n0 + i] += (gl * e.amp * x[i]) / peak;
    R[n0 + i] += (gr * e.amp * x[i]) / peak;
  }
}

// 8-line feedback delay network with Hadamard mixing and per-line lowpass damping.
function reverb(L, R, sr, mix, rt60) {
  const lens = [1123, 1301, 1447, 1597, 1777, 1949, 2129, 2311].map((n) => Math.round((n * sr) / 48000));
  const lines = lens.map((n) => new Float32Array(n));
  const idx = new Int32Array(8);
  const gain = lens.map((n) => Math.pow(10, (-3 * n) / (rt60 * sr)));
  const damp = Math.exp((-2 * Math.PI * 5000) / sr);
  const lp = new Float32Array(8), y = new Float32Array(8);
  for (let i = 0; i < L.length; i++) {
    for (let k = 0; k < 8; k++) y[k] = lines[k][idx[k]];
    const wetL = y[0] + y[2] + y[4] + y[6], wetR = y[1] + y[3] + y[5] + y[7];
    // fast Walsh-Hadamard transform, normalized
    for (let h = 1; h < 8; h *= 2)
      for (let j = 0; j < 8; j += 2 * h)
        for (let k = j; k < j + h; k++) { const a = y[k], b = y[k + h]; y[k] = a + b; y[k + h] = a - b; }
    const inp = 0.5 * (L[i] + R[i]);
    for (let k = 0; k < 8; k++) {
      lp[k] = (1 - damp) * y[k] * 0.35355339 * gain[k] + damp * lp[k];
      lines[k][idx[k]] = lp[k] + inp;
      idx[k] = (idx[k] + 1) % lens[k];
    }
    L[i] += mix * 0.5 * wetL;
    R[i] += mix * 0.5 * wetR;
  }
}

function highpass1(x, fc, sr) {
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  let xp = 0, yp = 0;
  for (let i = 0; i < x.length; i++) {
    const y = a * (yp + x[i] - xp);
    xp = x[i]; yp = y; x[i] = y;
  }
}

// gain: fixed output gain (e.g. to render stems at the level they have in the full mix);
// by default the result is peak-normalized to peakDb.
// Faint, slightly darkened noise (outdoor air, distant water) at floorDb dBFS RMS.
function addFloor(L, R, sr, floorDb, rng) {
  const a = Math.exp((-2 * Math.PI * 3000) / sr);
  const rms = Math.pow(10, floorDb / 20);
  let yl = 0, yr = 0;
  const k = rms * 3.2; // compensates the one-pole lowpass + uniform noise RMS
  for (let i = 0; i < L.length; i++) {
    yl = a * yl + (1 - a) * (2 * rng.u() - 1);
    yr = a * yr + (1 - a) * (2 * rng.u() - 1);
    L[i] += k * yl;
    R[i] += k * yr;
  }
}

// eventNoise: each noise burst draws from its own seed (its time and amplitude) instead of one stream shared in event
// order, so a burst sounds the same whatever else is in the scene and a stem holds exactly its samples in the mix.
// rmsDb: set the level by the loudest 20 ms (RMS, dBFS) instead of the sample peak, which rides on the noise of a
// few spiky slap grains; the samples that then pass -3 dBFS are rounded off by a soft clipper.
// Scores use both; plain renders keep the shared noise stream, peak normalisation and their exact bytes.
export function render(scene, { sr = SR, seed = 1, peakDb = -1, gain, reverbMix, floorDb = -66, eventNoise = false, rmsDb } = {}) {
  const n = Math.ceil(scene.duration * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const rng = makeRng(seed ^ 0x5bd1e995);
  const gains = scene.params?.mix ?? {};
  for (const e of scene.events) {
    const g = gains[e.src] ?? 1;
    const ee = g === 1 ? e : { ...e, amp: e.amp * g };
    if (e.kind === 'mode') addMode(L, R, sr, ee);
    else if (e.kind === 'chirp') addChirp(L, R, sr, ee);
    else if (e.kind === 'swish') addSwish(L, R, sr, ee);
    else addBurst(L, R, sr, ee, eventNoise ? makeRng(Math.imul(Math.round(e.t * sr), 0x9e3779b1) ^ Math.round(e.amp * 2 ** 30)) : rng);
  }
  const mix = reverbMix ?? scene.params?.reverb ?? DEFAULTS.reverb;
  if (mix > 0) reverb(L, R, sr, mix, 0.5);
  highpass1(L, 30, sr);
  highpass1(R, 30, sr);
  const fade = Math.min(n, Math.round(0.05 * sr));
  for (let i = 0; i < fade; i++) { const w = i / fade; L[n - 1 - i] *= w; R[n - 1 - i] *= w; }
  let g = gain;
  if (g === undefined && rmsDb !== undefined) {
    const w = Math.round(0.02 * sr);
    let loudest = 1e-12;
    for (let i = 0; i + w <= n; i += w) {
      let s2 = 0;
      for (let j = i; j < i + w; j++) s2 += (0.5 * (L[j] + R[j])) ** 2;
      loudest = Math.max(loudest, Math.sqrt(s2 / w));
    }
    g = Math.pow(10, rmsDb / 20) / loudest;
  } else if (g === undefined) {
    let peak = 1e-12;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    g = Math.pow(10, peakDb / 20) / peak;
  }
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  if (gain === undefined && rmsDb !== undefined) {
    const T = 0.7, soft = (x) => (Math.abs(x) <= T ? x : Math.sign(x) * (T + (1 - T) * Math.tanh((Math.abs(x) - T) / (1 - T))));
    for (let i = 0; i < n; i++) { L[i] = soft(L[i]); R[i] = soft(R[i]); }
  }
  if (floorDb !== null) addFloor(L, R, sr, floorDb, rng);
  return { L, R, sr, gain: g };
}
