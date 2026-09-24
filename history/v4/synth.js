// Sound of a foot stepping into water, synthesized from the acoustics of bubbles and droplets.
//
// physics layer  makeStep / makeWalk : step parameters -> list of acoustic events
// audio layer    render              : events -> stereo PCM
//
// Event kinds:
//   mode  : exponentially decaying sinusoid with a linear frequency glide (bubbles, thuds)
//   burst : enveloped band-limited noise (slaps, droplet ticks, spray, slosh grains)

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
function bubble(src, t, r, amp, xi, pan, { damp = 1, cap = 1.6 } = {}) {
  const f = MINNAERT / r;
  const d = (0.043 * f + 0.0014 * Math.pow(f, 1.5)) * damp;
  return { kind: 'mode', src, t, f, d, sigma: xi * d, fEnd: f * cap, amp, attack: 0.3 / f, pan, r };
}

function burst(src, t, amp, attack, decay, hp, lp, pan) {
  return { kind: 'burst', src, t, amp, attack, decay, hp, lp, pan };
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// One parcel of trapped air torn into n bubbles around a size scale, all within a few ms.
// Bubbles near the surface (D -> 1) are louder and glide up in pitch.
function pocket(ev, rng, p, src, t, scale, n, amp, xiScale, pan, damp = 1.6) {
  for (let i = 0; i < n; i++) {
    const r = clamp(scale * rng.logn(1, 0.4), 0.0002, 0.012);
    const D = rng.u() ** 2;
    ev.push(bubble(src, t + Math.abs(rng.normal()) * 0.002, r, amp * D * Math.pow(r / R0, p.alpha),
      p.xi * xiScale * (0.3 + D), pan + rng.range(-0.05, 0.05), { damp }));
  }
}

// A blob of water (equivalent radius `size`) landing at speed v: a splat plus a few bubbles.
function miniSplash(ev, rng, p, src, t, size, v, pan) {
  const s = size / 0.002;
  ev.push(burst(src, t, 0.06 * Math.sqrt(s) * v, 2e-4, 0.0006 + 0.001 * s, 300 + 600 / s, 4000 + 4000 / s, pan));
  const nb = rng.poisson(0.4 + (0.6 * s * v) / 1.5);
  for (let i = 0; i < nb; i++) {
    const r = size * rng.range(0.15, 0.6);
    ev.push(bubble(src, t + rng.range(5e-4, 4e-3), r, 0.1 * rng.u() ** 2 * Math.pow(r / R0, p.alpha),
      p.xi * rng.range(0.5, 2), pan + rng.range(-0.05, 0.05), { cap: 1.8 }));
  }
}

// A fine droplet of radius a landing at vertical speed vz: a tick, sometimes an entrained bubble.
function dropImpact(ev, rng, p, src, t, a, vz, pan) {
  ev.push(burst(src, t, 0.045 * (a / 0.001) * vz, 5e-5, rng.range(3e-4, 1.2e-3), 800, 6000, pan));
  if (rng.chance(clamp((a - 0.0005) / 0.003, 0, 0.5))) {
    const r = a * rng.range(0.6, 1.5);
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
    const tLand = t0 + rng.gamma2(0.008) + ((2 * vz) / G) * rng.range(0.85, 1.05);
    miniSplash(ev, rng, p, 'spray', tLand, rng.powerLaw(0.001, 0.008, 1.5), vz, pan + rng.range(-0.5, 0.5));
  }
  const nDrops = rng.poisson(250 * E * p.spray * (1 + film));
  for (let i = 0; i < nDrops; i++) {
    const vz = Math.min(rng.logn(0.6 * v, 0.45), 2.8);
    const tLand = t0 + rng.gamma2(0.006) + ((2 * vz) / G) * rng.range(0.85, 1.05);
    dropImpact(ev, rng, p, 'drop', tLand, rng.powerLaw(0.0002, 0.0015, 1.5), vz, pan + rng.range(-0.5, 0.5));
  }
}

function exit(p, rng, t0, pan, ev) {
  const deep = Math.min(p.depth / 0.15, 2);
  // water closing in behind the heel as it leaves: near-surface pockets gliding up ("shlup")
  const nPockets = rng.poisson(10 * Math.min(deep, 1.5) * p.bubbles + 2);
  for (let i = 0; i < nPockets; i++) {
    pocket(ev, rng, p, 'exit', t0 + rng.gamma2(0.015), clamp(rng.logn(0.003, 0.4), 0.001, 0.008),
      1 + rng.poisson(2), 0.12, 2.5, pan);
  }
  // sheets of water sliding off the shoe land back
  const nBlobs = rng.poisson(12 * Math.min(deep, 1.2) + 3);
  for (let i = 0; i < nBlobs; i++) {
    miniSplash(ev, rng, p, 'exit', t0 + 0.02 + rng.gamma2(0.03), rng.powerLaw(0.001, 0.006, 1.5),
      rng.range(0.8, 2), pan + rng.range(-0.1, 0.1));
  }
  // drips from the swinging foot, further and further apart: the classic "plink"
  let td = t0 + rng.range(0.12, 0.2);
  const nDrips = 2 + rng.poisson(5 * Math.min(deep, 1.2) + 1);
  for (let k = 0; k < nDrips; k++) {
    const vz = Math.sqrt(2 * G * rng.range(0.1, 0.35));
    const a = rng.range(0.0015, 0.0028);
    const dp = pan + 0.05 * k;
    ev.push(burst('drip', td, 0.02 * (a / 0.001) * vz, 5e-5, rng.range(3e-4, 1e-3), 1200, 9000, dp));
    if (rng.chance(0.6)) {
      const r = a * rng.range(0.6, 1.3);
      ev.push(bubble('drip', td + rng.range(0.001, 0.004), r, 0.08 * rng.range(0.4, 1) * Math.pow(r / R0, p.alpha),
        p.xi * rng.range(1, 3), dp, { cap: 2 }));
    }
    td += rng.logn(0.06 * Math.pow(1.35, k), 0.4);
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
  return { events: ev, duration, params: p };
}

export function makeWalk(params = {}, seed = 1, { steps = 6, interval = 0.72 } = {}) {
  const p = { ...DEFAULTS, ...params };
  const rng = makeRng(seed);
  const ev = [];
  let t = 0.1;
  for (let i = 0; i < steps; i++) {
    const pan = (i % 2 ? 0.2 : -0.2) + rng.range(-0.05, 0.05);
    const pi = { ...p, footSpeed: p.footSpeed * rng.logn(1, 0.12), spray: p.spray * rng.logn(1, 0.3),
      bubbles: p.bubbles * rng.logn(1, 0.25) };
    entry(pi, rng, t, pan, ev);
    exit(pi, rng, t + 1.2 * interval + rng.range(-0.04, 0.04), pan, ev);
    t += interval * rng.logn(1, 0.05);
  }
  return { events: ev, duration: t + 1.2 * interval + 1.0, params: p };
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
        if (e.sigma > 0) decay = Math.exp((-4 * e.d) / sr); // bubble reaches the surface and bursts
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
export function render(scene, { sr = SR, seed = 1, peakDb = -1, gain, reverbMix } = {}) {
  const n = Math.ceil(scene.duration * sr);
  const L = new Float32Array(n), R = new Float32Array(n);
  const rng = makeRng(seed ^ 0x5bd1e995);
  const gains = scene.params?.mix ?? {};
  for (const e of scene.events) {
    const g = gains[e.src] ?? 1;
    const ee = g === 1 ? e : { ...e, amp: e.amp * g };
    if (e.kind === 'mode') addMode(L, R, sr, ee);
    else addBurst(L, R, sr, ee, rng);
  }
  const mix = reverbMix ?? scene.params?.reverb ?? DEFAULTS.reverb;
  if (mix > 0) reverb(L, R, sr, mix, 0.5);
  highpass1(L, 30, sr);
  highpass1(R, 30, sr);
  const fade = Math.min(n, Math.round(0.05 * sr));
  for (let i = 0; i < fade; i++) { const w = i / fade; L[n - 1 - i] *= w; R[n - 1 - i] *= w; }
  let g = gain;
  if (g === undefined) {
    let peak = 1e-12;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    g = Math.pow(10, peakDb / 20) / peak;
  }
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
  return { L, R, sr, gain: g };
}
