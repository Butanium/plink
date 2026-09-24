"""Blind listening test: play clips to audio-capable models via OpenRouter with no hint of what they are.
Saves every raw answer to JSON so they can be re-read or re-scored later."""
import argparse
import base64
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

PROMPTS = {
    "identify": "Listen to this audio clip. Describe what you hear, in detail. Then give your single best guess "
                "of what is producing the sound, followed by two alternative guesses.",
    "real_or_synth": "Listen to this audio clip. Is it a field recording of a real event, or was it synthesized "
                     "or generated? Answer 'recorded' or 'synthesized' first, then explain what you heard that "
                     "led you there.",
}


def ask(model: str, wav: Path, prompt: str) -> str:
    audio = base64.b64encode(wav.read_bytes()).decode()
    body = {
        "model": model,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "input_audio", "input_audio": {"data": audio, "format": "wav"}},
        ]}],
    }
    headers = {"Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}"}
    for attempt in range(4):
        r = requests.post("https://openrouter.ai/api/v1/chat/completions", json=body, headers=headers, timeout=300)
        if r.status_code == 200 and "choices" in r.json():
            return r.json()["choices"][0]["message"]["content"]
        time.sleep(5 * (attempt + 1))
    return f"ERROR {r.status_code}: {r.text}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wavs", nargs="+", type=Path)
    ap.add_argument("--models", nargs="+", required=True)
    ap.add_argument("--prompts", nargs="+", default=list(PROMPTS))
    ap.add_argument("--repeats", type=int, default=1)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    jobs = [(m, w, p, k) for m in args.models for w in args.wavs for p in args.prompts for k in range(args.repeats)]
    with ThreadPoolExecutor(8) as ex:
        answers = list(ex.map(lambda j: ask(j[0], j[1], PROMPTS[j[2]]), jobs))
    rows = [{"model": m, "clip": w.name, "prompt": p, "repeat": k, "answer": a}
            for (m, w, p, k), a in zip(jobs, answers)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    print(f"saved {len(rows)} answers to {args.out}")


if __name__ == "__main__":
    main()
