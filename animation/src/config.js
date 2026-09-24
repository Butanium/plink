// config.js: project settings.
//   duration: the video's length in seconds.
//   bpm:      the rhythm that bounces, dances and pulse() follow. Clawd always moves to some beat; if the video has music,
//             set this to the song's tempo, and set offset to the time in seconds of its first downbeat.
// Plink: one beat per trot step (0.82 s), with a beat on the first footfall of the trot (12.55 s).
const PROJECT = { duration: 27.2, bpm: 60 / 0.82, offset: 12.55 % 0.82, audio: 'assets/plink.wav' };
