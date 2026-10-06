import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { fromBits, sameBits, toBits } from '../../src/numeric/f64.js';
import { GmpReference, ReferenceError, type RefFunction } from '../../src/reference/reference.js';

interface Fixture {
  readonly source: string;
  readonly entries: readonly { fn: RefFunction; args: string[]; expected: string }[];
}
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/reference.json', import.meta.url), 'utf8'),
) as Fixture;
const hex = (h: string): number => fromBits(BigInt(`0x${h}`));
const bitsHex = (x: number): string => toBits(x).toString(16).padStart(16, '0');

let ref: GmpReference;
beforeAll(async () => {
  ref = await GmpReference.create();
});

describe('golden table from an independent mpmath implementation (project spec 7.5)', () => {
  it('has entries for every reference function', () => {
    expect(new Set(fixture.entries.map((e) => e.fn)).size).toBe(22);
    expect(fixture.entries.length).toBeGreaterThan(400);
  });

  it('is reproduced bit for bit', () => {
    const mismatches: string[] = [];
    for (const e of fixture.entries) {
      const args = e.args.map(hex);
      const got = ref.reference(e.fn, args);
      if (!sameBits(got, hex(e.expected))) {
        mismatches.push(`${e.fn}(${args.join(', ')}): got ${bitsHex(got)}, expected ${e.expected}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('reference', () => {
  it('is exact for exactly representable results', () => {
    expect(ref.reference('sqrt', [4])).toBe(2);
    expect(ref.reference('cbrt', [-27])).toBe(-3);
    expect(ref.reference('exp2', [-1074])).toBe(5e-324);
    expect(ref.reference('hypot', [3, 4])).toBe(5);
    expect(ref.reference('pow', [-2, 3])).toBe(-8);
  });

  it('covers every atan2 quadrant and the axes', () => {
    const pi = 3.141592653589793;
    expect(ref.reference('atan2', [1, 1])).toBe(pi / 4);
    expect(ref.reference('atan2', [1, 0])).toBe(pi / 2);
    expect(ref.reference('atan2', [-1, 0])).toBe(-pi / 2);
    expect(ref.reference('atan2', [1, -1])).toBe((3 * pi) / 4);
    expect(ref.reference('atan2', [-1, -1])).toBe((-3 * pi) / 4);
  });

  it('round-trips through exp and log within the error that rounding log(x) introduces', () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-300, max: 1e300, noNaN: true }), (x) => {
        const back = ref.reference('exp', [ref.reference('log', [x])]);
        // log(x) rounded to binary64 carries a relative error up to |log x| * 2^-53, which exp
        // turns into the same relative error in x; allow that plus one ulp for each rounding.
        const bound = Math.abs(x) * (Math.abs(ref.reference('log', [x])) + 2) * 2 ** -52;
        expect(Math.abs(back - x) <= bound).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects low precision, wrong arity, and inputs that do not settle', () => {
    expect(() => ref.reference('sin', [1], { precisionBits: 64 })).toThrow(/at least 128/);
    expect(() => ref.evaluateAt('sin', [1, 2], 128)).toThrow(/takes 1 argument/);
    expect(() => ref.evaluateAt('pow', [1], 128)).toThrow(/takes 2 argument/);
    // With no room to recompute, a value never settles.
    expect(() => ref.reference('sin', [1], { precisionBits: 128, maxPrecisionBits: 128 })).toThrow(
      ReferenceError,
    );
  });
});
