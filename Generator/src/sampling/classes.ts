// Value classes (requirements §8.2, §8.4, §8.5; project spec section 6.3).
// Float boundary constants are written twice, as a decimal literal and as their IEEE-754 bit
// pattern; a unit test checks that the two agree, so a typo cannot silently move a boundary.

import { fromBits, isNegZero } from '../numeric/f64.js';
import { int, type F64, type Int32 } from '../numeric/value.js';

export interface FloatSample {
  readonly value: F64;
  readonly classes: readonly string[];
  /** NaN, ±Infinity and -0 are built in the graph with math/NaN, math/Inf and math/neg (§8.2). */
  readonly graphProduced: boolean;
}

export interface IntSample {
  readonly value: Int32;
  readonly classes: readonly string[];
}

/** A float constant with its expected bit pattern (16 hex digits). */
export interface CheckedConstant {
  readonly decimal: string;
  readonly bits: string;
}

const graphProduced = (x: F64): boolean => Number.isNaN(x) || !Number.isFinite(x) || isNegZero(x);

const both = (xs: readonly F64[]): F64[] => xs.flatMap((x) => [x, -x]);

/** Boundary constants whose decimal spelling is checked against their bit pattern in tests. */
export const CHECKED: Readonly<Record<string, CheckedConstant>> = {
  smallestSubnormal: { decimal: '4.9406564584124654e-324', bits: '0000000000000001' },
  largestSubnormal: { decimal: '2.2250738585072009e-308', bits: '000fffffffffffff' },
  minNormal: { decimal: '2.2250738585072014e-308', bits: '0010000000000000' },
  max: { decimal: '1.7976931348623157e308', bits: '7fefffffffffffff' },
  belowHalf: { decimal: '0.49999999999999994', bits: '3fdfffffffffffff' },
};

const c = (name: keyof typeof CHECKED): F64 => fromBits(BigInt(`0x${CHECKED[name]?.bits ?? ''}`));

/** Float value classes from requirements §8.2 (without `scatter`, which the PRNG supplies). */
export const FLOAT_CLASSES: Readonly<Record<string, readonly F64[]>> = {
  zero: [0, -0],
  subnormal: both([c('smallestSubnormal'), c('largestSubnormal')]),
  minNormal: both([c('minNormal')]),
  unit: both([0.5, 1, 2]),
  halfway: both([c('belowHalf'), 1.5, 2.5, 0.5]),
  intBoundary: both([
    2 ** 24 - 1,
    2 ** 24,
    2 ** 24 + 1,
    2 ** 31 - 1,
    2 ** 31,
    2 ** 31 + 1,
    2 ** 32,
    2 ** 53 - 1,
    2 ** 53,
    2 ** 53 + 2,
  ]),
  decade: both([-300, -100, -30, -10, -3, 3, 10, 30, 100, 300].map((k) => Number(`1e${k}`))),
  max: both([c('max')]),
  infinity: [Infinity, -Infinity],
  nan: [NaN],
};

/** Integer value classes from requirements §8.4 (without `scatter`). */
export const INT_CLASSES: Readonly<Record<string, readonly number[]>> = {
  zero: [0],
  unit: [1, -1, 2, -2],
  byte: [127, 128, 255, 256, -128, -129],
  halfWord: [32767, 32768, 65535, 65536, -32768, -32769],
  float32Exact: [16777215, 16777216, 16777217, -16777216, -16777217],
  high: [1073741823, 1073741824, -1073741824],
  limit: [2147483646, 2147483647, -2147483647, -2147483648],
};

/** Shift counts every shift operation must use (requirements §8.4). */
export const SHIFT_COUNTS: readonly Int32[] = [
  0, 1, 15, 16, 30, 31, 32, 33, 63, -1, -2147483648, 2147483647,
].map((x) => int(x));

/** Floats around the int32 range, for float-to-int conversions and int-valued inputs (§8.5). */
export const OUT_OF_INT32_FLOATS: readonly F64[] = [
  2 ** 31,
  -(2 ** 31),
  2 ** 31 - 1,
  -(2 ** 31) - 1,
  2 ** 32,
  -(2 ** 32),
  2 ** 53,
  -(2 ** 53),
  0.5,
  -0.5,
  1.5,
  1e300,
];

/** Minimum number of scatter values per operation (requirements §8.4: at least four for int32). */
export const MIN_INT_SCATTER = 4;

const keyOf = (x: F64): string => (Number.isNaN(x) ? 'NaN' : isNegZero(x) ? '-0' : String(x));

/** Every float class value once, with all the classes it belongs to, in class order. */
export function floatSamples(classes: readonly string[] = Object.keys(FLOAT_CLASSES)): FloatSample[] {
  const byKey = new Map<string, { value: F64; classes: string[] }>();
  for (const name of classes) {
    const values = FLOAT_CLASSES[name];
    if (values === undefined) throw new Error(`unknown float class ${name}`);
    for (const value of values) {
      const k = keyOf(value);
      const entry = byKey.get(k) ?? { value, classes: [] };
      if (!entry.classes.includes(name)) entry.classes.push(name);
      byKey.set(k, entry);
    }
  }
  return [...byKey.values()].map((e) => ({ ...e, graphProduced: graphProduced(e.value) }));
}

/** Every int class value once, with all the classes it belongs to, in class order. */
export function intSamples(classes: readonly string[] = Object.keys(INT_CLASSES)): IntSample[] {
  const byValue = new Map<number, { value: Int32; classes: string[] }>();
  for (const name of classes) {
    const values = INT_CLASSES[name];
    if (values === undefined) throw new Error(`unknown int class ${name}`);
    for (const v of values) {
      const entry = byValue.get(v) ?? { value: int(v), classes: [] };
      if (!entry.classes.includes(name)) entry.classes.push(name);
      byValue.set(v, entry);
    }
  }
  return [...byValue.values()];
}
