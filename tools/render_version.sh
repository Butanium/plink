#!/bin/bash
# Render the standard single-step presets for one synth version, snapshot the synth source,
# and plot. Everything lands in history/<version>/ so the evolution stays inspectable.
# usage: tools/render_version.sh v2 [preset ...]   (default presets: puddle ankle)
set -euo pipefail
cd "$(dirname "$0")/.."
ver=$1; shift
presets=${@:-puddle ankle}
dir=history/$ver
mkdir -p "$dir"
cp synth/synth.js "$dir/synth.js"
wavs=()
for p in $presets; do
  node synth/render.mjs --preset "$p" --seed 1 --out "$dir/${p}_s1.wav" --stems
  wavs+=("$dir/${p}_s1.wav")
done
uv run tools/inspect_audio.py "${wavs[@]}" --out "$dir/single.png" --events --stems
