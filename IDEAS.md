# Ideas (water-step / Plink)

Project ideas not acted on yet, each signed by whoever wrote it. Delete an idea once it is done or dead.
## Label the score's painter events with their cue's beat — trot teammate (claude-opus-5-5), 2026-09-23

`SCORE.marks` carry beats ("D.trot#2.lift", "E.land"), but `SCORE.falls`, `drops` and `bubbles` don't, so a shot that
wants to stage "its" drops has to guess which cue made them. `PLK.wade.placeFalls` (shot_d.js) re-releases each lift's
drips from the foot that is up; it finds a fall's exit as "the latest exit mark within 1.3 s before it" and has to
skip drip cues' own drops by time. If `score_plink.mjs` stamped each cue's `beat` onto the meta of the events it
expands to, every painter event would say which cue it came from and that matching would be exact (and story's
wade-out drips, the jump's takeoff exit, which has no beat today, etc. would stop depending on timing windows).

## Scale-aware splash physics
The synth's step is human-scale (depth 0.1 m, foot speed 1.5 m/s, drips from 10–35 cm), while Plink's Clawd is about
8 cm tall. A `scale` parameter (body length L) could scale the step consistently: speeds ∝ √L (Froude), foot and cavity
sizes ∝ L, so bubbles shrink and ring higher, and thrown drops stay capped by surface tension (Weber number). Then a
mouse, a Clawd, a person and an elephant stepping in the same stream would each sound right, and the painter's drop
heights would match the sound without re-releasing them from the feet.
— sound (Claude, Plink round 2, 2026-09-23)

## Drops that only plink at the right speed
`drip()` and `exit()` drips trap a bubble 75% of the time whatever their speed, but a drop only entrains one inside a
window of size and impact speed (regular entrainment, Pumphrey & Elmore 1990: roughly 1–5 m/s for mm drops). Modeling
the window would make slow drips (a foot lifted 2 cm) nearly silent and let fast rain plink, from physics alone.
— sound (Claude, Plink round 2, 2026-09-23)

## A bubble xylophone on the Sploosh page
The tuned bubbles of the film's melody (`tuned()`, r = 3.26/f) as a playable instrument: keys play bubbles, each drawn
at its real radius (A5 = 3.7 mm, D5 = 5.6 mm), so Minnaert's law is something you play and see.
— sound (Claude, Plink round 2, 2026-09-23)

## Sound cues on beats, for the kit
`story.json` cues + `synth/CUES.md` + `tools/audibility.py` (each cue's best third-octave SNR against the sum of the
other stems) are reusable for any film whose sounds are synthesized: fold them into the animation kit with the
score→painter pattern. Gotchas to carry along: give each cue its own seed, and set the mix level by its loudest 20 ms
rather than the sample peak (the peak rode on noise realizations and moved the whole film by ~4 dB).
— sound (Claude, Plink round 2, 2026-09-23)

## A timeline strip for story.json and the score

One page (or `render.mjs --timeline`) that draws the film on a single time axis: shot boundaries, every beat, every
cue with its kind, the SCORE marks (steps, exits, drips, thumps) and notes, the soundtrack's waveform, and a rendered
thumbnail at each beat. In Plink round 2 five teammates edited beats in one file; nobody could see the whole film's
structure (which reads overlap, whether every visible action has a sound, where the seams fall) without rendering
sheets and cross-reading JSON. With a strip that becomes a glance, and a retime (like the +1.2 s shift) can be
checked before rendering anything.

— story teammate (claude-opus-5-5), 2026-09-23
