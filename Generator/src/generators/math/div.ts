// math/div generator, M3 vertical slice (build steps, step 8). Covers int division that
// truncates toward zero (Specification line 2626) with inexact quotients of every sign
// combination, int32 limits and scatter dividends.
//
// Vector and matrix signatures need component-wise comparison, which waits on R1 (project
// spec section 18); those targets are reported as not coverable until the M4 generator.

import * as I from '../../numeric/int32.js';
import { int } from '../../numeric/value.js';
import { intScalar, type Scalar } from '../../graph/scalar.js';
import type { Target } from '../../registry/targets.js';
import type { InputValue } from '../../sampling/combine.js';
import { callName } from '../common.js';
import type { CategoryGenerator, NotCoverable, PlanContext, PlanResult, SubTestPlan } from '../types.js';

const i = (value: number): InputValue => ({ kind: 'int', value: int(value) });
const scatter = (): InputValue => ({ kind: 'scatter', slot: { kind: 'int32' } });

/** Dividend, divisor and value classes, in sub-test order. */
const INT_CASES: readonly (readonly [() => InputValue, () => InputValue, readonly string[]])[] = [
  [() => i(-7), () => i(2), ['inexact', 'negative']],
  [() => i(7), () => i(-2), ['inexact', 'negative']],
  [() => i(-7), () => i(-2), ['inexact', 'negative']],
  [() => i(7), () => i(2), ['inexact']],
  [() => i(-1), () => i(2), ['inexact', 'negative']],
  [() => i(1), () => i(-2), ['inexact', 'negative']],
  [() => i(-2147483648), () => i(3), ['limit', 'inexact']],
  [() => i(2147483647), () => i(-2), ['limit', 'inexact']],
  [() => i(-2147483647), () => i(2), ['limit', 'inexact']],
  [() => i(2147483647), () => i(2147483646), ['limit', 'inexact']],
  [scatter, () => i(7), ['scatter']],
  [scatter, () => i(-3), ['scatter']],
  [scatter, scatter, ['scatter']],
];

const intOnly = (t: Target): boolean =>
  t.covers !== 'TODO' && (t.covers.types ?? []).every((x) => x === 'int');

export const mathDivGenerator: CategoryGenerator = {
  id: 'math/div',
  category: 'math',
  plan(_ctx: PlanContext, gaps: readonly Target[]): PlanResult {
    const owned = gaps.filter(intOnly).map((t) => t.id);
    const notCoverable: NotCoverable[] = gaps
      .filter((t) => !intOnly(t))
      .map((t) => ({
        target: t.id,
        reason: 'vector and matrix results need component extraction in the harness (R1); planned for M4',
      }));
    if (owned.length === 0) return { assets: [], notCoverable };
    const subTests: SubTestPlan[] = INT_CASES.map(([a, b, classes]) => ({
      op: 'math/div',
      inputs: [
        { socket: 'a', type: 'int', value: a() },
        { socket: 'b', type: 'int', value: b() },
      ],
      resultType: 'int',
      targets: owned,
      valueClasses: classes,
      comparison: { mode: 'exact' },
      expected: ([x, y]: readonly Scalar[]) =>
        intScalar(I.div(int((x as Scalar).value as number), int((y as Scalar).value as number))),
      name: (inputs, expected) => callName('math/div', inputs, expected),
    }));
    return {
      assets: [
        {
          category: 'math',
          subject: 'div',
          facet: 'boundary',
          description:
            'Integer division truncates toward zero, including inexact negative quotients and int32 limits.',
          subTests,
        },
      ],
      notCoverable,
    };
  },
};
