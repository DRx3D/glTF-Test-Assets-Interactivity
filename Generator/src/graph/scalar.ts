// Scalar values passed between generators, the harness and the writers, and how a scalar
// becomes a graph input. NaN, ±Infinity and -0 cannot be JSON literals, so they are built
// from math/NaN, math/Inf and math/neg nodes (project spec section 10.1).

import { isNegZero, sameBits } from '../numeric/f64.js';
import { formatF64, formatInt } from '../numeric/format.js';
import { f64, i32, type JsonNode } from '../numeric/json.js';
import { int, type F64, type Int32 } from '../numeric/value.js';
import {
  inlineBool,
  inlineFloat,
  inlineInt,
  type GraphBuilder,
  type NodeRole,
  type ValueSource,
} from './builder.js';

export type ScalarType = 'bool' | 'int' | 'float';

export type Scalar =
  | { readonly type: 'bool'; readonly value: boolean }
  | { readonly type: 'int'; readonly value: Int32 }
  | { readonly type: 'float'; readonly value: F64 };

export const bool = (value: boolean): Scalar => ({ type: 'bool', value });
export const intScalar = (value: number): Scalar => ({ type: 'int', value: int(value) });
export const float = (value: F64): Scalar => ({ type: 'float', value });

/** Equal as the Specification's exact mode compares: bit patterns for floats, any NaN matching. */
export function sameScalar(a: Scalar, b: Scalar): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'float' && b.type === 'float') {
    return (Number.isNaN(a.value) && Number.isNaN(b.value)) || sameBits(a.value, b.value);
  }
  return a.value === b.value;
}

/** The value as text for sub-test names and descriptions (requirements §5.4, §7.5). */
export function scalarText(s: Scalar): string {
  if (s.type === 'bool') return s.value ? 'true' : 'false';
  if (s.type === 'int') return formatInt(s.value);
  return formatF64(s.value, 'text');
}

/** The value as an oracle JSON array element; special floats become strings (requirements §7.4). */
export function scalarOracle(s: Scalar): JsonNode {
  if (s.type === 'bool') return s.value;
  if (s.type === 'int') return i32(s.value);
  return f64(s.value);
}

/** Options for one input. */
export interface InputOptions {
  /** Write -0 as a JSON literal instead of math/neg(0) (value class `literalNegZero`). */
  readonly literalNegZero?: boolean;
}

/**
 * The value source for an input: an inline literal, or for special floats a small sub-graph
 * built with `role` (setup for sub-test inputs, harness for comparison constants).
 */
export function scalarSource(
  g: GraphBuilder,
  s: Scalar,
  role: NodeRole,
  options: InputOptions = {},
): ValueSource {
  if (s.type === 'bool') return inlineBool(s.value);
  if (s.type === 'int') return inlineInt(s.value);
  const x = s.value;
  if (Number.isNaN(x)) return g.pure('math/NaN', role, {}, 'float');
  if (x === Infinity) return g.pure('math/Inf', role, {}, 'float');
  if (x === -Infinity) return g.pure('math/neg', role, { a: g.pure('math/Inf', role, {}, 'float') }, 'float');
  if (isNegZero(x)) {
    return options.literalNegZero === true
      ? inlineFloat(x, true)
      : g.pure('math/neg', role, { a: inlineFloat(0) }, 'float');
  }
  return inlineFloat(x);
}

/**
 * A value that is not `expected`, used as a result variable's initial value so a sub-test
 * whose operation never runs cannot leave the expected value in place.
 */
export function sentinel(expected: Scalar): Scalar {
  if (expected.type === 'bool') return bool(!expected.value);
  if (expected.type === 'int') return intScalar(expected.value === -1 ? 1 : -1);
  return float(sameBits(expected.value, -1.5) ? 1.5 : -1.5);
}
