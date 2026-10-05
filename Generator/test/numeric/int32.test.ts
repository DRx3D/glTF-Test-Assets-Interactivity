import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as I from '../../src/numeric/int32.js';
import { int, isInt32, INT32_MAX, INT32_MIN, type Int32 } from '../../src/numeric/value.js';

// Independent model: exact integer arithmetic in BigInt, wrapped to 32 bits.
const w = (x: bigint): number => Number(BigInt.asIntN(32, x));
const big = (x: number): bigint => BigInt(x);
const truncDiv = (a: bigint, b: bigint): bigint => a / b; // BigInt division truncates toward zero

const i32 = fc.integer({ min: INT32_MIN, max: INT32_MAX }).map((x) => int(x));
const boundary = fc.constantFrom(
  ...[0, 1, -1, 2, -2, 7, -7, 46341, 2147483646, 2147483647, -2147483647, -2147483648].map((x) => int(x)),
);
const anyI32 = fc.oneof(i32, boundary);

describe('int()', () => {
  it('accepts int32 values and normalises -0', () => {
    expect(int(-2147483648)).toBe(-2147483648);
    expect(Object.is(int(-0), 0)).toBe(true);
  });
  it.each([2147483648, -2147483649, 1.5, NaN, Infinity])('rejects %s', (x) => {
    expect(() => int(x)).toThrow(RangeError);
    expect(isInt32(x)).toBe(false);
  });
});

describe('Specification examples', () => {
  const M = INT32_MIN;
  it('neg and abs of INT_MIN (lines 2472, 2510)', () => {
    expect(I.neg(M)).toBe(M);
    expect(I.abs(M)).toBe(M);
    expect(I.abs(int(-5))).toBe(5);
    expect(I.abs(int(5))).toBe(5);
  });
  it('wrapping add, sub, mul (lines 2538, 2567, 2596-2598)', () => {
    expect(I.add(INT32_MAX, int(1))).toBe(M);
    expect(I.sub(M, int(1))).toBe(INT32_MAX);
    expect(I.mul(INT32_MAX, INT32_MAX)).toBe(1);
    expect(I.mul(M, int(-1))).toBe(M);
    expect(I.mul(int(46341), int(46341))).toBe(-2147479015);
  });
  it('division truncates toward zero; divisor 0 gives 0; INT_MIN / -1 wraps (lines 2620-2631)', () => {
    expect(I.div(int(-7), int(2))).toBe(-3);
    expect(I.div(int(7), int(-2))).toBe(-3);
    expect(I.div(int(10), int(0))).toBe(0);
    expect(I.div(M, int(-1))).toBe(M);
  });
  it('remainder; divisor 0 gives 0; never -0 (line 2653)', () => {
    expect(I.rem(int(-7), int(2))).toBe(-1);
    expect(I.rem(int(7), int(-2))).toBe(1);
    expect(I.rem(int(5), int(0))).toBe(0);
    expect(Object.is(I.rem(M, int(-1)), 0)).toBe(true);
    expect(Object.is(I.rem(int(-4), int(2)), 0)).toBe(true);
  });
  it('sign, min, max, clamp including b > c (line 2703)', () => {
    expect([I.sign(int(-9)), I.sign(int(0)), I.sign(int(9))]).toEqual([-1, 0, 1]);
    expect(I.min(int(3), int(-3))).toBe(-3);
    expect(I.max(int(3), int(-3))).toBe(3);
    expect(I.clamp(int(9), int(2), int(3))).toBe(3);
    expect(I.clamp(int(9), int(3), int(2))).toBe(3);
    expect(I.clamp(int(5), int(5), int(5))).toBe(5);
  });
  it('shifts use only the low 5 bits of the count (lines 2841, 2855)', () => {
    expect(I.asr(int(-8), int(1))).toBe(-4);
    expect(I.asr(M, int(31))).toBe(-1);
    expect(I.asr(int(-8), int(32))).toBe(-8); // 32 & 31 = 0
    expect(I.asr(int(-8), int(33))).toBe(-4); // 33 & 31 = 1
    expect(I.asr(int(8), int(-1))).toBe(0); // -1 & 31 = 31
    expect(I.lsl(int(1), int(31))).toBe(M);
    expect(I.lsl(int(1), int(32))).toBe(1);
    expect(I.lsl(int(3), int(-1))).toBe(M); // 3 << 31 truncated
  });
  it('clz, ctz, popcnt edge cases (lines 2868, 2891, 2914)', () => {
    expect([I.clz(int(0)), I.clz(int(-1)), I.clz(int(1))]).toEqual([32, 0, 31]);
    expect([I.ctz(int(0)), I.ctz(M), I.ctz(int(8))]).toEqual([32, 31, 3]);
    expect([I.popcnt(int(0)), I.popcnt(int(-1)), I.popcnt(M), I.popcnt(int(7))]).toEqual([0, 32, 1, 3]);
  });
  it('bitwise and comparisons', () => {
    expect(I.not(int(0))).toBe(-1);
    expect(I.and(int(12), int(10))).toBe(8);
    expect(I.or(int(12), int(10))).toBe(14);
    expect(I.xor(int(12), int(10))).toBe(6);
    expect([I.eq(int(1), int(1)), I.lt(int(1), int(2)), I.le(int(2), int(2))]).toEqual([true, true, true]);
    expect([I.gt(int(1), int(2)), I.ge(int(1), int(2))]).toEqual([false, false]);
  });
});

describe('agrees with an exact BigInt model', () => {
  const runs = { numRuns: 10_000 };
  const pair = fc.tuple(anyI32, anyI32);

  it('add, sub, mul', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        expect(I.add(a, b)).toBe(w(big(a) + big(b)));
        expect(I.sub(a, b)).toBe(w(big(a) - big(b)));
        expect(I.mul(a, b)).toBe(w(big(a) * big(b)));
      }),
      runs,
    );
  });

  it('div and rem', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        const q = b === 0 ? 0 : w(truncDiv(big(a), big(b)));
        const r = b === 0 ? 0 : w(big(a) - big(b) * truncDiv(big(a), big(b)));
        expect(I.div(a, b)).toBe(q);
        expect(Object.is(I.rem(a, b), r === 0 ? 0 : r)).toBe(true);
      }),
      runs,
    );
  });

  it('neg, abs, shifts, popcnt', () => {
    fc.assert(
      fc.property(pair, ([a, b]) => {
        const n = big(b) & 31n;
        expect(I.neg(a)).toBe(w(-big(a)));
        expect(I.abs(a)).toBe(a < 0 ? w(-big(a)) : a);
        expect(I.asr(a, b)).toBe(w(big(a) >> n));
        expect(I.lsl(a, b)).toBe(w(big(a) << n));
        expect(I.popcnt(a)).toBe([...BigInt.asUintN(32, big(a)).toString(2)].filter((c) => c === '1').length);
      }),
      runs,
    );
  });

  it('results are always valid int32 without -0', () => {
    const ops2 = [I.add, I.sub, I.mul, I.div, I.rem, I.min, I.max, I.and, I.or, I.xor, I.asr, I.lsl];
    fc.assert(
      fc.property(pair, ([a, b]) => {
        for (const op of ops2) {
          const r: Int32 = op(a, b);
          expect(isInt32(r) && !Object.is(r, -0)).toBe(true);
        }
      }),
      runs,
    );
  });
});
