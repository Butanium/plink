// What the painter's score holds around a moment: marks (with beats), melody notes, falls (release → landing, from
// where) and the thrown drops in the air. For tracing a picture/sound sync question back to the score.
//   node tools/score_at.mjs 14.6 15.1 [animation/src/scenes/plink_score.js]
import { readFileSync } from 'node:fs';
const [a, b, file = 'animation/src/scenes/plink_score.js'] = process.argv.slice(2), t0 = +a, t1 = +b;
const SCORE = new Function(readFileSync(file, 'utf8') + '; return SCORE;')();
const G = 9.81, px = (m) => (560 + m * 900).toFixed(0);   // world px, as the scene's MX()
for (const m of SCORE.marks.filter((m) => m.t >= t0 - 1.2 && m.t <= t1)) console.log('mark', m.kind, m.beat ?? '', m.t.toFixed(3), 'x', px(m.x));
for (const n of (SCORE.notes || []).filter((n) => n.t >= t0 && n.t <= t1)) console.log('note', n.note, n.t.toFixed(3), n.beat);
for (const f of SCORE.falls) {
  const tf = Math.sqrt(2 * f.h / G);
  if (f.t - tf <= t1 && f.t + .6 >= t0) console.log('fall', f.src, 'release', (f.t - tf).toFixed(3), 'land', f.t.toFixed(3), 'x', px(f.x), 'h(m)', f.h);
}
const flying = SCORE.drops.filter((d) => d.tl <= t1 && d.tLand >= t0);
console.log('drops in the air:', flying.length, flying.slice(0, 8).map((d) => `${d.tl.toFixed(2)}→${d.tLand.toFixed(2)} x0 ${px(d.x0)}`).join(' | '));
