# Sound cues (`animation/story.json` → `"cues"`)

Every sound in "Plink" is one entry of the `"cues"` array in `animation/story.json`, placed on a named beat:
its time is `beats[beat] + dt`. Move a beat and its sounds follow. After editing, regenerate the soundtrack and
the painter's data: `node synth/score_plink.mjs` (from the repo root). Entries without `"kind"` are comments.

Fields every cue takes:

| field | meaning |
|---|---|
| `kind` | what sound (below) |
| `beat` | name of a beat in `beats` (required unless noted) |
| `dt` | offset from the beat, s (default 0; negative = before the beat) |
| `pan` | −1 (left) … 1 (right), default 0 |
| `gain` | loudness multiplier on the whole cue, default 1 |
| `x` | where on the stream, m (left bank ends at −0.4, far bank starts at 2.2); water cues and notes use it for the painter |

Each cue draws its randomness from its own seed, named after `kind@beat`, and each noise burst from its own seed,
so adding, moving or deleting a cue leaves every other sound (and every drawn droplet) as it was. The film's level
is set by its loudest 20 ms (the jump's landing) at −13.8 dBFS RMS, so it doesn't move either.

## Water

| kind | params | what it is |
|---|---|---|
| `step` | `x`, `params`: `depth` (m, 0.02 puddle … 0.25 shin), `footSpeed` (m/s, ~1.5), `slap` (0–1.2, flat sole), `spray`, `bubbles` (multipliers), `hardness` (0 mud … 1 concrete); `note` (+ `noteDelay` 0.08 s, `noteAmp` 0.2) | a foot coming down into the water: slap, crown, droplets on real flights, bubbles; the painter draws its crown and drops. With `note`, the footfall also rings one tuned bubble |
| `exit` | `x`, `params` (`depth` mostly) | a foot lifting out: a "shlup", sheets sliding off, drips further and further apart |
| `drip` | `x`, `h` (fall height, m) — default to story.json `drip`; `a` (drop radius, m, ~0.0025), `amp`, `note` | one drop falling in: a soft knock, then its bubble's plink (tuned when `note` is set) |
| `dip` | `plink` (beat of the plink), `x`, `note`, `amp`, `fall` (s between the bridge snapping and the plink, 0.03) | the toe-tap: contact "tk"/"tup", a trapped bubble or two, flicked droplets, then on lifting the liquid bridge snaps and its drop plinks |
| `note` | `note` (e.g. `"D6"`), `amp` (0.15), `x` | one bubble tuned to a pitch (radius 3.26/f), gliding up into it |
| `stream` | `level`, `fade` (s), `from`/`until` (beats; default the whole film) | the babbling bed under everything |
| `trot` | `notes` (one per footfall), `noteDelay` (0.08 s), `noteAmp` (0.2) — no `beat`: timing and positions from story.json `trot` | shot D's footfalls and lifts, each footfall ringing one note. With `trot.lift` (s) each foot leaves the water `lift` after the other one lands, from where it last stood plus `trot.slip` (`trot.from[k]` before its first footfall), and the last two feet stay down until the jump; without it each foot lifts out 0.62 s after landing |
| `jump` | `note`, `noteDelay` (0.12 s), `noteAmp` — no `beat`: from the `E.*` beats and story.json `jump` | the feet leaving the water at `E.takeoff`, the big landing at `E.land`, its cavity bubble on `note` |

## Cartoon (soft, mixed under the water)

| kind | params | what it is |
|---|---|---|
| `whoosh` | `dur` (0.35 s), `f0` → `f1` (band sweep, Hz; up for a take-off), `peak` (0.35 of dur), `pan` → `pan1` | air rushing past: a hop, a jump |
| `pop` | `note` (start pitch, 420 Hz) | a "!": a quick upward bubble pop |
| `twinkle` | `notes` (`A6 D7 F#7 A7`), `gap` (0.065 s) | delight: a rising sparkle of tiny bells |
| `giggle` | `n` blips (4), `pitch` (`A5`), `gap` (0.1 s) | a laugh without words: "hee-hee-hee" |
| `chime` | `notes` (`D5 F#5 A5 D6`), `roll` (0.03 s) | love / warmth: a soft bell chord |
| `tink` | `note` (`A7`) | a tiny glass tink (the iris closing) |
| `thump` | `weight` (1; ~0.6 for sitting down), `rustle` (0–1, grass), `wet` (0–1, water shaken off) | a small body landing on grass: a dull thud gliding down, crushed blades, patter from wet feet |

## Ambience

| kind | params | what it is |
|---|---|---|
| `birds` | `until` (beat; default the film's end), `hush` (s of quiet before `until`, 1), `full` (beat where they reach full song), `rate` (phrases/s, 0.45) | birds once the sun is out: sparse chirps panned to the sides |
| `bird` | `song` (`tsip`, `chirrup` or `teetoo`; default random), `pan` (0.6) | one far-off bird: a single phrase, softer than `birds` |

## What the picture gets (`SCORE` in `animation/src/scenes/plink_score.js`)

`SCORE.marks`: one entry per cue in time order (`kind`, `t`, `x`, `beat`; steps add `depth`, `v`, `tBottom`; trot
footfalls have `beat: "D.trot#k"`, their lifts `"D.trot#k.lift"`, the jump landing `"E.land"`). `SCORE.trot` is
story.json `trot` plus `t0`. `SCORE.notes`: the melody, `{ t, note, f (Hz),
r (mm), x, beat, kind }`, one per tuned bubble, to pop a music note on. `SCORE.dip`, `drops`, `falls`, `bubbles` as
before (the toe-tap's flicked droplets are now in `drops`).
