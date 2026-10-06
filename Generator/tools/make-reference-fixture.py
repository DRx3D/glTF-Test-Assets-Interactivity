"""Writes test/fixtures/reference.json: an independent golden table for the reference library.

    .venv/Scripts/python tools/make-reference-fixture.py     (Windows)
    .venv/bin/python tools/make-reference-fixture.py         (Linux, macOS)

Requires mpmath (pip install mpmath in Generator/.venv). Every entry is computed with mpmath
at 300 bits and rounded once to the nearest binary64 through exact rational arithmetic
(Python's int/int division is correctly rounded, subnormals included). An entry is kept only
if a 600-bit recomputation rounds to the same double, so no entry sits on a rounding boundary.
The TypeScript reference backend must reproduce every entry bit for bit (project spec 7.5).
"""
import json
import math
import pathlib
import random
import struct
from fractions import Fraction

import mpmath
from mpmath import mp

SEED = 20261006
PER_FUNCTION_RANDOM = 12


def to_hex(x):
    return struct.pack(">d", x).hex()


def exact_round(v):
    """Nearest binary64 to an mpmath value, or None for zero, infinite or non-finite results."""
    if not mpmath.isfinite(v) or v == 0:
        return None
    # man_exp gives an unsigned mantissa; the sign is carried separately.
    man, exp = v.man_exp
    q = Fraction(int(mpmath.sign(v)) * abs(man)) * (Fraction(2) ** exp)
    try:
        d = q.numerator / q.denominator
    except OverflowError:
        return None
    return None if d == 0 or math.isinf(d) else d


def cbrt(x):
    return mpmath.sign(x) * mp.cbrt(abs(x))


def pow_real(x, y):
    if x < 0:
        if y != mpmath.floor(y):
            raise ValueError("negative base needs an integer exponent")
        r = mp.power(-x, y)
        return -r if int(y) % 2 else r
    return mp.power(x, y)


FUNCTIONS = {
    "exp": (lambda a: mp.exp(a), 1),
    "exp2": (lambda a: mp.power(2, a), 1),
    "log": (lambda a: mp.log(a), 1),
    "log2": (lambda a: mp.log(a, 2), 1),
    "log10": (lambda a: mp.log10(a), 1),
    "sqrt": (lambda a: mp.sqrt(a), 1),
    "cbrt": (cbrt, 1),
    "sin": (lambda a: mp.sin(a), 1),
    "cos": (lambda a: mp.cos(a), 1),
    "tan": (lambda a: mp.tan(a), 1),
    "asin": (lambda a: mp.asin(a), 1),
    "acos": (lambda a: mp.acos(a), 1),
    "atan": (lambda a: mp.atan(a), 1),
    "sinh": (lambda a: mp.sinh(a), 1),
    "cosh": (lambda a: mp.cosh(a), 1),
    "tanh": (lambda a: mp.tanh(a), 1),
    "asinh": (lambda a: mp.asinh(a), 1),
    "acosh": (lambda a: mp.acosh(a), 1),
    "atanh": (lambda a: mp.atanh(a), 1),
    "pow": (pow_real, 2),
    "atan2": (lambda y, x: mp.atan2(y, x), 2),
    "hypot": (lambda a, b: mp.hypot(a, b), 2),
}

FIXED = {
    "exp": [0.5, 1.0, -1.0, 2.0, 10.0, -10.0, 100.0, 700.0, -700.0, 709.7, 1e-10, -745.0],
    "exp2": [0.5, -0.5, 10.25, 1023.5, -1074.0, -1050.3, 1e-8],
    "log": [0.5, 2.0, 10.0, 1e-300, 1e300, 5e-324, 1.0000000000000002, 0.9999999999999999],
    "log2": [3.0, 10.0, 1e-300, 5e-324, 1e308, 0.1],
    "log10": [2.0, 3.0, 1e-300, 5e-324, 1e308, 0.5],
    "sqrt": [2.0, 3.0, 0.5, 1e-300, 5e-324, 1e308, 1.7976931348623157e308],
    "cbrt": [2.0, -2.0, 3.0, 1e-300, -5e-324, 9769.23, -27.5],
    "sin": [0.5, 1.0, 2.0, 3.0, 4.32, 1e-10, 100.0, 1e6, 1e22, 1.5707963267948966, 3.141592653589793],
    "cos": [0.5, 1.0, 2.0, 4.32, 100.0, 1e6, 1e22, 1.5707963267948966, 3.141592653589793],
    "tan": [0.5, 1.0, 4.32, 1e-10, 100.0, 1e22, 1.5707963267948966],
    "asin": [0.5, -0.5, 0.9999999999999999, 1e-10, 0.1],
    "acos": [0.5, -0.5, 0.9999999999999999, -0.9999999999999999, 0.1, 1e-10],
    "atan": [0.5, 1.0, -1.0, 1e10, -1e10, 1e300, 1e-10],
    "sinh": [0.5, 1.0, 4.32, -4.32, 1e-10, 700.0, -710.0],
    "cosh": [0.5, 1.0, 4.32, -4.32, 700.0, 710.0],
    "tanh": [0.5, 1.0, 4.32, -4.32, 1e-10, 20.0],
    "asinh": [0.5, -0.5, 1e10, 1e300, 1e-10],
    "acosh": [1.5, 2.0, 1.0000000000000002, 1e10, 1e300],
    "atanh": [0.5, -0.5, 0.9999999999999999, 1e-10, 0.1],
    "pow": [(2.0, 0.5), (10.0, -3.0), (-2.0, 3.0), (-2.0, -3.0), (1.0000000000000002, 1e15), (0.5, 1074.0), (7.0, 1.0 / 3.0)],
    "atan2": [(1.0, 1.0), (1.0, -1.0), (-1.0, -1.0), (-1.0, 1.0), (1e-300, -1.0), (3.0, 4.0), (-5e-324, 2.0)],
    "hypot": [(3.0, 4.0), (1e300, 1e300), (5e-324, 5e-324), (1.0, 1e-10), (-2.0, 3.0)],
}


def random_inputs(name, rng):
    def mag(lo, hi):
        return 10 ** rng.uniform(lo, hi)

    def sym(lo, hi):
        return rng.choice((-1.0, 1.0)) * mag(lo, hi)

    gen = {
        "exp": lambda: rng.uniform(-740, 709),
        "exp2": lambda: rng.uniform(-1070, 1023),
        "log": lambda: mag(-307, 308),
        "log2": lambda: mag(-307, 308),
        "log10": lambda: mag(-307, 308),
        "sqrt": lambda: mag(-307, 308),
        "cbrt": lambda: sym(-307, 308),
        "sin": lambda: sym(-5, 8),
        "cos": lambda: sym(-5, 8),
        "tan": lambda: sym(-5, 8),
        "asin": lambda: rng.uniform(-1, 1),
        "acos": lambda: rng.uniform(-1, 1),
        "atan": lambda: sym(-10, 10),
        "sinh": lambda: rng.uniform(-710, 710),
        "cosh": lambda: rng.uniform(-710, 710),
        "tanh": lambda: rng.uniform(-20, 20),
        "asinh": lambda: sym(-10, 300),
        "acosh": lambda: 1 + mag(-15, 300),
        "atanh": lambda: rng.uniform(-1, 1),
        "pow": lambda: (mag(-5, 5), rng.uniform(-50, 50)),
        "atan2": lambda: (sym(-10, 10), sym(-10, 10)),
        "hypot": lambda: (sym(-150, 150), sym(-150, 150)),
    }[name]
    return [gen() for _ in range(PER_FUNCTION_RANDOM)]


def evaluate(fn, args, prec):
    mp.prec = prec
    return exact_round(fn(*[mpmath.mpf(a) for a in args]))


def main():
    rng = random.Random(SEED)
    entries = []
    skipped = 0
    for name, (fn, arity) in FUNCTIONS.items():
        for raw in FIXED[name] + random_inputs(name, rng):
            args = list(raw) if arity == 2 else [raw]
            if any(math.isinf(a) or math.isnan(a) for a in args):
                continue
            try:
                d300 = evaluate(fn, args, 300)
                d600 = evaluate(fn, args, 600)
            except (ValueError, ZeroDivisionError):
                skipped += 1
                continue
            if d300 is None or d300 != d600:
                skipped += 1
                continue
            entries.append({"fn": name, "args": [to_hex(a) for a in args], "expected": to_hex(d300)})
    fixture = {
        "source": "tools/make-reference-fixture.py (mpmath %s, 300 bits, verified at 600 bits)" % mpmath.__version__,
        "entries": entries,
    }
    path = pathlib.Path(__file__).resolve().parent.parent / "test" / "fixtures" / "reference.json"
    path.write_text(json.dumps(fixture, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("%d entries, %d skipped" % (len(entries), skipped))


if __name__ == "__main__":
    main()
