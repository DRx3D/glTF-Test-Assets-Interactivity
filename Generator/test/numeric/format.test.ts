import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sameBits } from '../../src/numeric/f64.js';
import { formatF64, formatInt, NumberFormatError, specialName } from '../../src/numeric/format.js';
import { int } from '../../src/numeric/value.js';

describe('formatF64', () => {
  it('writes the shortest round-trip decimal and parses back to the same bits', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }).filter((x) => !Object.is(x, -0)),
        (x) => {
          const text = formatF64(x, 'graph');
          expect(sameBits(Number(text), x)).toBe(true);
          expect(text).not.toContain(',');
        },
      ),
      { numRuns: 10_000 },
    );
  });

  it.each([
    [7, '7.0'],
    [-10, '-10.0'],
    [16777217, '16777217.0'],
    [0.1, '0.1'],
    [5e-324, '5e-324'],
    [1.7976931348623157e308, '1.7976931348623157e+308'],
    [1e21, '1e+21'],
    [0.30000000000000004, '0.30000000000000004'],
  ])('%s -> %s', (x, text) => {
    expect(formatF64(x, 'graph')).toBe(text);
    expect(formatF64(x, 'oracle')).toBe(text);
  });

  it('refuses special values in graph context', () => {
    for (const x of [NaN, Infinity, -Infinity, -0]) {
      expect(() => formatF64(x, 'graph')).toThrow(NumberFormatError);
    }
  });

  it('writes -0 as a graph literal only when allowed (value class literalNegZero)', () => {
    const text = formatF64(-0, 'graph', { allowLiteralNegZero: true });
    expect(text).toBe('-0.0');
    expect(Object.is(Number(text), -0)).toBe(true);
    expect(() => formatF64(NaN, 'graph', { allowLiteralNegZero: true })).toThrow(NumberFormatError);
  });

  it('names special values in oracle and text contexts', () => {
    expect([NaN, Infinity, -Infinity, -0].map((x) => formatF64(x, 'oracle'))).toEqual([
      'NaN',
      'Infinity',
      '-Infinity',
      '-0',
    ]);
    expect(formatF64(-0, 'text')).toBe('-0');
    expect(specialName(1)).toBeUndefined();
  });

  it('formatInt', () => {
    expect(formatInt(int(-2147483648))).toBe('-2147483648');
  });
});
