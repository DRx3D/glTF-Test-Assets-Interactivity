"""Writes test/fixtures/splitmix64.json from an independent SplitMix64 implementation.

Run once (python tools/make-splitmix64-fixture.py) and commit the output. The TypeScript
implementation must reproduce these values (project spec section 6.1). Python's unbounded
integers keep this implementation independent of JavaScript BigInt semantics.
"""
import json
import pathlib

MASK = (1 << 64) - 1


def splitmix64(seed, count):
    state = seed & MASK
    out = []
    for _ in range(count):
        state = (state + 0x9E3779B97F4A7C15) & MASK
        z = state
        z = ((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9) & MASK
        z = ((z ^ (z >> 27)) * 0x94D049BB133111EB) & MASK
        out.append(z ^ (z >> 31))
    return out


SEEDS = {"0": 0, "default": 0x4B48525F494E5445}
fixture = {
    "source": "tools/make-splitmix64-fixture.py (independent Python implementation)",
    "outputs": {name: [f"0x{v:016x}" for v in splitmix64(seed, 16)] for name, seed in SEEDS.items()},
}
path = pathlib.Path(__file__).resolve().parent.parent / "test" / "fixtures" / "splitmix64.json"
path.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8", newline="\n")
print(fixture["outputs"]["0"][0], fixture["outputs"]["default"][0])
