// Supplemental prerequisites asset (requirements §7.2 "Prerequisites"; project spec section
// 12). It verifies the harness operations and types the supplemental assets rely on that the
// existing prerequisites/Tests_required_operations asset does not: math/isNaN, math/div to
// ±Infinity, math/neg to -0, math/le, math/max, math/not, math/mul, math/Inf, math/NaN, and
// math/eq on int and bool.
//
// The asset is named `harness-types`: §6.2 allows no `prerequisites` facet, and the asset
// checks each harness operation on each input type in use.

import * as F from '../../numeric/f64.js';
import * as I from '../../numeric/int32.js';
import { int } from '../../numeric/value.js';
import { bool, float, type Scalar, type ScalarType } from '../../graph/scalar.js';
import type { InputValue } from '../../sampling/combine.js';
import { b, callName, f, signatureLine } from '../common.js';
import type { CategoryGenerator, PlanContext, PlanResult, SubTestPlan } from '../types.js';

interface Case {
  readonly op: string;
  readonly inputs: readonly (readonly [socket: string, type: ScalarType, value: InputValue])[];
  readonly result: ScalarType;
  readonly compute: (x: readonly Scalar[]) => Scalar;
  readonly classes: readonly string[];
}

const n = (x: Scalar): number => (x.type === 'bool' ? (x.value ? 1 : 0) : x.value);
const truth = (x: Scalar): boolean => x.type === 'bool' && x.value;
const i = (value: number): InputValue => ({ kind: 'int', value: int(value) });

const unaryF = (op: string, a: number, fn: (x: number) => number, classes: readonly string[]): Case => ({
  op,
  inputs: [['a', 'float', f(a)]],
  result: 'float',
  compute: ([x]) => float(fn(n(x as Scalar))),
  classes,
});
const binaryF = (
  op: string,
  a: number,
  bv: number,
  fn: (x: number, y: number) => number,
  classes: readonly string[],
): Case => ({
  op,
  inputs: [
    ['a', 'float', f(a)],
    ['b', 'float', f(bv)],
  ],
  result: 'float',
  compute: ([x, y]) => float(fn(n(x as Scalar), n(y as Scalar))),
  classes,
});
const predicateF = (
  op: string,
  a: number,
  bv: number,
  fn: (x: number, y: number) => boolean,
  classes: readonly string[],
): Case => ({
  op,
  inputs: [
    ['a', 'float', f(a)],
    ['b', 'float', f(bv)],
  ],
  result: 'bool',
  compute: ([x, y]) => bool(fn(n(x as Scalar), n(y as Scalar))),
  classes,
});

const MAX = 1.7976931348623157e308;

/** In a fixed order; each operation's simplest case comes first. */
export const PREREQUISITE_CASES: readonly Case[] = [
  { op: 'math/NaN', inputs: [], result: 'float', compute: () => float(NaN), classes: ['nan'] },
  { op: 'math/Inf', inputs: [], result: 'float', compute: () => float(Infinity), classes: ['infinity'] },
  {
    op: 'math/isNaN',
    inputs: [['a', 'float', f(NaN)]],
    result: 'bool',
    compute: ([x]) => bool(Number.isNaN(n(x as Scalar))),
    classes: ['nan'],
  },
  {
    op: 'math/isNaN',
    inputs: [['a', 'float', f(1.25)]],
    result: 'bool',
    compute: ([x]) => bool(Number.isNaN(n(x as Scalar))),
    classes: ['ordinary'],
  },
  {
    op: 'math/isNaN',
    inputs: [['a', 'float', f(Infinity)]],
    result: 'bool',
    compute: ([x]) => bool(Number.isNaN(n(x as Scalar))),
    classes: ['infinity'],
  },
  ...[true, false].map((v): Case => ({
    op: 'math/not',
    inputs: [['a', 'bool', b(v)]],
    result: 'bool',
    compute: ([x]) => bool(!truth(x as Scalar)),
    classes: ['bool'],
  })),
  ...(
    [
      [true, true],
      [true, false],
      [false, true],
    ] as const
  ).map(([x, y]): Case => ({
    op: 'math/and',
    inputs: [
      ['a', 'bool', b(x)],
      ['b', 'bool', b(y)],
    ],
    result: 'bool',
    compute: ([p, q]) => bool(truth(p as Scalar) && truth(q as Scalar)),
    classes: ['bool'],
  })),
  ...(
    [
      [7, 7],
      [7, -7],
      [-2147483648, -2147483648],
    ] as const
  ).map(([x, y]): Case => ({
    op: 'math/eq',
    inputs: [
      ['a', 'int', i(x)],
      ['b', 'int', i(y)],
    ],
    result: 'bool',
    compute: ([p, q]) => bool(I.eq(int(n(p as Scalar)), int(n(q as Scalar)))),
    classes: x === -2147483648 ? ['limit'] : ['ordinary'],
  })),
  ...(
    [
      [true, true],
      [false, true],
    ] as const
  ).map(([x, y]): Case => ({
    op: 'math/eq',
    inputs: [
      ['a', 'bool', b(x)],
      ['b', 'bool', b(y)],
    ],
    result: 'bool',
    compute: ([p, q]) => bool(truth(p as Scalar) === truth(q as Scalar)),
    classes: ['bool'],
  })),
  predicateF('math/eq', 1.25, 1.25, (x, y) => x === y, ['ordinary']),
  predicateF('math/eq', Infinity, Infinity, (x, y) => x === y, ['infinity']),
  predicateF('math/eq', 0, -0, (x, y) => x === y, ['zero']),
  predicateF('math/eq', NaN, NaN, (x, y) => x === y, ['nan']),
  predicateF('math/le', 1.25, 7, (x, y) => x <= y, ['ordinary']),
  predicateF('math/le', 7, 7, (x, y) => x <= y, ['ordinary']),
  predicateF('math/le', 7, 1.25, (x, y) => x <= y, ['ordinary']),
  predicateF('math/le', -0, 0, (x, y) => x <= y, ['zero']),
  predicateF('math/le', MAX, Infinity, (x, y) => x <= y, ['infinity']),
  predicateF('math/lt', -Infinity, -MAX, (x, y) => x < y, ['infinity']),
  binaryF('math/max', 1.25, 7, F.max, ['ordinary']),
  binaryF('math/max', -Infinity, 1.25, F.max, ['infinity']),
  binaryF('math/mul', 1.25, 4, F.mul, ['ordinary']),
  binaryF('math/mul', 1e-12, 7, F.mul, ['tolerance']),
  binaryF('math/sub', 7, 1.25, F.sub, ['ordinary']),
  binaryF('math/sub', 1.25, 1.25, F.sub, ['zero']),
  unaryF('math/abs', -1.25, F.abs, ['ordinary']),
  unaryF('math/abs', -0, F.abs, ['zero']),
  unaryF('math/abs', -Infinity, F.abs, ['infinity']),
  binaryF('math/div', 1, 0, F.div, ['zero']),
  binaryF('math/div', -1, 0, F.div, ['zero']),
  binaryF('math/div', 1, -0, F.div, ['zero']),
  binaryF('math/div', 0, 0, F.div, ['zero', 'nan']),
  unaryF('math/neg', 0, F.neg, ['zero']),
  unaryF('math/neg', -0, F.neg, ['zero']),
  unaryF('math/neg', Infinity, F.neg, ['infinity']),
];

export const prerequisitesGenerator: CategoryGenerator = {
  id: 'prerequisites',
  category: 'prerequisites',
  alwaysRun: true,
  plan(ctx: PlanContext): PlanResult {
    const subTests: SubTestPlan[] = PREREQUISITE_CASES.map((c) => {
      const types = c.inputs.map(([, t]) => t);
      return {
        op: c.op,
        inputs: c.inputs.map(([socket, type, value]) => ({ socket, type, value })),
        resultType: c.result,
        targets: [],
        valueClasses: c.classes,
        comparison: { mode: 'exact' },
        extraSpecRefs: [{ line: signatureLine(ctx.catalogue, c.op, types), section: c.op }],
        expected: c.compute,
        name: (inputs, expected) => callName(c.op, inputs, expected),
      };
    });
    return {
      assets: [
        {
          category: 'prerequisites',
          subject: 'harness',
          facet: 'types',
          description:
            'Harness operations the supplemental assets rely on, on each input type they use. Run before the other supplemental assets.',
          subTests,
        },
      ],
      notCoverable: [],
    };
  },
};
