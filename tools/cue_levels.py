"""How loud is each cue of a score, and what is it made of? For every mark in SCORE.marks (plink_score.js), the
loudest 20 ms RMS of the mix and of each stem in [t + t0, t + t1], against the stream bed's median level.
Needs `node synth/score_plink.mjs --stems DIR`."""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import soundfile as sf


def rms_track(x, sr, win_s=0.02):
    n = int(sr * win_s)
    frames = x[: len(x) // n * n].reshape(-1, n)
    return 20 * np.log10(np.sqrt((frames**2).mean(axis=1)) + 1e-12), win_s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stems_dir", type=Path)
    ap.add_argument("--score", type=Path, default=Path("animation/src/scenes/plink_score.js"))
    ap.add_argument("--t0", type=float, default=-0.02)
    ap.add_argument("--t1", type=float, default=0.3)
    ap.add_argument("--kinds", default="", help="comma-separated mark kinds to show (default: all)")
    ap.add_argument("--top", type=int, default=5, help="stems listed per cue")
    args = ap.parse_args()

    score = json.loads(re.search(r"const SCORE = (.*);\s*$", args.score.read_text(), re.S).group(1))
    mix, sr = sf.read(args.stems_dir / "plink.wav", always_2d=True)
    tracks = {"mix": rms_track(mix.mean(axis=1), sr)[0]}
    for p in sorted(args.stems_dir.glob("plink.stem-*.wav")):
        x, _ = sf.read(p, always_2d=True)
        tracks[p.stem.split(".stem-")[1]] = rms_track(x.mean(axis=1), sr)[0]
    win = 0.02
    bed = np.median(tracks["stream"][int(2 / win) : int((score["duration"] - 2) / win)]) if "stream" in tracks else np.nan
    print(f"stream bed median {bed:.1f} dBFS (20 ms RMS); mix peak {tracks['mix'].max():.1f}")
    kinds = set(filter(None, args.kinds.split(",")))
    for m in score["marks"]:
        if kinds and m["kind"] not in kinds:
            continue
        a, b = int((m["t"] + args.t0) / win), int((m["t"] + args.t1) / win) + 1
        peaks = {k: v[a:b].max() for k, v in tracks.items()}
        stems = sorted(((v, k) for k, v in peaks.items() if k != "mix"), reverse=True)[: args.top]
        label = f"{m['kind']}@{m['t']:.2f} {m.get('beat', '')}"
        print(f"{label:<28} mix {peaks['mix']:6.1f} (bed +{peaks['mix'] - bed:4.1f})  " +
              "  ".join(f"{k} {v:.1f}" for v, k in stems))


if __name__ == "__main__":
    main()
