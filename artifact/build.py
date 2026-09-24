"""Assemble the Sploosh artifact: inline the current synth and every history snapshot into the page."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = "makeStep, makeWalk, render, PRESETS, DEFAULTS, SR"


def wrap(src: str, name: str) -> str:
    body = re.sub(r"^export\s+", "", src, flags=re.M)
    return f"const {name} = (() => {{\n{body}\nreturn {{ {EXPORTS} }};\n}})();\n"


def main():
    versions = json.loads((ROOT / "artifact/versions.json").read_text())
    parts = [wrap((ROOT / "synth/synth.js").read_text(), "SYNTH")]
    for v in versions:
        parts.append(wrap((ROOT / "history" / v["id"] / "synth.js").read_text(), f"SYNTH_{v['id'].upper()}"))
    registry = ", ".join(f"{v['id']}: SYNTH_{v['id'].upper()}" for v in versions)
    parts.append(f"const SYNTH_VERSIONS = {{ {registry} }};\n")
    page = (ROOT / "artifact/page.src.html").read_text()
    assert "/*%%SYNTHS%%*/" in page and "/*%%VERSIONS%%*/" in page
    page = page.replace("/*%%SYNTHS%%*/", "\n".join(parts)).replace("/*%%VERSIONS%%*/", json.dumps(versions))
    out = ROOT / "artifact/sploosh.html"
    out.write_text(page)
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, {len(versions)} history versions)")


if __name__ == "__main__":
    main()
