"""Does a cue cut through the mix? For each cue with its own stem (SCORE.marks of kinds that name a stem, and every
note of SCORE.notes, stem `note`), the best third-octave band SNR of that stem against the sum of all the other
stems over [t, t + win]: > 0 dB means some band of it is louder than everything else there. (Not mix − stem: a
noise event's samples differ between the mix and its stem, so the difference would still contain it.)
Needs `node synth/score_plink.mjs --stems DIR`."""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import stft

HOP_S = 0.005


def load(path):
    x, sr = sf.read(path, always_2d=True)
    return x.mean(axis=1), sr


def band_power(x, sr, bands):
    f, t, Z = stft(x, sr, nperseg=2048, noverlap=2048 - int(HOP_S * sr))
    P = np.abs(Z) ** 2
    return t, np.stack([P[(f >= lo) & (f < hi)].sum(axis=0) for lo, hi in bands])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stems_dir", type=Path)
    ap.add_argument("--score", type=Path, default=Path("animation/src/scenes/plink_score.js"))
    ap.add_argument("--win", type=float, default=0.15)
    ap.add_argument("--spans", default="birds", help="stems without marks: report where they sound and how they fare")
    args = ap.parse_args()
    score = json.loads(re.search(r"const SCORE = (.*);\s*$", args.score.read_text(), re.S).group(1))
    stems = {p.stem.split(".stem-")[1]: load(p)[0] for p in sorted(args.stems_dir.glob("plink.stem-*.wav"))}
    sr = load(args.stems_dir / "plink.wav")[1]
    total = sum(stems.values())
    centres = 1000 * 2 ** (np.arange(-10, 13) / 3)
    bands = [(c * 2 ** (-1 / 6), c * 2 ** (1 / 6)) for c in centres]
    cues = [(m["t"], m["kind"], m["kind"], m.get("beat", "")) for m in score["marks"]
            if m["kind"] != "note" and m["kind"] in stems]
    cues += [(n["t"], "note", f"note {n['note']}", n.get("beat", "")) for n in score["notes"]]
    cache = {}
    for t0, src, label, beat in sorted(cues):
        if src not in cache:
            tt, Px = band_power(stems[src], sr, bands)
            _, Po = band_power(total - stems[src], sr, bands)
            cache[src] = (tt, Px, Po)
        tt, Px, Po = cache[src]
        w = (tt >= t0) & (tt <= t0 + args.win)
        snr = 10 * np.log10((Px[:, w] + 1e-20) / (Po[:, w] + 1e-20))
        lvl = 10 * np.log10(Px[:, w] + 1e-20)
        audible = lvl > lvl.max() - 20          # ignore bands/frames where the cue itself is nearly silent
        snr_masked = np.where(audible, snr, -np.inf)
        b, k = np.unravel_index(np.argmax(snr_masked), snr.shape)
        # how long (ms) the cue stays above the rest in its best band
        above = (snr[b] > 0) & audible[b]
        print(f"{t0:6.2f} {label:<12} {beat:<11} best band {centres[b]:6.0f} Hz: SNR {snr_masked[b, k]:+5.1f} dB, "
              f"above the rest for {1000 * HOP_S * above.sum():4.0f} ms")
    for src in filter(lambda s: s in stems, args.spans.split(",")):
        tt, Px = band_power(stems[src], sr, bands)
        _, Po = band_power(total - stems[src], sr, bands)
        lvl = 10 * np.log10(Px + 1e-20)
        on = lvl.max(axis=0) > lvl.max() - 30          # frames where it sounds (within 30 dB of its loudest)
        b = np.argmax(np.where(lvl > lvl.max() - 30, 10 * np.log10((Px + 1e-20) / (Po + 1e-20)), -np.inf), axis=0)
        snr = 10 * np.log10((Px[b, np.arange(len(tt))] + 1e-20) / (Po[b, np.arange(len(tt))] + 1e-20))
        print(f"{src}: sounds from {tt[on].min():.2f} to {tt[on].max():.2f} s ({1000 * HOP_S * on.sum():.0f} ms in all); "
              f"best-band SNR while sounding: median {np.median(snr[on]):+.1f} dB, above the rest {100 * (snr[on] > 0).mean():.0f}% of the time")


if __name__ == "__main__":
    main()
