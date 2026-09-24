"""Count audible short events in the tail of a render, per component: how dense the 'crackle' is."""
import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("events", nargs="+", type=Path)
    ap.add_argument("--t0", type=float, default=0.3, help="tail starts here (s)")
    ap.add_argument("--t1", type=float, default=0.9)
    ap.add_argument("--floor-db", type=float, default=-50.0, help="event peak (dBFS) counted as audible")
    ap.add_argument("--short-ms", type=float, default=2.0, help="only events that last less than this (clicks)")
    args = ap.parse_args()
    for path in args.events:
        ev = json.loads(path.read_text())["events"]
        rate = Counter()
        for e in ev:
            if not (args.t0 <= e["t"] < args.t1) or 20 * np.log10(e["amp"] + 1e-12) < args.floor_db:
                continue
            dur_ms = 1000 * (e["decay"] if e["kind"] == "burst" else 1 / e["d"])
            if dur_ms < args.short_ms:
                rate[f'{e["src"]}:{e["kind"]}'] += 1
        span = args.t1 - args.t0
        total = sum(rate.values()) / span
        top = ", ".join(f"{k} {v / span:.0f}/s" for k, v in rate.most_common(4))
        print(f"{path.parent.name}/{path.name:<28} audible clicks {total:5.0f}/s   {top}")


if __name__ == "__main__":
    main()
