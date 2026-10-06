import { beforeAll, describe, expect, it } from 'vitest';
import { nextUp } from '../../src/numeric/f64.js';
import { GmpReference } from '../../src/reference/reference.js';
import { domainValues, type DomainTable } from '../../src/sampling/domains.js';

let ref: GmpReference;
let table: DomainTable;
beforeAll(async () => {
  ref = await GmpReference.create();
  table = domainValues(ref);
});

/** The value at `index` of a table row, failing the test if it is missing. */
const at = (key: string, index: number): number => {
  const v = table[key]?.[index];
  if (v === undefined) throw new Error(`${key}[${index}] missing`);
  return v;
};

describe('domain-specific values (requirements §8.3)', () => {
  it('places the exp overflow threshold between adjacent doubles', () => {
    const last = at('exp', 0);
    const first = at('exp', 1);
    expect(nextUp(last)).toBe(first);
    expect(Number.isFinite(ref.reference('exp', [last]))).toBe(true);
    expect(ref.reference('exp', [first])).toBe(Infinity);
    expect(last).toBeCloseTo(709.782712893384, 12);
  });

  it('places the exp underflow threshold between adjacent doubles', () => {
    const firstPositive = at('exp', 2);
    const lastZero = at('exp', 3);
    expect(nextUp(lastZero)).toBe(firstPositive);
    expect(ref.reference('exp', [lastZero])).toBe(0);
    expect(ref.reference('exp', [firstPositive])).toBeGreaterThan(0);
  });

  it('finds sinh and cosh overflow on both signs', () => {
    expect(ref.reference('sinh', [at('sinh', 0)])).toBeLessThan(Infinity);
    expect(ref.reference('sinh', [at('sinh', 1)])).toBe(Infinity);
    expect(table.sinh).toContain(-at('sinh', 1));
    expect(ref.reference('cosh', [-at('cosh', 1)])).toBe(Infinity);
  });

  it('includes the nearest doubles to multiples of pi', () => {
    expect(table.sin).toContain(3.141592653589793);
    expect(table.sin).toContain(1.5707963267948966);
    expect(table.cos).toContain(-6.283185307179586);
    expect(table.tan).toContain(1e22);
  });

  it('pairs atan2 inputs and is deterministic', () => {
    expect((table.atan2 ?? []).length % 2).toBe(0);
    expect(domainValues(ref)).toEqual(table);
  });
});
