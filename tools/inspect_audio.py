"""Look at synthesized audio: multi-resolution log-frequency spectrogram, level envelope,
synth-event overlay, octave-band balance, and per-stem loudness in the mix."""
import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import soundfile as sf
from scipy.interpolate import interp1d
from scipy.signal import stft

SRC_COLORS = {
    "slap": "#ff4d4d", "thud": "#ffa64d", "crown": "#e6e6e6", "spray": "#ff9999", "fizz": "#66d9ff", "cloud": "#3399ff",
    "bloop": "#b366ff", "slosh": "#99cc66", "gurgle": "#33cc99", "drop": "#ffff66", "exit": "#ff66cc",
    "drip": "#ffcc00", "ambience": "#888888",
}
OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]


def load(path: Path) -> tuple[np.ndarray, int]:
    x, sr = sf.read(path, dtype="float64", always_2d=True)
    return x.mean(axis=1), sr


def multires_spec(x, sr, hop_s=0.001, fmin=30.0, fmax=20000.0, nbins=360):
    """Long windows for low frequencies, short for high ones, crossfaded on a log-frequency grid."""
    hop = int(sr * hop_s)
    grid = np.geomspace(fmin, fmax, nbins)
    splits = [(2048, None, 600.0), (1024, 600.0, 3000.0), (256, 3000.0, None)]
    lg = np.log2(grid)
    total = None
    for nfft, lo, hi in splits:
        f, t, Z = stft(x, sr, window="hann", nperseg=nfft, noverlap=nfft - hop, scaling="psd")
        P = np.log(np.abs(Z) ** 2 + 1e-20)
        Pg = interp1d(f, P, axis=0, bounds_error=False, fill_value=np.log(1e-20))(grid)
        w = np.ones_like(grid)
        if lo is not None:
            w *= np.clip(0.5 + (lg - np.log2(lo)) / 1.0, 0, 1)
        if hi is not None:
            w *= np.clip(0.5 - (lg - np.log2(hi)) / 1.0, 0, 1)
        term = w[:, None] * Pg
        total = term if total is None else total + term
    S = 10 * total / np.log(10)
    return t, grid, S - S.max()


def envelope_db(x, sr, win_s=0.005):
    n = int(sr * win_s)
    frames = x[: len(x) // n * n].reshape(-1, n)
    rms = np.sqrt((frames**2).mean(axis=1) + 1e-20)
    return (np.arange(len(rms)) + 0.5) * win_s, 20 * np.log10(rms)


def a_weight(f):
    f2 = f**2
    ra = (12194**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194**2))
    return ra / 0.7943  # 0 dB at 1 kHz


def band_energies(x, sr, t0=0.0, t1=None):
    seg = x[int(t0 * sr) : None if t1 is None else int(t1 * sr)]
    spec = np.abs(np.fft.rfft(seg)) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / sr)
    out = []
    for fc in OCTAVES:
        m = (f >= fc / np.sqrt(2)) & (f < fc * np.sqrt(2))
        out.append(spec[m].sum())
    out = np.array(out)
    return 10 * np.log10(out / out.sum() + 1e-20)


def a_energy_db(x, sr):
    spec = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    return 10 * np.log10((spec * a_weight(np.maximum(f, 1)) ** 2).sum() + 1e-20)


def centroid_track(x, sr, win_s=0.025):
    n = int(sr * win_s)
    frames = x[: len(x) // n * n].reshape(-1, n) * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    c = (spec * f).sum(axis=1) / (spec.sum(axis=1) + 1e-20)
    e = 10 * np.log10(spec.sum(axis=1) + 1e-20)
    return (np.arange(len(c)) + 0.5) * win_s, c, e - e.max()


def overlay_events(ax, events_path: Path, tmax: float, floor_db=-45.0):
    events = json.loads(events_path.read_text())["events"]
    amps = [e["amp"] for e in events]
    top = max(amps)
    for e in events:
        rel = 20 * np.log10(e["amp"] / top + 1e-12)
        if rel < floor_db or e["t"] > tmax:
            continue
        a = float(np.clip(0.25 + 0.75 * (rel - floor_db) / -floor_db, 0, 1))
        c = SRC_COLORS.get(e["src"], "white")
        if e["kind"] == "mode":
            T = 4.6 / e["d"]
            if e["sigma"] > 0:
                T_cap = (e["fEnd"] / e["f"] - 1) / e["sigma"]
                T = min(T, T_cap)
                f1 = e["f"] * (1 + e["sigma"] * T)
            else:
                f1 = e["f"]
            ax.plot([e["t"], e["t"] + T], [e["f"], f1], color=c, alpha=a, lw=1.2)
        else:
            ax.plot(e["t"], np.sqrt(e["hp"] * e["lp"]), marker="|", color=c, alpha=a * 0.8, ms=5)
    handles = [plt.Line2D([], [], color=c, lw=2, label=s) for s, c in SRC_COLORS.items()
               if any(e["src"] == s for e in events)]
    ax.legend(handles=handles, loc="upper right", fontsize=7, ncol=2, framealpha=0.5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wavs", nargs="+", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--zoom", type=float, default=0.3, help="seconds shown in the zoomed spectrogram")
    ap.add_argument("--events", action="store_true", help="overlay synth events on the zoomed spectrogram")
    ap.add_argument("--stems", action="store_true", help="report and plot per-stem levels (needs --stems renders)")
    ap.add_argument("--range-db", type=float, default=75.0)
    args = ap.parse_args()

    ncol = len(args.wavs)
    nrow = 4 if args.stems else 3
    fig, axes = plt.subplots(nrow, ncol, figsize=(9 * ncol, 3.2 * nrow + 2), squeeze=False,
                             gridspec_kw={"height_ratios": [1, 2.2, 2.2] + ([1.6] if args.stems else [])})
    for j, path in enumerate(args.wavs):
        x, sr = load(path)
        dur = len(x) / sr
        peak_db = 20 * np.log10(np.abs(x).max())
        print(f"\n== {path.name}  {dur:.2f}s  peak {peak_db:.1f} dBFS  "
              f"A-weighted energy {a_energy_db(x, sr):.1f} dB")
        early = band_energies(x, sr, 0.0, 0.35)
        late = band_energies(x, sr, 0.35)
        print("   octave band (Hz):   " + " ".join(f"{f:>6}" for f in OCTAVES))
        print("   0-350ms  (dB rel): " + " ".join(f"{v:6.1f}" for v in early))
        print("   350ms-   (dB rel): " + " ".join(f"{v:6.1f}" for v in late))
        tc, cen, ce = centroid_track(x, sr)
        keep = (ce > -40) & (tc < 1.2)
        print("   centroid (kHz) every 25ms where level > -40dB: " +
              " ".join(f"{t*1000:.0f}:{c/1000:.1f}" for t, c in zip(tc[keep][::2], cen[keep][::2])))

        ax = axes[0, j]
        te, ed = envelope_db(x, sr)
        ax.plot(te, ed, color="k", lw=0.8)
        ax.set_ylim(-90, 0)
        ax.set_xlim(0, dur)
        ax.set_ylabel("RMS 5ms (dBFS)")
        ax.set_title(path.name)
        ax.grid(alpha=0.3)

        t, f, S = multires_spec(x, sr)
        for row, tmax in [(1, dur), (2, args.zoom)]:
            ax = axes[row, j]
            m = t <= tmax
            ax.pcolormesh(t[m], f, S[:, m], shading="auto", cmap="magma", vmin=-args.range_db, vmax=0)
            ax.set_yscale("log")
            ax.set_ylim(30, 20000)
            ax.set_xlim(0, tmax)
            ax.set_ylabel("Hz")
            if row == 2 and args.events:
                ev_path = path.with_name(path.name.replace(".wav", ".events.json"))
                if ev_path.exists():
                    overlay_events(ax, ev_path, tmax)
        axes[2, j].set_xlabel("s")

        if args.stems:
            ax = axes[3, j]
            total = a_energy_db(x, sr)
            print("   stem      A-energy rel mix   peak dBFS")
            for stem in sorted(path.parent.glob(path.stem + ".stem-*.wav")):
                name = stem.stem.split(".stem-")[1]
                xs, _ = load(stem)
                print(f"   {name:<9} {a_energy_db(xs, sr) - total:10.1f} dB   {20*np.log10(np.abs(xs).max()+1e-12):8.1f}")
                ts, es = envelope_db(xs, sr, 0.01)
                ax.plot(ts, es, color=SRC_COLORS.get(name, "gray"), lw=1.2, label=name)
            ax.set_ylim(-80, 0)
            ax.set_xlim(0, dur)
            ax.set_facecolor("#333")
            ax.legend(fontsize=7, ncol=4, loc="upper right")
            ax.set_ylabel("stem RMS 10ms")
            ax.grid(alpha=0.2)
    fig.tight_layout()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.out, dpi=85)
    print(f"\nsaved {args.out}")


if __name__ == "__main__":
    main()
