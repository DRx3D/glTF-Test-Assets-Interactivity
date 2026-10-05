import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as F from '../../src/numeric/f64.js';

const isNegZero = (x: number): boolean => Object.is(x, -0);
const isPosZero = (x: number): boolean => Object.is(x, 0);

describe('round (Specification line 568)', () => {
  it.each([
    [0.5, 1],
    [-0.5, -1],
    [1.5, 2],
    [2.5, 3],
    [-2.5, -3],
    [2.7, 3],
    [-3.4, -3],
    [0.49999999999999994, 0],
    [4503599627370497, 4503599627370497], // 2^52 + 1: already an integer
    [Infinity, Infinity],
    [-Infinity, -Infinity],
  ])('round(%s) = %s', (a, expected) => {
    expect(F.round(a)).toBe(expected);
  });
  it('values in (-0.5, 0) and -0 round to -0; positive values below 0.5 round to +0', () => {
    expect(isNegZero(F.round(-0.3))).toBe(true);
    expect(isNegZero(F.round(-0.49999999999999994))).toBe(true);
    expect(isNegZero(F.round(-0))).toBe(true);
    expect(isPosZero(F.round(0.3))).toBe(true);
    expect(isPosZero(F.round(0))).toBe(true);
  });
  it('NaN stays NaN', () => {
    expect(F.round(NaN)).toBeNaN();
  });
  it('matches the Specification tip a < 0 ? -round(-a) : round(a) for finite a', () => {
    // Reference built without Math.round: floor(x + 0.5) is exact for |x| < 2^52 when x + 0.5 is exact.
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (a) => {
        const half = (x: number): number => {
          const f = Math.floor(x);
          return x - f >= 0.5 ? f + 1 : f;
        };
        const expected = a < 0 ? -half(-a) : half(a);
        expect(F.sameBits(F.round(a), expected)).toBe(true);
      }),
      { numRuns: 10_000 },
    );
  });
});

describe('abs and sign treat zeros as the Specification says (lines 486, 503)', () => {
  it('abs(-0) is +0, abs(-3) is 3', () => {
    expect(isPosZero(F.abs(-0))).toBe(true);
    expect(F.abs(-3)).toBe(3);
  });
  it('sign returns ±0 and NaN unchanged', () => {
    expect([F.sign(-2), F.sign(2)]).toEqual([-1, 1]);
    expect(isNegZero(F.sign(-0))).toBe(true);
    expect(isPosZero(F.sign(0))).toBe(true);
    expect(F.sign(NaN)).toBeNaN();
  });
});

describe('rem (line 688)', () => {
  it.each([
    [Infinity, 1, NaN],
    [5, 0, NaN],
    [5, -0, NaN],
    [5, Infinity, 5],
    [-7, 3, -1],
    [19.42, 2.23, 19.42 % 2.23],
  ])('rem(%s, %s)', (a, b, expected) => {
    // Any NaN matches an expected NaN (requirements §7.3); other values must match bit for bit.
    const result = F.rem(a, b);
    expect(Number.isNaN(expected) ? Number.isNaN(result) : F.sameBits(result, expected)).toBe(true);
  });
});

describe('min, max, clamp, saturate (lines 720-797)', () => {
  it('-0 is less than +0', () => {
    expect(isNegZero(F.min(0, -0))).toBe(true);
    expect(isPosZero(F.max(-0, 0))).toBe(true);
  });
  it('NaN propagates', () => {
    expect(F.min(NaN, 1)).toBeNaN();
    expect(F.max(1, NaN)).toBeNaN();
    expect(F.clamp(NaN, 0, 1)).toBeNaN();
    expect(F.saturate(NaN)).toBeNaN();
  });
  it('clamp handles b > c', () => {
    expect(F.clamp(9, 3, 2)).toBe(3);
    expect(F.clamp(9, 2, 3)).toBe(3);
  });
  it('saturate', () => {
    expect([F.saturate(-1), F.saturate(0.25), F.saturate(2)]).toEqual([0, 0.25, 1]);
  });
});

describe('remaining operations', () => {
  it('trunc, floor, ceil, fract, neg, arithmetic, mix', () => {
    expect([F.trunc(-2.5), F.floor(-2.5), F.ceil(-2.5)]).toEqual([-2, -3, -2]);
    expect(isNegZero(F.trunc(-0.5))).toBe(true);
    expect(isNegZero(F.ceil(-0.5))).toBe(true);
    expect(F.fract(-1.25)).toBe(0.75);
    expect(F.fract(Infinity)).toBeNaN();
    expect(isNegZero(F.neg(0))).toBe(true);
    expect([F.add(0.1, 0.2), F.sub(1, 3), F.mul(2, 3), F.div(1, -0)]).toEqual([
      0.30000000000000004,
      -2,
      6,
      -Infinity,
    ]);
    expect(F.mix(2, 4, 0.25)).toBe(2.5);
  });
  it('double precision: (2^53 - 1) - (2^53 - 2) and 16777217 are exact', () => {
    expect(F.sub(9007199254740991, 9007199254740990)).toBe(1);
    expect(F.sub(16777217, 16777216)).toBe(1);
  });
});

describe('bits, nextUp, nextDown', () => {
  it('round-trips bit patterns', () => {
    fc.assert(
      fc.property(fc.double(), (x) => {
        expect(F.sameBits(F.fromBits(F.toBits(x)), x)).toBe(true);
      }),
    );
    expect(F.toBits(-0)).toBe(0x8000000000000000n);
    expect(F.sameBits(0, -0)).toBe(false);
  });
  it('steps to adjacent values', () => {
    expect(F.nextUp(1)).toBe(1 + Number.EPSILON);
    expect(F.nextDown(1)).toBe(1 - Number.EPSILON / 2);
    expect(F.nextUp(0)).toBe(Number.MIN_VALUE);
    expect(F.nextUp(-0)).toBe(Number.MIN_VALUE);
    expect(F.nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(F.nextUp(-Number.MIN_VALUE)).toBe(-0);
    expect(F.nextUp(Number.MAX_VALUE)).toBe(Infinity);
    expect(F.nextUp(Infinity)).toBe(Infinity);
    expect(F.nextUp(-Infinity)).toBe(-Number.MAX_VALUE);
    expect(F.nextUp(NaN)).toBeNaN();
  });
  it('nextUp(x) is the smallest value above x', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (x) => {
        const up = F.nextUp(x);
        expect(up > x || (x === 0 && up === Number.MIN_VALUE)).toBe(true);
        expect(F.nextDown(up) === x || (x === 0 && F.nextDown(up) === 0)).toBe(true);
      }),
    );
  });
  it('isNegZero', () => {
    expect([F.isNegZero(-0), F.isNegZero(0), F.isNegZero(-1)]).toEqual([true, false, false]);
  });
});
