# Plink — storyboard (draft 2)

**Logline.** Clawd wants the flower on the far bank without getting wet, but its first careful toe-tap goes
*plink*, and Clawd falls for the sound: it splashes all the way across, jumps into the deepest pool, bounds out to the
flower and sits beside it, feet dangling over the water. One last drop gathers on a foot and falls: *plink*.

**The trick.** Sound and picture come from the same list of physical events. The soundtrack is rendered by the
water synth; the animation reads that event list, so every droplet you see flies its real parabola
(T = 2v/g) and lands on the frame its tick plays, every visible bubble is drawn at its real radius (scaled up)
and pops when its ring ends, and each footfall's crown rises when its slap sounds. Nothing is hand-synced.
Only what you hear gets drawn: silent mist isn't painted.

**World.** A shallow stream after rain, morning. Teal water, sap-green banks, pale sky, wet stones. The far bank
(from 1.3 m) rises into a grassy ledge whose front the stream has cut into an earth face; the flower grows on top,
and the deep pool (0.5 m) lies at its foot. Colour arc:
overcast blue-grey at the start (cool, Clawd hesitant) → sun breaking through as Clawd's joy grows → warm gold
light on the water at the end.

**Goal.** The flower on the far ledge: found by Clawd's gaze in A, glinting again when Clawd remembers it in F, and
Clawd ends up sitting beside it.

**Motif.** The single *plink*: one bubble, one ring. First at the toe-tap (B), last as the drop from the dangling
foot (F), the last note of the melody. Both are close-ups of a foot at the water that tilt up to Clawd's face.

**Clawd's arc.** curious → hopeful (the flower) → nervous → surprised → delighted → playful/excited → ecstatic →
hopeful (the flower again) → content → love.

**Soundtrack** (all synthesized, placed on the same timeline): a soft babbling-stream bed under everything
(van den Doel's stream model — the same bubbles, at a few hundred per second), a toe-tap bubble, one ankle-deep
step, the trot, a big pool landing, three bounds out of the pool (the melody climbs A5 B5 C#6 on their landings), the
feet leaving the water on each takeoff, thumps on the grass, one drip (D6, the tonic).

## Shots (≈ 27 s)

Times assume shot A grows to 4.8 s, so everything after it moves 1.2 s later than in story.json today.

```
A  0.0–4.8   [in: iris opens on Clawd]  Medium on Clawd, near bank. EVENT: Clawd sees the flower across the
             stream and wants it, then looks at the water between and lifts a foot over it.
   reads: 0.0–0.55 Clawd on its bank by the water (3/4 view, idle)
          0.55–0.8 its eyes go up and to the right, and light up (hopeful)
          0.8–2.0  the camera follows the gaze across the stream, pulling back so the water between reads, and
                   lands on the flower on its ledge
          2.0–2.55 the flower sways and glints: the goal
          2.55–3.1 the camera rushes back: Clawd still gazing
          3.1–3.6  Clawd strains toward it: up on its toes, near arm reaching out
          3.6–4.1  Clawd turns side-on and looks down at the water: nervous, sweat
          4.1–4.8  one foot lifts and hovers over the water (anticipation)

B  4.8–8.2   [cut on action: the foot comes down]  Close-up at water level, then tilt up to the face.
             EVENT: toe touches the surface → a ring spreads → one bubble (r ≈ 3.5 mm) forms and pops: *plink*.
   reads: 4.8–5.6  the toe meets the water, a ring spreads
          5.6–6.4  the bubble rises and pops (the sound)
          6.4–8.2  Clawd's face: surprise (!) → delight

C  8.2–11.8  [continuous pull-back]  Medium. EVENT: Clawd stomps in on purpose: SPLOOSH (the ankle-deep step).
             The crown of water, droplets on their real arcs, landing rings. It laughs.
   reads: 8.2–9.0   anticipation: leg raised high, determined
          9.0–10.2  the step: crown, droplets fly and land in sync
          10.2–11.8 Clawd laughs, wet

D  11.8–17.0 [whip pan with Clawd's motion]  Side view, tracking right. EVENT: Clawd trots across, six steps,
             each throwing spray; drips fall from lifted feet. Sun breaks out.
   reads: 11.8–13.6 it sets off wading: the rhythm
          13.6–15.6 it becomes a dance: a bounce on every step
          15.6–17.0 Clawd spots a deep pool ahead (eyes first, then !)

E  17.0–19.6 [cut on action: the crouch]  EVENT: jump — crouch, arc, land: the big splash. Clawd laughs in the
             pool. The camera ends on the pool with the ledge and the flower at the right of frame.
   reads: 17.0–17.6 crouch
          17.6–18.2 the arc through the air
          18.2–19.1 the splash
          19.1–19.6 Clawd drenched, laughing

F  19.6–27.2 [no cut: continues E's take and camera]  The far bank. EVENT: Clawd remembers the flower, bounds out of
             the pool, hops up onto the ledge and sits by the flower, feet dangling over the water; a drop falls
             from a foot: *plink*.
   reads: 19.65–20.25 the laugh ends; Clawd looks up at the flower, which glints (the goal is back)
          20.25–21.55 it turns and bounds out of the pool: three splashing bounds, each landing ringing a note
                      (A5 B5 C#6); the camera follows, the ledge grows
          21.55–22.2  crouch, hop up onto the ledge, land standing on the lip, plop down to sit
          22.2–23.05  content: eyes closed, smiling, feet swinging; the flower leans toward Clawd
          23.05–23.9  Clawd looks down at its foot, the camera follows its eyes down (as close as B): a drop
                      gathers on the still foot
          23.9–24.5   the drop falls: *plink* (the melody's last note), a ring, a bubble
          24.5–24.95  the camera tilts up to the face, as B did
          24.95–25.95 love: heart eyes, hearts; the flower nods
          25.95–27.2  iris closes on Clawd and the flower
   [out: iris]
```

Checks: an event in every shot · reads don't overlap · a transition at every seam · no text anywhere ·
the ending rhymes with the opening: Clawd on a bank looking across the water at the flower in A, sitting by the
flower looking down at the water in F; one drop, one ring, a close-up tilting up to the face, as in B.
