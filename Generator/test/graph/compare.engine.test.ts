// Every comparison kind, run on the authoring tool's engine: each must pass with the right
// expected value and fail with a wrong one, so no comparison is vacuous (project spec 10.4).
// The operation under test is math/add, which is outside the harness set, so no comparison
// needs an alternative construction.

import { beforeAll, describe, expect, it } from 'vitest';
import { loadAuthoringEngine, runOnAuthoringEngine } from '../../src/adapters/authoringEngine.js';
import { buildAsset } from '../../src/asset/build.js';
import type { ResolvedSubTest } from '../../src/asset/model.js';
import type { Comparison } from '../../src/graph/compare.js';
import { INDICATOR_COLOURS } from '../../src/graph/harness.js';
import { bool, float, intScalar, type Scalar } from '../../src/graph/scalar.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';

const catalogue = loadCatalogue(new URL('../../data/operations.yaml', import.meta.url));
const EXACT: Comparison = { mode: 'exact' };

interface Case {
  readonly label: string;
  readonly op: string;
  readonly a: Scalar;
  readonly b: Scalar;
  readonly result: 'bool' | 'int' | 'float';
  readonly right: Scalar;
  readonly wrong: Scalar;
  readonly comparison?: Comparison;
}

const CASES: readonly Case[] = [
  {
    label: 'int',
    op: 'math/add',
    a: intScalar(2147483647),
    b: intScalar(1),
    result: 'int',
    right: intScalar(-2147483648),
    wrong: intScalar(2147483647),
  },
  {
    label: 'bool true',
    op: 'math/lt',
    a: float(1),
    b: float(2),
    result: 'bool',
    right: bool(true),
    wrong: bool(false),
  },
  {
    label: 'bool false',
    op: 'math/lt',
    a: float(2),
    b: float(1),
    result: 'bool',
    right: bool(false),
    wrong: bool(true),
  },
  {
    label: 'finite',
    op: 'math/add',
    a: float(1.25),
    b: float(2),
    result: 'float',
    right: float(3.25),
    wrong: float(3.2500000000000004),
  },
  {
    label: 'NaN',
    op: 'math/add',
    a: float(Infinity),
    b: float(-Infinity),
    result: 'float',
    right: float(NaN),
    wrong: float(Infinity),
  },
  {
    label: '+Infinity',
    op: 'math/add',
    a: float(Infinity),
    b: float(1),
    result: 'float',
    right: float(Infinity),
    wrong: float(-Infinity),
  },
  {
    label: '-Infinity',
    op: 'math/add',
    a: float(-Infinity),
    b: float(1),
    result: 'float',
    right: float(-Infinity),
    wrong: float(Infinity),
  },
  {
    label: '+0',
    op: 'math/add',
    a: float(0),
    b: float(0),
    result: 'float',
    right: float(0),
    wrong: float(-0),
  },
  {
    label: '-0',
    op: 'math/add',
    a: float(-0),
    b: float(-0),
    result: 'float',
    right: float(-0),
    wrong: float(0),
  },
  {
    label: 'relative',
    op: 'math/add',
    a: float(0.1),
    b: float(0.2),
    result: 'float',
    right: float(0.3),
    wrong: float(0.3000000001),
    comparison: { mode: 'relative', r: 1e-12, a: 1e-300 },
  },
  {
    label: 'absolute',
    op: 'math/add',
    a: float(1),
    b: float(0.04),
    result: 'float',
    right: float(1),
    wrong: float(1.1),
    comparison: { mode: 'absolute', a: 0.05 },
  },
];

const subTest = (c: Case, expected: Scalar, which: string): ResolvedSubTest => ({
  name: `${c.label} ${which}`,
  op: c.op,
  inputs: [
    { socket: 'a', value: c.a },
    { socket: 'b', value: c.b },
  ],
  resultType: c.result,
  expected,
  comparison: c.comparison ?? EXACT,
  targets: [],
  specRefs: [],
  valueClasses: [],
  interpretations: [],
});

const SET_CASES: readonly ResolvedSubTest[] = [
  {
    ...subTest(CASES[3] as Case, float(3.25), 'set right'),
    name: 'set right',
    comparison: { mode: 'set', inner: 'exact', values: [float(-1), float(3.25)] },
  },
  {
    ...subTest(CASES[3] as Case, float(-1), 'set wrong'),
    name: 'set wrong',
    comparison: { mode: 'set', inner: 'exact', values: [float(-1), float(-2)] },
  },
];

let passed: Map<string, boolean>;
let events: readonly string[];
let indicators: readonly (readonly number[])[];
let names: string[];
beforeAll(async () => {
  const mod = await loadAuthoringEngine();
  if (mod === undefined) throw new Error('engine not installed');
  const subTests = [
    ...CASES.flatMap((c) => [subTest(c, c.right, 'right'), subTest(c, c.wrong, 'wrong')]),
    ...SET_CASES,
  ];
  names = subTests.map((s) => s.name);
  const built = buildAsset(
    { category: 'math', name: 'add-special', description: 'comparison check', subTests, expectedDuration: 0 },
    { catalogue, seed: 1n, copyright: 'Copyright (c) 2026, Test' },
  );
  const run = runOnAuthoringEngine(mod, built.glb, built.oracle);
  passed = new Map(run.subTests.map((s) => [s.name, s.passed]));
  events = run.events;
  indicators = run.indicators;
});

describe('comparisons on the authoring tool engine', () => {
  for (const c of CASES) {
    it(`${c.label}: passes with the right value and fails with a wrong one`, () => {
      expect(passed.get(`${c.label} right`)).toBe(true);
      expect(passed.get(`${c.label} wrong`)).toBe(false);
    });
  }

  it('set: passes when any member matches, fails when none does', () => {
    expect(passed.get('set right')).toBe(true);
    expect(passed.get('set wrong')).toBe(false);
  });

  it('reports test/onFailed and colours each indicator by its result', () => {
    expect(events).toEqual(['test/onStart', 'test/onFailed']);
    names.forEach((name, k) => {
      expect(indicators[k]).toEqual([
        ...(passed.get(name) === true ? INDICATOR_COLOURS.pass : INDICATOR_COLOURS.fail),
      ]);
    });
  });
});
