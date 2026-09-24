# Lessons from making "Plink" with this kit

Read ANIMATION_GUIDE.md first (the kit's own rules). This file adds what we learned on top of it, making a film
whose soundtrack is synthesized from physics (../synth) and whose picture is painted from the same events.

## Rendering

- **Local, no GPU:** `node render.mjs --soft-gl ...` (WebGL in software). Light frames take 0.1–0.3 s, frames
  with big watercolour `fill`s up to 35 s. Chrome needs `--no-sandbox` on Ubuntu 23.10+ (render.mjs adds it).
- **GPU:** on a headless Linux machine with an NVIDIA GPU, `node render.mjs --gpu-angle=gl-egl ...`: the whole
  film in ~4 min on an L40. Chrome only reaches the GPU with that flag (`remote/gpu_probe.mjs` shows which
  renderer each flag set gets).
- A crop at full resolution (`--crop=x,y,w,h`) is how you see what a thumbnail hides. Twice in this project a
  "missing" mark turned out to be drawn but invisible (see pigment below), and only a crop showed it.

## p5.brush gotchas (all hit on this project)

- **Strokes drawn far from the origin vanish under a zoomed camera.** From zoom ~2, a `paint()` outline or an
  `inkLine()` at world x ≈ 2300 left only a dot at its first vertex; the same shape drawn after `translate()` to its
  own centre kept its outline at every zoom. `paint()` and `inkLine()` now draw every shape around its own centre
  (`centred()` in core.js). Shapes much bigger than the canvas (the bank polygons) still lose their outline, so draw
  such edges as `inkLine`s no bigger than the canvas.
- This one bug explains two traps we first blamed on other causes: pale ink over dark paint showing only its two
  ends as dots (we thought p5.brush's pigment mixing ate it), and spline outlines of closed shapes showing only their
  endpoints. Tested after the fix: at zoom 1–1.5 both render fully, even in raw world coordinates at x ≈ 2000; at
  zoom 2.2 the raw ones leave a dot and the centred ones stay whole. So light marks don't need to be washes to be
  seen, though thin wash ribbons (`paint(ribbon(points, w0, w1), { wash: col, ink: null })`) still look good for
  ripples and foam.
- **A NaN coordinate in a polygon throws** "Failed to construct 'OffscreenCanvas': Value is not of type 'unsigned
  long'", with a stack that points at the shot, not at the NaN (ours came from `Math.acos` of a ratio > 1). Guard
  geometry that can degenerate.
- **Outline weight scales with the camera zoom.** A fine outline at zoom 1.3 turns a small drop into a dark speck at
  zoom 3: keep the on-screen weight (`sw × min(1, 1.6/zoom)`) and give shapes only a few px wide a paler outline.
- **Big watercolour `fill`s bleed across the frame** (a fill on a 9000 px water rectangle left teal smears in the
  sky). Use `wash` for large areas; keep `fill` for small textured shapes.
- A translucent wash (`washOp` < 255) mixes like pigment too, so a "water patch" over a character never matches
  the water around it. To hide what's under water, don't draw it: clip it (see legs below).
- Every `paint` call costs; per frame, hundreds are fine. Cap the count of painted particles (sort by loudness).

## Patterns that worked

- **Sync by construction.** Don't time visuals to audio by hand. The synth's `makeScore()` tags each event with
  where it happens (a droplet's launch time, velocity, size; a bubble's position), `synth/score_plink.mjs` writes
  the audible ones into `src/scenes/plink_score.js`, and the painter draws each droplet on its real parabola
  (launched at `tl`, landing at `tLand`), so its ring appears on the frame its tick sounds.
- **One timeline, two readers.** `story.json` holds shot starts, named beats and staging numbers (trot, jump,
  drip). The score script and the scene both read it (`PLK.beat('C.land')`). After changing it, regenerate:
  `node ../synth/score_plink.mjs` (from the repo root: `node synth/score_plink.mjs`).
- **Legs through the draw hook.** `noLegs: true` + drawing the legs in `draw()` lets a foot reach, dip, dangle,
  and lets legs be cut exactly at the waterline (`withLegs` in plink/legs.js). `legPose` reproduces the kit's
  side-view walk formula, so a trot can be phase-locked to footfall times (a leg pair touches down at
  walk = 0.25 + k/2).
- **Continuous camera over small reframes.** A cut that changes the framing only a little reads as a glitch
  (Clément noticed one at the D→E cut). Either keep the camera continuous or make the cut a clearly different shot.

## Round 2: footfalls that read (trot, 2026-09-23)

- **A step's splash only reads if the foot is planted in world space.** The kit's walk slides the legs with the
  body, so a foot never stays where it landed. legs.js solves each leg for a fixed world point (`reachFor`/`legSole`,
  the inverse of clawd()'s transform), so the crown, lift bubble and drips all sit under the foot.
- **In side view a lifted foot needs clear water under it.** Step a far leg together with its near partner (front
  pair, back pair); a planted far leg behind a lifted near foot hides that the foot left the water.
- **Stubby legs reach ~1–2u.** Either move slowly, or slide the planted feet under water once their splash is gone.
- **Human-scale synth drips fall from the sky at Clawd's scale** (10–35 cm). Re-release each one from the foot that
  is up, keeping its sound time (`placeFalls`).
- **Planted feet turn emotion takes into stilts:** cap the leg stretch. A take on a takeoff frame doubles the
  stretch: damp the mood's takes while airborne.

## Round 2: staging (story) and water (splash), 2026-09-23

- **A tiny event needs a close-up of its cause.** The final drop was ~12 px at the medium framing and invisible;
  pushing the camera down to the foot, as shot B does for the toe, made it read and gave the ending its rhyme with B.
- **Hold the look before the move.** "Clawd remembers the flower" failed at 0.15 s: he turned away before the glint.
  It read once the look got ~0.4 s and the flower glinted while he looked.
- **Time every shot from its own start (`lt`, `dur`) or from beats, never absolute seconds.** Growing shot A by 1.2 s
  then touched two files; the next retime is a story.json change.
- **Handing a take between two owners' shots:** the earlier shot exports its camera and pose functions (`wadeCam`,
  `jumpPose`) and the later one blends the camera over ~1 s. The seam doesn't show.
- **Ink only the edges seen against the air** (an open `inkLine` along them), never where water meets water: closed
  outlines turned the splash's lip into a pot and the foam into a plate.
- **Splashes that tear into the drops you hear:** paint the drops first and the water sheet over them. Drops still
  inside the sheet stay hidden and appear as they fly clear of the rim; their flights stay untouched.
- **A splash painted behind a character is hidden by its body**, so footfall crowns go in front. In a big splash
  around the character, drops crossing the body move to the layer behind it while it lasts, so the face reads.
- A column of water rising straight behind a character's head reads as an antenna.

## Round 2: working as a team of five (2026-09-23)

- One owner per file, a supervisor who owns the shared constants (base.js) and merges in a fixed order, and
  cross-owner requests through the shared timeline (story.json beats + cues). Nobody waited on anybody for long.
- Teammates merged master into their branch whenever something landed, so each checked their shots against the
  real score and the other effects. Generated files (plink_score.js) conflict on every merge: take either side and
  regenerate.
- A kit bug found by one teammate (strokes vanishing under zoom) went to master at once, so every close-up check
  after it used the fix.
- Anything that must show over Clawd needs its own call after `clawd()`: the note glyphs are `notes(t)`, separate
  from `bubbles(t)`, which is painted before him.
- To check your file against a teammate's branch without touching it: `git worktree add --detach <scratch>
  <branch>`, copy your file in, regenerate the score and render there. Copy the images out before removing it.
- Renders started from the same checkout share one remote folder, synced with `rsync --delete`: a sheet started
  while a whole-film render runs swaps `assets/plink.wav` under it, and the film gets muxed with the new soundtrack.
  Wait, or give each render its own remote folder.

## What the first audience said (v1, 2026-09-23)

1. The paw touching the water made no sound, only its bubble did.
2. The trot looked like a looping walk with splashes at arbitrary moments: cause (a foot coming down) and effect
   (its splash) must read.
3. The camera jumped a little between the trot and the jump.
4. Only water made sounds while lots of other things happened on screen.
5. The last scene felt disconnected from the rest.
