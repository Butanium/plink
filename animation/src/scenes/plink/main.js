// main.js: registers the shots at the start times in story.json.
(() => {
  const starts = PLK.S.story.shots;
  shots(Object.keys(starts).map((k) => [starts[k], PLK.shot[k]]));
})();
