"""Spectrogram of a time segment of the Plink soundtrack (mix + optional stems, all on the mix's dB scale), with the
score's notes (cyan) and marks (white) drawn on. Needs `node synth/score_plink.mjs --stems DIR`.
uv run tools/seg_spec.py out/plink_stems 10.9 12.0 --stems note,cloud --out out/check/x.png
(whole film: 0 21.5 --width 26 --hop 0.004)"""
import argparse
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf

from inspect_audio import multires_spec

ap = argparse.ArgumentParser()
ap.add_argument("stems_dir", type=Path)
ap.add_argument("t0", type=float)
ap.add_argument("t1", type=float)
ap.add_argument("--stems", default="")
ap.add_argument("--out", type=Path, required=True)
ap.add_argument("--range-db", type=float, default=70)
ap.add_argument("--fmax", type=float, default=12000)
ap.add_argument("--width", type=float, default=12)
ap.add_argument("--hop", type=float, default=0.001)
args = ap.parse_args()
score = json.loads(re.search(r"const SCORE = (.*);\s*$", Path("animation/src/scenes/plink_score.js").read_text(), re.S).group(1))
names = ["plink"] + [f"plink.stem-{s}" for s in filter(None, args.stems.split(","))]
fig, axes = plt.subplots(len(names), 1, figsize=(args.width, 3.2 * len(names)), squeeze=False)
ref = None
for ax, name in zip(axes[:, 0], names):
    x, sr = sf.read(args.stems_dir / f"{name}.wav", always_2d=True)
    x = x.mean(axis=1)[int(args.t0 * sr) : int(args.t1 * sr)]
    t, f, S = multires_spec(x, sr, hop_s=args.hop, fmin=100, fmax=args.fmax)
    # multires_spec normalises to its own max: re-reference every panel to the mix's max
    Sa = S + 10 * np.log10((x**2).max() + 1e-20)
    ref = Sa.max() if ref is None else ref
    ax.pcolormesh(t + args.t0, f, Sa - ref, shading="auto", cmap="magma", vmin=-args.range_db, vmax=0)
    ax.set_yscale("log"); ax.set_ylim(100, args.fmax); ax.set_title(name)
    for n in score["notes"]:
        if args.t0 <= n["t"] <= args.t1:
            ax.plot([n["t"], n["t"] + 0.15], [n["f"], n["f"]], color="cyan", lw=0.8, alpha=0.7)
            ax.text(n["t"], n["f"] * 1.08, n["note"], color="cyan", fontsize=8)
    for m in score["marks"]:
        if args.t0 <= m["t"] <= args.t1 and m["kind"] != "note":
            ax.axvline(m["t"], color="w", lw=0.5, alpha=0.5)
            ax.text(m["t"], 110, m["kind"], color="w", fontsize=7, rotation=90)
fig.tight_layout()
args.out.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(args.out, dpi=80)
print("saved", args.out)
