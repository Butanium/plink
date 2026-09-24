// A bubble étude: Plink's motifs as a small tune in D major, played by tuned bubbles only (r = 3.26/f), with big
// low bubbles (1.1–1.7 cm, "glugs") as the bass and the stream underneath. Not part of the film.
// node scratch/bubble_etude.mjs  →  out/bubble_etude.wav
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeScore, render } from '../synth/synth.js';

const BEAT = 0.42, T0 = 1.6;
// bars of four beats: melody notes by beat (null = rest), and the bass bubble on the downbeat
const BARS = [
  { mel: ['A5', null, 'D6', null], bass: 'D4' },          // the first plink, and its answer
  { mel: ['A5', 'D6', 'E6', 'F#6'], bass: 'D4' },         // the trot
  { mel: ['E6', null, 'D6', 'B5'], bass: 'G3' },
  { mel: ['A5', null, null, null], bass: 'A3' },          // the jump's pause
  { mel: ['A5', 'B5', 'C#6', 'D6'], bass: 'D4' },         // the wade-out
  { mel: ['E6', 'F#6', 'E6', 'C#6'], bass: 'A3' },
  { mel: ['D6', null, 'B5', 'A5'], bass: 'G3' },
  { mel: [null, null, null, null], bass: 'A3' },
];
const cues = [];
BARS.forEach((bar, i) => {
  const tb = T0 + 4 * BEAT * i;
  bar.mel.forEach((n, k) => n && cues.push({ kind: 'note', t: tb + k * BEAT, note: n, amp: 0.2, pan: 0.15 * Math.sin(i + k) }));
  cues.push({ kind: 'note', t: tb, note: bar.bass, amp: 0.07, pan: -0.1, tune: { glide: 0.04, rise: 0.03, damp: 0.35, attackCycles: 2 } });
});
// the last note is a real drop falling in, on the tonic, over the tonic's bass
const tEnd = T0 + 4 * BEAT * BARS.length;
cues.push({ kind: 'drip', t: tEnd, x: 0, h: 0.15, a: 0.0026, amp: 0.24, note: 'D6' });
cues.push({ kind: 'note', t: tEnd, note: 'D4', amp: 0.07, pan: -0.1, tune: { glide: 0.04, rise: 0.03, damp: 0.3, attackCycles: 2 } });
const duration = tEnd + 2.6;
cues.unshift({ kind: 'stream', t0: 0, t1: duration, level: 0.5, fade: 1.5 });

const scene = makeScore(cues, 5, { duration, reverb: 0.1 });
const { L, R, sr } = render(scene, { seed: 5, peakDb: -3, eventNoise: true });
const n = L.length, buf = Buffer.alloc(44 + n * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
const q = (x) => Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
for (let i = 0; i < n; i++) { buf.writeInt16LE(q(L[i]), 44 + i * 4); buf.writeInt16LE(q(R[i]), 46 + i * 4); }
mkdirSync('out', { recursive: true });
writeFileSync('out/bubble_etude.wav', buf);
console.log(`out/bubble_etude.wav: ${duration.toFixed(1)} s, ${scene.notes.length} tuned bubbles`);
