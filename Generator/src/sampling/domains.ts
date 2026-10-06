// Domain-specific values (requirements §8.3; project spec section 6.3). Thresholds are found
// with the reference library rather than typed, so each is the exact binary64 boundary.
//
// Not here: the `pow` cases, which come from the special-case rows of the Specification's
// definition table and are added with the math generators in milestone M4.

import { nextDown, nextUp } from '../numeric/f64.js';
import type { F64 } from '../numeric/value.js';
import type { GmpReference, UnaryFunction } from '../reference/reference.js';
import { FLOAT_CLASSES } from './classes.js';

/**
 * The largest x in [lo, hi] for which `pred(x)` holds, where pred is true at lo, false at hi,
 * and monotone in between. Bisects until the bracket is two adjacent doubles, so the answer
 * is exact.
 */
function lastTrue(pred: (x: F64) => boolean, lo: F64, hi: F64): F64 {
  if (!pred(lo) || pred(hi)) throw new Error('threshold search needs pred(lo) true and pred(hi) false');
  let a = lo;
  let b = hi;
  for (let i = 0; i < 2100 && nextUp(a) !== b; i++) {
    const mid = (a + b) / 2;
    const m = mid === a || mid === b ? nextUp(a) : mid;
    if (pred(m)) a = m;
    else b = m;
  }
  return a;
}

/** Both sides of a threshold: the last value where pred holds and the next double. */
const bothSides = (pred: (x: F64) => boolean, lo: F64, hi: F64): F64[] => {
  const t = lastTrue(pred, lo, hi);
  return [t, nextUp(t)];
};

export type DomainTable = Readonly<Record<string, readonly F64[]>>;

/** Builds the §8.3 table. Deterministic: every value is an exact function of the reference library. */
export function domainValues(ref: GmpReference): DomainTable {
  const f =
    (fn: UnaryFunction) =>
    (x: F64): F64 =>
      ref.reference(fn, [x]);
  const finite =
    (fn: UnaryFunction) =>
    (x: F64): boolean =>
      Number.isFinite(f(fn)(x));
  const positive =
    (fn: UnaryFunction) =>
    (x: F64): boolean =>
      f(fn)(x) > 0;

  // exp overflows just above ln(MAX) ≈ 709.78 and underflows to zero just below ≈ -745.13.
  const expOverflow = bothSides(finite('exp'), 709, 710);
  const expUnderflow = bothSides((x) => !positive('exp')(x), -746, -745).reverse();
  // sinh and cosh overflow at about ±710.4759.
  const sinhOverflow = bothSides(finite('sinh'), 710, 711);
  const coshOverflow = bothSides(finite('cosh'), 710, 711);

  // Multiples of π/2 up to 2^20 π, each the double nearest the exact multiple, plus 1e22.
  const piMultiples = [0.5, 1, 1.5, 2, 2.5, 3, 4, 2 ** 10, 2 ** 20].map((k) => ref.piTimes(k));
  const trig = [...piMultiples, ...piMultiples.map((x) => -x), 1e22];

  const zerosAndInfinities = [0, -0, Infinity, -Infinity];
  const atan2Pairs = [...zerosAndInfinities, 1, -1];

  const roundingNeighbours = [...(FLOAT_CLASSES.halfway ?? []), ...(FLOAT_CLASSES.intBoundary ?? [])].flatMap(
    (v) => [nextDown(v), nextUp(v)],
  );

  return {
    asin: [1, -1, nextUp(1), nextDown(-1)],
    acos: [1, -1, nextUp(1), nextDown(-1)],
    atanh: [1, -1, nextUp(1), nextDown(-1)],
    acosh: [1, nextDown(1)],
    log: [1, Number.MIN_VALUE, -1, -Number.MIN_VALUE],
    log2: [1, Number.MIN_VALUE, -1, -Number.MIN_VALUE],
    log10: [1, Number.MIN_VALUE, -1, -Number.MIN_VALUE],
    sqrt: [-0, -Number.MIN_VALUE],
    cbrt: [-0, -Number.MIN_VALUE],
    exp: [...expOverflow, ...expUnderflow],
    sinh: [...sinhOverflow, ...sinhOverflow.map((x) => -x)],
    cosh: [...coshOverflow, ...coshOverflow.map((x) => -x)],
    sin: trig,
    cos: trig,
    tan: trig,
    // Every combination of ±0 and ±Infinity with each other and with ±1, flattened as (y, x) pairs.
    atan2: atan2Pairs.flatMap((y) =>
      atan2Pairs.flatMap((x) =>
        zerosAndInfinities.includes(x) || zerosAndInfinities.includes(y) ? [y, x] : [],
      ),
    ),
    round: roundingNeighbours,
    trunc: roundingNeighbours,
    floor: roundingNeighbours,
    ceil: roundingNeighbours,
    fract: roundingNeighbours,
    // deg(x) = x·180/π overflows for x above about 3.137e306.
    deg: [3e306, 4e306, 1e307, Number.MAX_VALUE],
  };
}
