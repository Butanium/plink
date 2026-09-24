# Evolution of the synth

Each `history/vN/` holds the synth source snapshot (`synth.js`), renders (`*_s1.wav` + per-component
`.stem-*.wav`), synth event lists (`*.events.json`), and plots (`single.png`, ...).
Re-render any version: `node history/vN/render.mjs`-style — copy `history/vN/synth.js` over `synth/synth.js`
or import it directly.

## v1 — first physical model
Components: slap (heel + forefoot, air cushion under the sole), heel thud on the bottom, spray grains,
fizz bubbles (0.15–1 mm), turbulent cloud bubbles (0.8–6 mm), cavity bloops, slosh grains + gurgle bubbles,
ballistic droplet fallback (tick + sometimes a bubble).
Seen: the slap carries almost all the energy (stems: slap −1 dB vs mix; bubbles −15 to −30 dB) →
reads as "a clap with a faint tail". Fizz sits at 11–20 kHz, too high for a splash's "sh" (2–8 kHz).
Droplet landings are uniform Poisson → hiss rather than the clustered crackle of a real splash.

## v2 — hierarchical splash (pockets, blobs, droplets)
A splash is many small splashes: bubbles now come in *pockets* (one parcel of air torn into 1–5 bubbles within
a few ms), thrown-up water lands as *blobs* (a splat + a few bubbles) and fine *droplets* (tick, sometimes a
bubble). Fizz moved to 0.35–1.5 mm (2–9 kHz); slap scaled by sole flatness (ankle 0.6).
Seen: the ankle step is now bubble-dominated (cloud −2.7 dB) and shows the upward-gliding bubble streaks.
Issues: ankle body dark (centroid ≈1 kHz after 100 ms), isolated loud slosh grains at 0.78/0.9 s,
puddle patter tail 25–30 dB under the impact.

## v3 — balance
Slosh/gurgle energy fades after the step (τ = 0.2 s); fallback blobs/droplets louder; fizz ×2.4 and longer;
bloops only when water closes over the foot (deep > 0.5); bubbles inside turbulent pockets damped ×1.6.
Seen: stray late grains gone. Puddle tail now audible but flat from 0.15 to 0.8 s ("brief rain").

## v4 — drops
Droplet launch speeds less spread (σ 0.55→0.45, cap 2.8 m/s) → tail ends ≈0.6 s; drop ticks moved down to
0.8–6 kHz (a 1 mm drop at 2 m/s touches down over ≈a/v = 0.5 ms). Exit + walk checked for the first time:
lift-off "shlup" as loud as the step in (too loud); drips show the classic rising "plink" hook; walk goes to
digital silence between steps and every step is equally strong.

## v5 — first listening pack (sent to Clément)
Exit pockets quieter (0.12→0.07), fewer exit blobs. New `ambience`: leftover lapping grains + stray surfacing
bubbles; noise floor at −66 dBFS so silence is never digital zero. Walk: 0.85 s/step, per-step jitter on foot
speed (σ 0.2), depth (σ 0.15), spray, bubbles. Pack: `listen/v5/`.

## v6 — no more crackle (first human feedback)
Clément: "since version 3 there is a crépitement at the end, as if some bubble parameter were so short and there
are so many that we hear that". Confirmed with `tools/tail_events.py` (sub-2 ms events louder than −34 dBFS in
the 0.3–0.9 s tail): puddle 242/s (v2) → 507/s (v3) → 657/s (v4–v5), ankle 100 → 155/s, almost all `drop`
ticks. Cause: every one of ~1000 flung droplets got a crisp noise click, and v3 raised them ~5 dB.
Fix (physics): mist (< 0.4 mm) is silent; a slow drop's impact is soft, p ∝ a·v² (base 0.045→0.018);
only drops > 0.6 mm trap bubbles (no more 10 kHz pings); blob splats halved and softened (attack 0.2→0.5 ms).
Now puddle 150/s, ankle 23/s — below v2 at every threshold. Also: leftover ripples settle after each step
(densest right after the footfall, gone within ~1 s) instead of random isolated blips over the whole clip.

## v7 — soft knocks (second human feedback)
Clément: "i still [hear] some in the six step version". My v6 check only looked at 0.3–0.9 s after the *first*
footfall, so it was blind to walks. Two detectors tried: (1) spikes standing out of their local background
(`tools/crackle.py`) — ~30/s in every version, v2 included, so it counts legitimate isolated plinks, not crackle;
(2) treble kurtosis in 20 ms windows (`tools/impulsiveness.py`) — median over the same 6-step walk: v2 7.3,
**v3 11.6**, v4–v6 8.1–9.1. This one agrees with Clément's ears (crackle from v3 on), so it's the check to use.
Per stem: fizz is loud but Gaussian (k≈5, a hiss, not the culprit); v3 made drop/splat/lift-out treble +5–6 dB,
and drips were the spikiest thing in the file (k≈46: crisp 0.05 ms-attack clicks).
Fix (physics): one `impact()` for all water-on-water knocks — attack ≈ contact time a/v, low-pass ≈ 2v/a,
p ∝ a·v² (a 2 mm drip at 2 m/s is a dull 1 ms "tup"; its bright part is the bubble it traps, now 75% of drips);
bubbles torn from turbulent pockets are excited over one cycle (van den Doel: real excitation isn't a pure
impulse), isolated drip/drop bubbles keep their crisp 0.3-cycle start. Walks now k≈6.9–7.1 (seeds 3, 1), drips
k 46→21 and −7 dB treble, cloud k 10→8.
