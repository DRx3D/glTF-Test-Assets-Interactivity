// Comparison modes in the graph (requirements §7.3; project spec section 10.4). Each mode
// becomes a sub-graph of harness operations that yields the `bool` a flow/branch tests.
//
// Self-verification rule (requirements §7.2): a comparison never uses the operation under
// test on the same input types. Constants have alternative constructions for that case; a
// comparison with no permitted construction is a plan-time error.
//
// Vector and matrix results need component extraction, which waits on R1 (project spec
// section 18), so only scalar results are compared here.

import { isNegZero } from '../numeric/f64.js';
import { inlineFloat, inlineInt, type GraphBuilder, type ValueRef, type ValueSource } from './builder.js';
import type { Scalar, ScalarType } from './scalar.js';

export type Comparison =
  | { readonly mode: 'exact' }
  | { readonly mode: 'relative'; readonly r: number; readonly a: number }
  | { readonly mode: 'absolute'; readonly a: number }
  | {
      readonly mode: 'set';
      readonly values: readonly Scalar[];
      readonly inner: 'exact' | 'relative';
      readonly r?: number;
      readonly a?: number;
    };

/** The operation under test and its input types. */
export interface Subject {
  readonly op: string;
  readonly inputTypes: readonly ScalarType[];
}

/** The bool to branch on; when `invert` is set, the `false` output means pass. */
export interface ComparisonGraph {
  readonly condition: ValueRef;
  readonly invert: boolean;
}

export class ComparisonError extends Error {}

type Use = readonly [op: string, inputTypes: readonly ScalarType[]];

const sameTypes = (a: readonly ScalarType[], b: readonly ScalarType[]): boolean =>
  a.length === b.length && a.every((t, k) => t === b[k]);

/** One way to build a value, with the operations (and their input types) it uses. */
interface Construction {
  readonly uses: readonly Use[];
  readonly build: (g: GraphBuilder) => ValueRef;
}

const FF: readonly ScalarType[] = ['float', 'float'];

const POS_INF: readonly Construction[] = [
  { uses: [['math/Inf', []]], build: (g) => g.pure('math/Inf', 'harness', {}, 'float') },
  {
    uses: [['math/div', FF]],
    build: (g) => g.pure('math/div', 'harness', { a: inlineFloat(1), b: inlineFloat(0) }, 'float'),
  },
];

const NEG_INF: readonly Construction[] = [
  {
    uses: [
      ['math/Inf', []],
      ['math/neg', ['float']],
    ],
    build: (g) => g.pure('math/neg', 'harness', { a: g.pure('math/Inf', 'harness', {}, 'float') }, 'float'),
  },
  {
    uses: [['math/div', FF]],
    build: (g) => g.pure('math/div', 'harness', { a: inlineFloat(-1), b: inlineFloat(0) }, 'float'),
  },
];

class Context {
  constructor(
    readonly g: GraphBuilder,
    readonly subject: Subject,
  ) {}

  allowed(use: Use): boolean {
    return !(use[0] === this.subject.op && sameTypes(use[1], this.subject.inputTypes));
  }

  /** A harness operation, refused if it is the operation under test on the same types. */
  op(
    op: string,
    types: readonly ScalarType[],
    values: Readonly<Record<string, ValueSource>>,
    out: ScalarType,
  ): ValueRef {
    if (!this.allowed([op, types])) {
      throw new ComparisonError(
        `comparison would verify ${op}(${types.join(', ')}) with itself (requirements §7.2)`,
      );
    }
    return this.g.pure(op, 'harness', values, out);
  }

  choose(options: readonly Construction[], what: string): ValueRef {
    const c = options.find((o) => o.uses.every((u) => this.allowed(u)));
    if (c === undefined) throw new ComparisonError(`no permitted construction for ${what}`);
    return c.build(this.g);
  }

  /** Exact comparison of a float result (requirements §7.3, including the 1 / x zero check). */
  exactFloat(actual: ValueRef, e: number): ValueRef {
    if (Number.isNaN(e)) return this.op('math/isNaN', ['float'], { a: actual }, 'bool');
    if (e === Infinity || e === -Infinity) {
      const inf = this.choose(e > 0 ? POS_INF : NEG_INF, `${e}`);
      return this.op('math/eq', FF, { a: actual, b: inf }, 'bool');
    }
    if (e === 0) {
      const isZero = this.op('math/eq', FF, { a: actual, b: inlineFloat(0) }, 'bool');
      const reciprocal = this.op('math/div', FF, { a: inlineFloat(1), b: actual }, 'float');
      const inf = this.choose(isNegZero(e) ? NEG_INF : POS_INF, isNegZero(e) ? '-Infinity' : 'Infinity');
      const signOk = this.op('math/eq', FF, { a: reciprocal, b: inf }, 'bool');
      return this.op('math/and', ['bool', 'bool'], { a: isZero, b: signOk }, 'bool');
    }
    return this.op('math/eq', FF, { a: actual, b: inlineFloat(e) }, 'bool');
  }

  /** |actual - e| <= max(r * |e|, a), or <= a when r is undefined (absolute mode). */
  within(actual: ValueRef, e: number, r: number | undefined, a: number): ValueRef {
    const diff = this.op(
      'math/abs',
      ['float'],
      { a: this.op('math/sub', FF, { a: actual, b: inlineFloat(e) }, 'float') },
      'float',
    );
    const bound =
      r === undefined
        ? inlineFloat(a)
        : this.op(
            'math/max',
            FF,
            {
              a: this.op(
                'math/mul',
                FF,
                { a: inlineFloat(r), b: this.op('math/abs', ['float'], { a: inlineFloat(e) }, 'float') },
                'float',
              ),
              b: inlineFloat(a),
            },
            'float',
          );
    return this.op('math/le', FF, { a: diff, b: bound }, 'bool');
  }

  /** A single expected value under exact or tolerance comparison. */
  one(actual: ValueRef, expected: Scalar, r: number | undefined, a: number | undefined): ValueRef {
    if (expected.type === 'bool') {
      return expected.value ? actual : this.op('math/not', ['bool'], { a: actual }, 'bool');
    }
    if (expected.type === 'int') {
      return this.op('math/eq', ['int', 'int'], { a: actual, b: inlineInt(expected.value) }, 'bool');
    }
    const e = expected.value;
    // NaN, ±Infinity and ±0 are always compared exactly (requirements §7.3).
    if (a === undefined || !Number.isFinite(e) || e === 0) return this.exactFloat(actual, e);
    return this.within(actual, e, r, a);
  }
}

/**
 * Builds the comparison of `actual` (a result read back from its variable) against
 * `expected`. A bool result needs no operation: the branch tests it directly, inverted when
 * false is expected.
 */
export function buildComparison(
  g: GraphBuilder,
  actual: ValueRef,
  expected: Scalar,
  comparison: Comparison,
  subject: Subject,
): ComparisonGraph {
  const ctx = new Context(g, subject);
  switch (comparison.mode) {
    case 'exact':
      if (expected.type === 'bool') return { condition: actual, invert: !expected.value };
      return { condition: ctx.one(actual, expected, undefined, undefined), invert: false };
    case 'relative':
      return { condition: ctx.one(actual, expected, comparison.r, comparison.a), invert: false };
    case 'absolute':
      return { condition: ctx.one(actual, expected, undefined, comparison.a), invert: false };
    case 'set': {
      if (comparison.values.length < 2)
        throw new ComparisonError('a set comparison needs at least two values');
      const inner = (v: Scalar): ValueRef =>
        comparison.inner === 'exact'
          ? ctx.one(actual, v, undefined, undefined)
          : ctx.one(actual, v, comparison.r, comparison.a);
      // any(c) = not(and(not c1, not c2, …)); math/or is not in the harness set.
      const negated = comparison.values.map((v) => ctx.op('math/not', ['bool'], { a: inner(v) }, 'bool'));
      const all = negated.reduce((acc, c) => ctx.op('math/and', ['bool', 'bool'], { a: acc, b: c }, 'bool'));
      return { condition: ctx.op('math/not', ['bool'], { a: all }, 'bool'), invert: false };
    }
  }
}
