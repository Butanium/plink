// base.js: what every part of "Plink" shares — the world's scale, the palette, the score (SCORE, from
// plink_score.js: the physical events behind assets/plink.wav) and the story's beats (story.json). Every other
// plink/*.js file reads these from the PLK namespace and adds its own functions to it.
const PLK = {};
(() => {
  const S = SCORE;
  const G = 9.81;
  const PXM = 900, ZM = 1300;              // px per metre along the stream, and for heights (arcs drawn a touch tall)
  const MX = (m) => 560 + m * PXM;         // world x (px) of a stream position (m)
  const WL = 700;                          // Clawd's waterline; the water's far edge sits a little higher
  const BANK = WL - 26, BED = WL + 30, POOL = WL + 53;
  const BANK_L = MX(-0.4), BANK_R = MX(1.3);
  const U = 24;                            // Clawd's size in the world: the camera zooms, Clawd doesn't
  const C = {
    skyCold: '#B6C6CC', skyWarm: '#F4D8A2', hillCold: '#7F9C90', hillWarm: '#9EB86E', grass: '#7AA159',
    soil: '#8B6F54', water: '#4E9EA4', waterDk: '#2F737B', foam: '#EEF7F3', stone: '#A6A194', stoneDk: '#7E796D',
  };
  // the story's beats (animation/story.json, embedded in SCORE by synth/score_plink.mjs)
  const beat = (name) => {
    if (!(name in S.story.beats)) throw new Error(`story.json has no beat ${name}`);
    return S.story.beats[name];
  };
  // the score's mark of one kind on a beat (a trot footfall's beat carries both its step and its note)
  const mark = (name, kind) => {
    const m = S.marks.find((m) => m.beat === name && m.kind === kind);
    if (!m) throw new Error(`SCORE has no ${kind} mark on beat ${name}`);
    return m;
  };
  const warm = (t) => ease(seg(t, beat('D.sun'), beat('E.sun')));
  S.drops.forEach((d, i) => { d.id = i; d.xl = d.x0 + d.vx * (d.tLand - d.tl); });
  S.falls.forEach((f, i) => { f.id = i; });
  S.bubbles.forEach((b, i) => { b.id = i; });
  const STEPS = S.marks.filter((m) => m.kind === 'step');
  const TROT = S.trot, JUMP = S.jump, DIP = S.dip, STEP_IN = mark('C.land', 'step'), DRIP = mark('F.drip', 'drip');

  // Where each shot puts Clawd
  const X_BANK = MX(DIP.x) - (0.9 + .8 + .5) * U;         // on the near bank, near front foot able to reach the dip point
  const X_IN = MX(STEP_IN.x) - (0.9 + .55 + .5) * U;      // stomped in: that foot lands on the first splash

  Object.assign(PLK, { S, G, PXM, ZM, MX, WL, BANK, BED, POOL, BANK_L, BANK_R, U, C, warm, STEPS, TROT, JUMP, DIP, STEP_IN, DRIP, beat, mark, X_BANK, X_IN });
})();
