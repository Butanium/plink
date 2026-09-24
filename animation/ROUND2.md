# Plink, round 2: five Claude instances, one film

Version 1 of the film (21.5 s, `media/plink_v1.mp4`) went to its first viewer, Clément, who sent five notes. What we
decided for each:

1. **The paw touching the water had no sound of its own, only its bubble.** `sound` gave the touch a physical sound:
   the surface snapping onto the toe, the water pushed aside, a bubble or two trapped, a few droplets flicked up that
   tick back down, and the liquid bridge under the lifting toe snapping just before the plink.
2. **The trot read as a looping walk with splashes at arbitrary moments.** `trot` rebuilt it as four high steps.
   Each foot visibly leaves the water, hangs, and comes down into its own splash, and the body dips on each footfall.
3. **The camera jumped a little between the trot and the jump.** `trot` made one continuous camera move from the
   trot into the jump.
4. **Only the water made sounds while a lot else was happening.** `sound` added cartoon sounds (whoosh, pop, twinkle,
   giggle, chime, tink), birds once the sun comes out, and a melody played by tuned bubbles. The first plink is the
   first note, the trot's footfalls climb a phrase, the jump lands on the root and the last drip is the tonic.
5. **The last scene felt disconnected from the rest.** `story` set up a flower as Clawd's goal in the opening shot
   and rebuilt the ending around it. Clawd bounds out of the pool, climbs onto a grassy ledge by the flower and sits
   with his feet dangling, and a drop from his foot plays the last note.

## The team

The instance that made v1 supervised. It split the work by file, reviewed each teammate's contact sheets and
frame strips, sent fixes by message, and merged. Each teammate worked in its own git worktree and branch.

| teammate | owned |
|---|---|
| sound | `synth/synth.js` (additions only: the plain step and walk renders stayed byte-identical), `synth/score_plink.mjs`, the `cues` in `story.json` |
| trot | shots D and E, `legs.js`, the trot and jump staging in `story.json` |
| splash | `water_fx.js` |
| story | shots A and F, `world.js`, `STORYBOARD.md`, the shot starts and the ending's beats |
| supervisor | `base.js`, shots B and C, merges, the final render |

A fifth teammate set up rendering on a rented cloud GPU for later films. It wasn't needed for this one.

The rules that kept them out of each other's way:
- One owner per file.
- A sound is requested by adding a beat and a `cues` entry (`{kind, beat, ...}`) to `story.json`, and `sound`
  implements the kind.
- Merge order: sound → trot → splash → story, regenerating the score (`node synth/score_plink.mjs`) after each merge.
  The generated score file conflicts on every merge: take either side and regenerate.
- Teammates merged the main branch into theirs whenever something landed, so each checked their shots against the
  real soundtrack and the other teammates' effects.
- Shot A needed 1.2 s more. Everyone worked in the old times, and `story` made the shift as a single commit after
  the others were merged, turning the remaining absolute times into offsets from each shot's start.

## What each delivered

- **sound:** cue kinds for water, melody, cartoon sounds and birds, each cue with its own random seed so adding one
  doesn't reshuffle the others; the paw touch; the tuned-bubble melody in D major (A5 at the plink; the trot's A5
  D6 E6 F♯6; D5 when the jump lands; the wade-out's A5 B5 C♯6; D6 on the last drip); checks for crackle, levels
  and audibility (`tools/impulsiveness.py`, `cue_levels.py`, `audibility.py`, `seg_spec.py`).
- **trot:** feet planted in the world, so each foot stays where it landed; four high steps, 0.82 s apart; one
  camera from the trot into the jump; a crouch, arc and squash into the pool.
- **splash:** crowns of water that tear into the drops you hear, the jump's big splash, teardrop-shaped drops,
  rising note bubbles, splashes when a foot pulls out, and `notes(t)`, the music notes that pop up at each note.
- **story:** the flower set up in shot A, the ending on the far bank, and a fix for a p5.brush bug that erased
  outlines in close-ups (`centred()` in `src/core.js`).
- **supervisor:** timing by beat labels instead of positions in lists, the paw's flicked droplets and the first
  music note in shot B, a cut from B to C without a pop, the merges and the final render.

What we learned is in [`LESSONS.md`](LESSONS.md), in the "Round 2" sections.
