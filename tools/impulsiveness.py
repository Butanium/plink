"""How crackly is a render? Kurtosis of the treble band in short windows: a smooth hiss is Gaussian (≈3),
clicks heard one by one push it far higher. Reports the loudness-weighted crackle over the file and per stem."""
import argparse
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt
from scipy.stats import kurtosis


def load_mono(path):
    x, sr = sf.read(path, dtype="float64", always_2d=True)
    return x.mean(axis=1), sr


def windows(x, sr, hp, win_s, hop_s):
    y = sosfiltfilt(butter(4, hp, btype="highpass", fs=sr, output="sos"), x)
    n, h = int(sr * win_s), int(sr * hop_s)
    idx = np.arange(0, len(y) - n, h)
    frames = np.stack([y[i : i + n] for i in idx])
    level = 10 * np.log10((frames**2).mean(axis=1) + 1e-20)
    k = kurtosis(frames, axis=1, fisher=False)
    return idx / sr, level, k


def summarize(level, k, floor_db, crackle_k):
    m = level > floor_db
    if not m.any():
        return 0.0, 0.0
    w = 10 ** (level[m] / 10)
    return float((w * (k[m] > crackle_k)).sum() / w.sum()), float(np.median(k[m]))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wavs", nargs="+", type=Path)
    ap.add_argument("--hp", type=float, default=3000.0)
    ap.add_argument("--win-ms", type=float, default=20.0)
    ap.add_argument("--floor-db", type=float, default=-55.0, help="treble level (dBFS) below which windows are ignored")
    ap.add_argument("--crackle-k", type=float, default=8.0, help="kurtosis above which a window counts as crackly")
    ap.add_argument("--stems", action="store_true")
    args = ap.parse_args()
    for path in args.wavs:
        x, sr = load_mono(path)
        _, level, k = windows(x, sr, args.hp, args.win_ms / 1000, args.win_ms / 2000)
        frac, med = summarize(level, k, args.floor_db, args.crackle_k)
        print(f"{str(path):<40} crackly share of treble energy {100 * frac:5.1f}%   median kurtosis {med:5.1f}")
        if args.stems:
            for stem in sorted(path.parent.glob(path.stem + ".stem-*.wav")):
                xs, _ = load_mono(stem)
                _, ls, ks = windows(xs, sr, args.hp, args.win_ms / 1000, args.win_ms / 2000)
                f2, m2 = summarize(ls, ks, args.floor_db, args.crackle_k)
                e = 10 * np.log10((10 ** (ls / 10)).sum() + 1e-20)
                print(f"      {stem.stem.split('.stem-')[1]:<9} treble energy {e:6.1f} dB   crackly {100 * f2:5.1f}%   median k {m2:5.1f}")


if __name__ == "__main__":
    main()
