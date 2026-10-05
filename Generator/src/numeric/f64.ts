// binary64 operations as the Specification defines them
// (Specification.adoc @ c5d1e1e8, "Float Arithmetic Operations", lines 476-814).
// JavaScript arithmetic is correctly rounded binary64, so + - * / and the
// Math functions used here are exact implementations of the definitions.

import type { F64 } from './value.js';

/** True for -0 only. */
export const isNegZero = (x: F64): boolean => x === 0 && 1 / x < 0;

/** `math/abs` (line 486): -a for a < 0, +0 for ±0, a otherwise. */
export const abs = (a: F64): F64 => Math.abs(a);

/** `math/sign` (line 503): -1, +1, or a itself for ±0 and NaN. */
export const sign = (a: F64): F64 => (a < 0 ? -1 : a > 0 ? 1 : a);

/** `math/trunc` (line 520); infinities are returned unchanged. */
export const trunc = (a: F64): F64 => Math.trunc(a);

/** `math/floor` (line 535). */
export const floor = (a: F64): F64 => Math.floor(a);

/** `math/ceil` (line 550). */
export const ceil = (a: F64): F64 => Math.ceil(a);

/**
 * `math/round` (line 568): half-way cases round away from zero, and negative values greater
 * than -0.5 round to -0. `a - t` is exact, so 0.49999999999999994 rounds to 0.
 */
export const round = (a: F64): F64 => {
  if (!Number.isFinite(a)) {
    return a;
  }
  const t = Math.trunc(a);
  const r = Math.abs(a - t) >= 0.5 ? t + Math.sign(a) : t;
  return r === 0 && (a < 0 || isNegZero(a)) ? -0 : r;
};

/** `math/fract` (line 592): a - floor(a). */
export const fract = (a: F64): F64 => a - Math.floor(a);

/** `math/neg` (line 605). */
export const neg = (a: F64): F64 => -a;

export const add = (a: F64, b: F64): F64 => a + b;
export const sub = (a: F64, b: F64): F64 => a - b;
export const mul = (a: F64, b: F64): F64 => a * b;
export const div = (a: F64, b: F64): F64 => a / b;

/**
 * `math/rem` (line 688): NaN if a is infinite or b is ±0; a if b is infinite; otherwise
 * a - b * trunc(a / b) evaluated exactly. JavaScript `%` computes exactly this.
 */
export const rem = (a: F64, b: F64): F64 => a % b;

/** `math/min` (line 720): -0 is less than +0; NaN propagates. */
export const min = (a: F64, b: F64): F64 => Math.min(a, b);

/** `math/max` (line 747): -0 is less than +0; NaN propagates. */
export const max = (a: F64, b: F64): F64 => Math.max(a, b);

/** `math/clamp` (line 773): min(max(a, min(b, c)), max(b, c)). */
export const clamp = (a: F64, b: F64, c: F64): F64 => min(max(a, min(b, c)), max(b, c));

/** `math/saturate` (line 794): min(max(a, 0), 1). */
export const saturate = (a: F64): F64 => min(max(a, 0), 1);

/** `math/mix` (line 813): (1 - c) * a + c * b. */
export const mix = (a: F64, b: F64, c: F64): F64 => (1 - c) * a + c * b;

const view = new DataView(new ArrayBuffer(8));

/** The IEEE-754 bit pattern of x as an unsigned 64-bit integer. */
export const toBits = (x: F64): bigint => {
  view.setFloat64(0, x);
  return view.getBigUint64(0);
};

/** The binary64 value with the given bit pattern. */
export const fromBits = (bits: bigint): F64 => {
  view.setBigUint64(0, BigInt.asUintN(64, bits));
  return view.getFloat64(0);
};

/** True when x and y have the same bit pattern (distinguishes ±0; NaN equals NaN with equal payload). */
export const sameBits = (x: F64, y: F64): boolean => toBits(x) === toBits(y);

const SIGN_BIT = 0x8000000000000000n;

/** The smallest binary64 value greater than x. */
export const nextUp = (x: F64): F64 => {
  if (Number.isNaN(x) || x === Infinity) {
    return x;
  }
  if (x === 0) {
    return Number.MIN_VALUE;
  }
  const bits = toBits(x);
  return fromBits((bits & SIGN_BIT) === 0n ? bits + 1n : bits - 1n);
};

/** The largest binary64 value less than x. */
export const nextDown = (x: F64): F64 => -nextUp(-x);
