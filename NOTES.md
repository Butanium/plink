# water-step — notes

Goal: engineer the sound of a foot stepping into water from math/code alone.

## Ground rules (agreed 2026-09-23)
- No reference recordings: the sound has to come out of the physics, not from matching a clip.
- No audio-capable model in the loop. Feedback = spectrograms + numeric checks (+ Clément's ears).
  Optional at the very end: one blind "what is this sound?" test on an audio model.

## Physics sources
- van den Doel 2005, "Physically based models for liquid sounds" (ACM Transactions on Applied Perception, 2005):
  bubble impulse a·sin(2πft)e^{-dt}, f=3/r, d=0.043f+0.0014f^{3/2}, rising pitch f(t)=f0(1+ξdt), a∝r^{3/2}.

## Blind test (2026-09-23, after v7) — `out/blind/answers.json`
`uv run tools/blind_test.py out/blind/*.wav --models google/gemini-3.8-flash "~google/gemini-pro-latest" openai/gpt-audio qwen/qwen3.8-omni-flash --repeats 2 --out out/blind/answers.json`
No hint in the prompt ("describe; best guess + two alternatives"), audio sent as raw data (no filename).
Water/liquid named anywhere in the best guess, usable answers only (Gemini Pro often claimed no audio arrived):
control noise burst 0/8 · v1 ankle 0/8 · v7 ankle 4/6 · v7 walk 4/7 (one alt: "footsteps through deep mud") ·
v7 puddle 2/7 (glass smashing, gravel, snapped stick; one alt: "dipping a hand or foot into water").
By model: gpt-audio and qwen3.8-omni hear water in v7 consistently; gemini-3.8-flash never (singing bowl, door latch).
"Recorded or synthesized?" is uninformative (the noise control got "recorded" 4/8), except v7 puddle: "recorded" 8/8.
Lead: the puddle's dense droplet spray reads as shattering; it needs to sound wetter.

## Animation rendering (2026-09-23)
On a headless Linux machine with an NVIDIA GPU, `node render.mjs --gpu-angle=gl-egl ...` (~0.15–0.4 s/frame on an
L40); without a GPU, `--soft-gl` (WebGL in software: 0.1 s to 40 s per frame).

## "Plink" animation (2026-09-23) — `animation/`
Clawd crosses a stream; storyboard in `animation/STORYBOARD.md`. Pipeline:
`node synth/score_plink.mjs` → `animation/assets/plink.wav` + `animation/src/scenes/plink_score.js` (the painter's
data: every audible droplet's flight, bubble, drip, footfall), then `cd animation && node render.mjs --gpu-angle=gl-egl --clip
--audio=assets/plink.wav --out=out/plink_v1.mp4` (~0.25 s/frame on an L40; the scene is now `src/scenes/plink/`).
Sync is by construction: `makeScore()` tags events with metadata (drawn from a separate RNG, so plain
makeStep/makeWalk stay byte-identical), and the scene paints each droplet on its real parabola (launch tl → land tLand).
Kit gotchas found: light ink over darker paint vanishes and spline outlines (`curv`) of closed shapes render only their
endpoints (both later traced to one p5.brush bug with strokes far from the origin under zoom, fixed in core.js; see
animation/LESSONS.md); big watercolour `fill`s bleed across the sky. Submerged legs are clipped at the waterline in the draw hook (a painted water patch never matched).

## Plink soundtrack v2 (2026-09-23) — cues, melody, cartoon sounds
Every sound is a cue on a beat in `animation/story.json` "cues" (kinds: `synth/CUES.md`), each with its own seed so
adding one doesn't reshuffle the others. The paw touch (Clément: "no sound of the paw in the water") is now contact
snap + "tup" + trapped bubbles + flicked droplets, then the lifting toe's liquid bridge snapping before the plink.
Melody of tuned bubbles (r = 3.26/f, gliding up ~5% into the pitch, then ringing without the surface burst), D major:
A5 plink · trot A5 D6 E6 F#6 (4 footfalls since round 2) · jump root D5 · wade-out A5 B5 C#6 · last drip D6. Cartoon sounds (whoosh, pop, twinkle, giggle, chime,
tink) and birds sit under the water. Checks: `node synth/score_plink.mjs --stems out/plink_stems`, then
`uv run tools/cue_levels.py out/plink_stems` (per-cue levels) and `uv run tools/audibility.py out/plink_stems`
(best third-octave SNR of each cue against the sum of the other stems — not mix − stem: burst noise draws from a
shared RNG, so a stem's noise samples differ from the mix's); `uv run tools/seg_spec.py out/plink_stems T0 T1 --stems note`
plots a stretch with the notes and marks drawn on.
