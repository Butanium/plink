// Render a step (or a walk) to WAV, plus the event list as JSON for plotting.
// node synth/render.mjs --preset ankle --seed 1 --out out/ankle_s1.wav [--walk 6] [--set xi=0.3,exit=true] [--stems]
// --synth history/v1/synth.js renders with an older snapshot of the synth.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const { values: a } = parseArgs({
  options: {
    preset: { type: 'string', default: 'ankle' },
    seed: { type: 'string', default: '1' },
    out: { type: 'string' },
    walk: { type: 'string' },
    interval: { type: 'string', default: '0.85' },
    set: { type: 'string', default: '' },
    stems: { type: 'boolean', default: false },
    synth: { type: 'string' },
  },
});
const { PRESETS, makeStep, makeWalk, render } = await import(
  a.synth ? pathToFileURL(resolve(a.synth)).href : './synth.js');

function writeWav(path, { L, R, sr }) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const q = (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(q(L[i]), 44 + i * 4);
    buf.writeInt16LE(q(R[i]), 46 + i * 4);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const overrides = Object.fromEntries(
  a.set.split(',').filter(Boolean).map((kv) => {
    const [k, v] = kv.split('=');
    return [k, v === 'true' ? true : v === 'false' ? false : Number(v)];
  }),
);
const params = { ...PRESETS[a.preset], ...overrides };
const seed = Number(a.seed);
const scene = a.walk
  ? makeWalk(params, seed, { steps: Number(a.walk), interval: Number(a.interval) })
  : makeStep(params, seed);
const mix = render(scene, { seed });
writeWav(a.out, mix);
const events = scene.events.map((e) => ({ ...e, amp: e.amp * mix.gain }));
writeFileSync(a.out.replace(/\.wav$/, '.events.json'), JSON.stringify({ params: scene.params, events }));

const counts = {};
for (const e of scene.events) counts[e.src] = (counts[e.src] ?? 0) + 1;
console.log(`${a.out}  ${(mix.L.length / mix.sr).toFixed(2)}s  events ${JSON.stringify(counts)}`);

if (a.stems) {
  for (const src of Object.keys(counts)) {
    const stem = { ...scene, events: scene.events.filter((e) => e.src === src) };
    writeWav(a.out.replace(/\.wav$/, `.stem-${src}.wav`), render(stem, { seed, gain: mix.gain, reverbMix: 0, floorDb: null }));
  }
}
