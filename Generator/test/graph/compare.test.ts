import { describe, expect, it } from 'vitest';
import { GraphBuilder } from '../../src/graph/builder.js';
import { buildComparison, ComparisonError, type Comparison, type Subject } from '../../src/graph/compare.js';
import {
  bool,
  float,
  intScalar,
  scalarSource,
  sentinel,
  sameScalar,
  scalarText,
  type Scalar,
} from '../../src/graph/scalar.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';

const catalogue = loadCatalogue(new URL('../../data/operations.yaml', import.meta.url));

/** The operations a comparison builds, in serialised order. */
function opsFor(expected: Scalar, comparison: Comparison, subject: Subject): string[] {
  const g = new GraphBuilder(catalogue);
  const actual = g.pure(
    'math/add',
    'subject',
    { a: scalarSource(g, expected, 'setup'), b: scalarSource(g, expected, 'setup') },
    expected.type,
  );
  const before = [...g.build().ops];
  buildComparison(g, actual, expected, comparison, subject);
  const after = [...g.build().ops];
  for (const op of before) after.splice(after.indexOf(op), 1);
  return after;
}
const EXACT: Comparison = { mode: 'exact' };
const add: Subject = { op: 'math/add', inputTypes: ['float', 'float'] };

describe('buildComparison', () => {
  it('uses 1 / x and ±Infinity to check the sign of zero (requirements §7.3)', () => {
    expect(opsFor(float(-0), EXACT, add)).toEqual(
      expect.arrayContaining(['math/eq', 'math/div', 'math/Inf', 'math/neg', 'math/and']),
    );
    expect(opsFor(float(0), EXACT, add)).not.toContain('math/neg');
  });

  it('compares NaN with isNaN and specials exactly even under a tolerance', () => {
    expect(opsFor(float(NaN), { mode: 'relative', r: 1e-12, a: 1e-300 }, add)).toContain('math/isNaN');
    expect(opsFor(float(Infinity), { mode: 'relative', r: 1e-12, a: 1e-300 }, add)).not.toContain('math/le');
    expect(opsFor(float(2.5), { mode: 'relative', r: 1e-12, a: 1e-300 }, add)).toEqual(
      expect.arrayContaining(['math/le', 'math/max', 'math/mul', 'math/abs', 'math/sub']),
    );
    expect(opsFor(float(2.5), { mode: 'absolute', a: 0.05 }, add)).not.toContain('math/max');
  });

  it('switches constant constructions to avoid verifying an operation with itself (§7.2)', () => {
    expect(opsFor(float(Infinity), EXACT, { op: 'math/Inf', inputTypes: [] })).not.toContain('math/Inf');
    expect(opsFor(float(-Infinity), EXACT, { op: 'math/neg', inputTypes: ['float'] })).not.toContain(
      'math/neg',
    );
    expect(() => opsFor(float(0), EXACT, { op: 'math/div', inputTypes: ['float', 'float'] })).toThrow(
      ComparisonError,
    );
    expect(() => opsFor(intScalar(3), EXACT, { op: 'math/eq', inputTypes: ['int', 'int'] })).toThrow(
      /itself/,
    );
  });

  it('branches on bool results directly, inverted when false is expected', () => {
    const g = new GraphBuilder(catalogue);
    const actual = g.pure(
      'math/lt',
      'subject',
      { a: scalarSource(g, float(1), 'setup'), b: scalarSource(g, float(2), 'setup') },
      'bool',
    );
    expect(buildComparison(g, actual, bool(true), EXACT, add)).toEqual({ condition: actual, invert: false });
    expect(buildComparison(g, actual, bool(false), EXACT, add).invert).toBe(true);
  });

  it('builds sets as not(and(not …)) and needs two members', () => {
    expect(opsFor(float(1), { mode: 'set', inner: 'exact', values: [float(1), float(2)] }, add)).toContain(
      'math/not',
    );
    expect(
      opsFor(
        float(1),
        { mode: 'set', inner: 'relative', r: 1e-12, a: 1e-12, values: [float(1), float(2)] },
        add,
      ),
    ).toContain('math/le');
    expect(() => opsFor(float(1), { mode: 'set', inner: 'exact', values: [float(1)] }, add)).toThrow(
      /two values/,
    );
  });
});

describe('scalars', () => {
  it('formats, compares and picks sentinels', () => {
    expect(scalarText(float(-0))).toBe('-0');
    expect(scalarText(float(7))).toBe('7.0');
    expect(scalarText(bool(false))).toBe('false');
    expect(sameScalar(float(NaN), float(NaN))).toBe(true);
    expect(sameScalar(float(0), float(-0))).toBe(false);
    expect(sameScalar(intScalar(1), float(1))).toBe(false);
    expect(sameScalar(bool(true), bool(true))).toBe(true);
    for (const s of [bool(true), intScalar(-1), intScalar(5), float(-1.5), float(NaN)]) {
      expect(sameScalar(sentinel(s), s)).toBe(false);
    }
  });

  it('builds special floats from math/NaN, math/Inf and math/neg', () => {
    const g = new GraphBuilder(catalogue);
    for (const x of [NaN, Infinity, -Infinity, -0]) scalarSource(g, float(x), 'setup');
    expect(scalarSource(g, float(-0), 'setup', { literalNegZero: true })).toMatchObject({
      kind: 'inline',
      allowLiteralNegZero: true,
    });
    expect(g.build().ops).toEqual(expect.arrayContaining(['math/NaN', 'math/Inf', 'math/neg']));
  });
});
