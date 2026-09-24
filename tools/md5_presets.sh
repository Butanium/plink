#!/bin/bash
# md5 of the plain makeStep / makeWalk renders (wav + event list). The Sploosh artifact and history/ rely on these
# staying byte-identical: run before and after a synth.js change and diff the two outputs.
# usage: tools/md5_presets.sh [out_dir]   (default: a fresh temp dir)
set -euo pipefail
cd "$(dirname "$0")/.."
out=${1:-$(mktemp -d)}
r() { node synth/render.mjs --out "$out/$1.wav" "${@:2}" > /dev/null; }
r puddle_s1 --preset puddle --seed 1
r ankle_s1 --preset ankle --seed 1
r shin_s1 --preset shin --seed 1
r ankle_exit_s2 --preset ankle --seed 2 --set exit=true
r ankle_walk6_s3 --preset ankle --seed 3 --walk 6
r puddle_walk4_s1 --preset puddle --seed 1 --walk 4 --interval 0.6
(cd "$out" && md5sum *.wav *.events.json)
