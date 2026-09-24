// The soundtrack of "Plink" and the painter's data, from one list of cues.
// node synth/score_plink.mjs [--stems DIR]  →  animation/assets/plink.wav + animation/src/scenes/plink_score.js
// (--stems also writes DIR/plink.wav and one DIR/plink.stem-<src>.wav per sound source, at their level in the mix)
//
// World x is in metres along the stream (left bank ends at -0.4, far bank starts at 2.2). Times come from
// animation/story.json (the beats the picture uses too), which is embedded in the painter's data as SCORE.story.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { CUE_KINDS, makeRng, makeScore, render } from './synth.js';

const { values: args } = parseArgs({ options: { stems: { type: 'string' } } });
const OUT_WAV = 'animation/assets/plink.wav';
const OUT_JS = 'animation/src/scenes/plink_score.js';
const SEED = 11;
const STORY = JSON.parse(readFileSync('animation/story.json', 'utf8'));
const beat = (name) => { if (!(name in STORY.beats)) throw new Error(`story.json has no beat ${name}`); return STORY.beats[name]; };
const DURATION = STORY.duration;
// shot D. Clawd's body moves at `speed`; each footfall lands under the leg the kit's side-view trot puts down:
// the near front leg (+0.042 m at u = 24 px) and the near back leg (-0.059 m) take turns.
const { _about, ...trotStaging } = STORY.trot;
const TROT = { t0: beat('D.trot'), ...trotStaging };
const TROT_END = TROT.x0 + TROT.speed * (TROT.n - 1) * TROT.interval;
const JUMP = { crouch: beat('E.crouch'), takeoff: beat('E.takeoff'), land: beat('E.land'), xFrom: TROT_END, xTo: TROT_END + STORY.jump.distance };

// story.json "cues" → synth cues at absolute times (kinds and params: synth/CUES.md). trot and jump expand into the
// footfalls, lifts and landing their story.json sections stage. Each cue draws its randomness from its own seed,
// named after the cue, so adding or moving one cue leaves every other sound (and drawn droplet) as it was.
const fnv = (s) => { let h = 0x811c9dc5; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return h; };
const seeded = (key, c) => ({ ...c, seed: (fnv(key) ^ SEED) >>> 0 });
const at = (c) => beat(c.beat) + (c.dt ?? 0);
function expand(c, key) {
  if (c.kind === 'trot') {
    // alternating near and far legs, each footfall ringing one note. With trot.lift, each foot leaves the water
    // `lift` s after the other one lands, from where it last stood (having slipped trot.slip forward under the water;
    // trot.from before its first footfall), and the last two feet stay down until the jump; without it, each foot
    // lifts out 0.62 s after landing.
    const jit = makeRng(7), out = [], params = [];
    const footX = (k) => TROT.x0 + TROT.speed * k * TROT.interval + TROT.feet[k % 2];
    for (let k = 0; k < TROT.n; k++) {
      const t = TROT.t0 + k * TROT.interval, x = footX(k), pan = k % 2 ? 0.15 : -0.15;
      params[k] = { depth: 0.1 * jit.logn(1, 0.12), footSpeed: 1.5 * jit.logn(1, 0.12), spray: jit.logn(1, 0.25),
        slap: 0.6, hardness: 0.25 };
      if (TROT.lift !== undefined) {
        out.push(seeded(`${key}.exit${k}`, { kind: 'exit', t: t - TROT.interval + TROT.lift, x: k >= 2 ? footX(k - 2) + (TROT.slip ?? 0) : TROT.from[k],
          pan, params: params[k >= 2 ? k - 2 : k], beat: `D.trot#${k}.lift` }));
      }
      out.push(seeded(`${key}.step${k}`, { kind: 'step', t, x, pan, params: params[k], beat: `D.trot#${k}` }));
      if (TROT.lift === undefined) out.push(seeded(`${key}.exit${k}`, { kind: 'exit', t: t + 0.62, x: x - 0.02, pan, params: params[k] }));
      if (c.notes?.[k]) out.push({ kind: 'note', t: t + (c.noteDelay ?? 0.08), x, pan, note: c.notes[k], amp: c.noteAmp ?? 0.2, tune: c.tune, beat: `D.trot#${k}` });
    }
    return out;
  }
  if (c.kind === 'jump') {
    // into the deep pool, the feet leaving the water first; the cavity the landing opens pinches off the root note
    const out = [seeded(`${key}.exit`, { kind: 'exit', t: JUMP.takeoff, x: JUMP.xFrom, params: { depth: 0.1 } }),
      seeded(`${key}.land`, { kind: 'step', t: JUMP.land, x: JUMP.xTo, beat: 'E.land',
        params: { depth: 0.22, footSpeed: 2.8, slap: 1.2, spray: 2.2, bubbles: 1.6, hardness: 0.2 } })];
    if (c.note) out.push({ kind: 'note', t: JUMP.land + (c.noteDelay ?? 0.12), x: JUMP.xTo, note: c.note, amp: c.noteAmp ?? 0.5, tune: c.tune, beat: 'E.land' });
    return out;
  }
  if (!CUE_KINDS.includes(c.kind)) {
    console.warn(`story.json cue of unknown kind "${c.kind}" skipped (synth/CUES.md lists the kinds)`);
    return [];
  }
  if (c.kind === 'stream') return [seeded(key, { ...c, t0: c.from ? beat(c.from) : 0, t1: c.until ? beat(c.until) : DURATION })];
  if (c.kind === 'birds') {
    return [seeded(key, { ...c, t: at(c), t1: c.until ? beat(c.until) : DURATION, tFull: c.full ? beat(c.full) : undefined })];
  }
  if (c.kind === 'step' && c.note) {
    // a footfall that also rings one tuned bubble, like the trot's
    const { note, noteDelay = 0.08, noteAmp = 0.2, tune, ...step } = c;
    return [seeded(key, { ...step, t: at(c) }), { kind: 'note', t: at(c) + noteDelay, x: c.x, pan: c.pan, note, amp: noteAmp, tune, beat: c.beat }];
  }
  if (c.kind === 'dip') return [seeded(key, { ...c, t: at(c), plinkAt: beat(c.plink) })];
  if (c.kind === 'drip') return [seeded(key, { x: STORY.drip.x, h: STORY.drip.h, ...c, t: at(c) })];
  return [seeded(key, { ...c, t: at(c) })];
}
const seen = {};
const cues = (STORY.cues ?? []).filter((c) => c.kind).flatMap((c) => {
  const key = `${c.kind}@${c.beat ?? ''}`;
  seen[key] = (seen[key] ?? 0) + 1;
  return expand(c, seen[key] > 1 ? `${key}#${seen[key]}` : key);
});

const scene = makeScore(cues, SEED, { duration: DURATION, reverb: 0.07 });
// the film's level: its loudest 20 ms (the jump's landing) at -13.8 dBFS RMS, as in v1
const mix = render(scene, { seed: SEED, rmsDb: -13.8, eventNoise: true });

// ---- soundtrack
function writeWav(path, { L, R, sr }) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const q = (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  for (let i = 0; i < n; i++) { buf.writeInt16LE(q(L[i]), 44 + i * 4); buf.writeInt16LE(q(R[i]), 46 + i * 4); }
  writeFileSync(path, buf);
}
mkdirSync('animation/assets', { recursive: true });
writeWav(OUT_WAV, mix);
if (args.stems) {
  mkdirSync(args.stems, { recursive: true });
  writeWav(`${args.stems}/plink.wav`, mix);
  for (const src of new Set(scene.events.map((e) => e.src))) {
    const stem = { ...scene, events: scene.events.filter((e) => e.src === src) };
    writeWav(`${args.stems}/plink.stem-${src}.wav`, render(stem, { seed: SEED, gain: mix.gain, reverbMix: 0, floorDb: null, eventNoise: true }));
  }
}

// ---- painter data: only what you can hear gets drawn
const AUDIBLE = Math.pow(10, -46 / 20);   // an event's peak in the final mix
const r3 = (x) => Math.round(x * 1000) / 1000;
const flights = new Map(), falls = new Map(), bubbles = [];
let dip = null;
for (const e of scene.events) {
  const m = e.meta, amp = e.amp * mix.gain;
  if (!m) continue;
  if (m.kind === 'fly') {
    const f = flights.get(m) ?? { ...m, amp: 0 };
    f.amp = Math.max(f.amp, amp);
    flights.set(m, f);
  } else if (m.kind === 'fall') {
    const f = falls.get(m) ?? { ...m, t: e.t, amp: 0, src: e.src };
    f.amp = Math.max(f.amp, amp); f.t = Math.min(f.t, e.t);
    falls.set(m, f);
  } else if (m.kind === 'bubble' && amp > AUDIBLE && e.src !== 'stream') {
    const T = e.sigma > 0 && !e.hold ? Math.min(4.6 / e.d, (e.fEnd / e.f - 1) / e.sigma) : 4.6 / e.d;
    bubbles.push({ t: r3(e.t), x: r3(m.x), r: r3(e.r * 1000), dur: r3(T), amp: r3(amp), src: e.src });
  } else if (m.kind === 'dip') {
    dip = { ...m };
  }
}
const drops = [...flights.values()].filter((f) => f.amp > AUDIBLE).map((f) => ({
  tl: r3(f.tl), tLand: r3(f.tLand), x0: r3(f.x0), vx: r3(f.vx), vz: r3(f.vz), a: r3(f.a * 1000), front: r3(f.front),
  amp: r3(f.amp) }));
const fallList = [...falls.values()].filter((f) => f.amp > AUDIBLE).map((f) => ({
  t: r3(f.t), x: r3(f.x), h: r3(f.h), a: r3((f.a ?? 0.002) * 1000), amp: r3(f.amp), src: f.src }));
const marks = scene.marks.sort((a, b) => a.t - b.t);
const notes = scene.notes.sort((a, b) => a.t - b.t).map((o) => ({ ...o, t: r3(o.t), f: r3(o.f), r: r3(o.r * 1000) }));
const data = { duration: DURATION, story: STORY, trot: TROT, jump: JUMP, marks, notes, dip, drops, falls: fallList, bubbles };
mkdirSync('animation/src/scenes', { recursive: true });
writeFileSync(OUT_JS, `// Generated by synth/score_plink.mjs from the same events as assets/plink.wav — do not edit by hand.\n` +
  `// Units: seconds and metres; drop/bubble radii a, r in mm.\nconst SCORE = ${JSON.stringify(data)};\n`);

const counts = {};
for (const d of drops) { const k = marks.find((m) => m.kind === 'step' && Math.abs(m.t - d.tl) < 0.2)?.t ?? '?'; counts[k] = (counts[k] ?? 0) + 1; }
console.log(`${OUT_WAV}: ${(mix.L.length / mix.sr).toFixed(1)} s, ${scene.events.length} events`);
console.log(`${OUT_JS}: ${drops.length} drops, ${fallList.length} falls, ${bubbles.length} bubbles, ${notes.length} notes; drops per footfall ${JSON.stringify(counts)}`);
