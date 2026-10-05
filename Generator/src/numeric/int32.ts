// int32 operations exactly as the Specification defines them
// (Specification.adoc @ c5d1e1e8, "Integer Arithmetic/Bitwise Operations", lines 2456-2914).
// Every function takes and returns Int32; results never contain -0.

import { int, type Int32 } from './value.js';

const wrap = (x: number): Int32 => (x | 0) as Int32;

/** `math/neg` (line 2510): negating -2147483648 returns -2147483648. */
export const neg = (a: Int32): Int32 => wrap(-a);

/** `math/abs` (line 2472): defined via negation, so abs(-2147483648) is -2147483648. */
export const abs = (a: Int32): Int32 => (a < 0 ? neg(a) : a);

/** `math/sign`. */
export const sign = (a: Int32): Int32 => int(a < 0 ? -1 : a > 0 ? 1 : 0);

/** `math/add` (line 2534): overflow wraps. */
export const add = (a: Int32, b: Int32): Int32 => wrap(a + b);

/** `math/sub` (line 2563): overflow wraps. */
export const sub = (a: Int32, b: Int32): Int32 => wrap(a - b);

/** `math/mul` (line 2592): overflow wraps. `a * b` would lose low bits above 2^53. */
export const mul = (a: Int32, b: Int32): Int32 => wrap(Math.imul(a, b));

/**
 * `math/div` (lines 2620-2631): 0 when b = 0; otherwise truncated toward zero, and
 * -2147483648 / -1 wraps to -2147483648. The binary64 quotient cannot round across an
 * integer boundary, because its rounding error is smaller than 1/|b|.
 */
export const div = (a: Int32, b: Int32): Int32 => (b === 0 ? int(0) : wrap(Math.trunc(a / b)));

/** `math/rem` (line 2653): 0 when b = 0; otherwise a - b * trunc(a / b). `| 0` turns JS's -0 into 0. */
export const rem = (a: Int32, b: Int32): Int32 => (b === 0 ? int(0) : wrap(a % b));

/** `math/min`. */
export const min = (a: Int32, b: Int32): Int32 => (a < b ? a : b);

/** `math/max`. */
export const max = (a: Int32, b: Int32): Int32 => (a > b ? a : b);

/** `math/clamp` (line 2703): min(max(a, min(b, c)), max(b, c)); handles b > c. */
export const clamp = (a: Int32, b: Int32, c: Int32): Int32 => min(max(a, min(b, c)), max(b, c));

/** Bitwise `math/not`. */
export const not = (a: Int32): Int32 => wrap(~a);

/** Bitwise `math/and`. */
export const and = (a: Int32, b: Int32): Int32 => wrap(a & b);

/** Bitwise `math/or`. */
export const or = (a: Int32, b: Int32): Int32 => wrap(a | b);

/** Bitwise `math/xor`. */
export const xor = (a: Int32, b: Int32): Int32 => wrap(a ^ b);

/**
 * `math/asr` (line 2841): only the lowest 5 bits of b are used, and the sign bit propagates.
 * JavaScript's `>>` has exactly these semantics.
 */
export const asr = (a: Int32, b: Int32): Int32 => wrap(a >> b);

/** `math/lsl` (line 2855): only the lowest 5 bits of b are used; the result is truncated to 32 bits. */
export const lsl = (a: Int32, b: Int32): Int32 => wrap(a << b);

/** `math/clz` (line 2868): 32 for 0, 0 for negative values. */
export const clz = (a: Int32): Int32 => int(Math.clz32(a));

/** `math/ctz` (line 2891): 32 for 0. */
export const ctz = (a: Int32): Int32 => int(a === 0 ? 32 : 31 - Math.clz32(a & -a));

/** `math/popcnt` (line 2914): 0 for 0, 32 for -1. */
export const popcnt = (a: Int32): Int32 => {
  let v = a >>> 0;
  let count = 0;
  while (v !== 0) {
    v &= v - 1;
    count++;
  }
  return int(count);
};

/** Integer comparisons (lines 2718-2776). */
export const eq = (a: Int32, b: Int32): boolean => a === b;
export const lt = (a: Int32, b: Int32): boolean => a < b;
export const le = (a: Int32, b: Int32): boolean => a <= b;
export const gt = (a: Int32, b: Int32): boolean => a > b;
export const ge = (a: Int32, b: Int32): boolean => a >= b;
