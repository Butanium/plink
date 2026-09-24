"""Find audible clicks in a render: sub-millisecond spikes in the high band (default > 3 kHz: a dull knock or a
2 kHz bubble plink barely registers there, a crisp click does) that stand out from their local
background, attributed to the synth component (stem) that carries them. Needs a render made with --stems."""
import argparse
from collections import Counter
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import median_filter
from scipy.signal import butter, sosfiltfilt


def band_env(x, sr, frame_s, hp=3000.0):
    sos = butter(4, hp, btype="highpass", fs=sr, output="sos")
    y = sosfiltfilt(sos, x)
    n = int(sr * frame_s)
    frames = y[: len(y) // n * n].reshape(-1, n)
    return np.sqrt((frames**2).mean(axis=1) + 1e-20)


def load_mono(path):
    x, sr = sf.read(path, dtype="float64", always_2d=True)
    return x.mean(axis=1), sr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav", type=Path)
    ap.add_argument("--frame-ms", type=float, default=0.5)
    ap.add_argument("--hp", type=float, default=3000.0, help="clicks are judged in the band above this (Hz)")
    ap.add_argument("--bg-ms", type=float, default=40.0, help="window of the local background (median)")
    ap.add_argument("--stand-out-db", type=float, default=12.0)
    ap.add_argument("--floor-db", type=float, default=-50.0, help="ignore spikes quieter than this (dBFS, high band)")
    ap.add_argument("--list", type=int, default=0, help="print the N loudest clicks")
    args = ap.parse_args()

    x, sr = load_mono(args.wav)
    fs = args.frame_ms / 1000
    env = band_env(x, sr, fs, args.hp)
    bg = median_filter(env, size=int(args.bg_ms / args.frame_ms) | 1, mode="nearest")
    db = 20 * np.log10(env)
    stand = db - 20 * np.log10(bg)
    # a click is a local maximum that towers over its surroundings
    peak = (env >= np.roll(env, 1)) & (env >= np.roll(env, -1))
    hits = np.where(peak & (stand > args.stand_out_db) & (db > args.floor_db))[0]

    stems = {p.stem.split(".stem-")[1]: band_env(load_mono(p)[0], sr, fs, args.hp)
             for p in sorted(args.wav.parent.glob(args.wav.stem + ".stem-*.wav"))}
    who = Counter()
    rows = []
    for i in hits:
        src = max(stems, key=lambda k: stems[k][i]) if stems else "?"
        who[src] += 1
        rows.append((db[i], i * fs, src, stand[i]))
    dur = len(x) / sr
    print(f"{args.wav.name}: {len(hits)} clicks in {dur:.1f}s ({len(hits) / dur:.1f}/s) standing "
          f">{args.stand_out_db:.0f} dB over the local background")
    print("   by component: " + ", ".join(f"{k} {v}" for k, v in who.most_common()))
    for d, t, src, s in sorted(rows, reverse=True)[: args.list]:
        print(f"   t={t:6.3f}s  {d:6.1f} dBFS  +{s:4.1f} dB over bg  {src}")


if __name__ == "__main__":
    main()
