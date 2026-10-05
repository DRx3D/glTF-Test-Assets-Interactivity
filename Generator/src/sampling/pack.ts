// Packing of component-wise samples into vector and matrix sub-tests
// (requirements §8.8, §8.9; project spec section 6.5).

import type { InputValue, SampleTuple } from './combine.js';

/** Value classes that must also appear in a scalar float sub-test (§8.9). */
export const SCALAR_RESERVED = ['zero', 'halfway', 'infinity', 'nan'] as const;

export interface PackedSubTest {
  /** Component count: 1 for scalar, 4 for float4, 16 for float4x4, and so on. */
  readonly width: number;
  /** One tuple per component; each component gets its own expected value. */
  readonly components: readonly SampleTuple[];
}

export interface PackResult {
  /** Scalar sub-tests for the reserved classes, so a failure traces to one value. */
  readonly scalars: readonly PackedSubTest[];
  /** Packed sub-tests; the last group is padded by repeating its first component. */
  readonly packed: readonly PackedSubTest[];
}

const isReserved = (t: SampleTuple): boolean =>
  t.classes.some((c) => (SCALAR_RESERVED as readonly string[]).includes(c));

const distinctKey = (v: InputValue | undefined): string =>
  v === undefined
    ? ''
    : v.kind === 'scatter'
      ? `slot${String(v.slot.value)}`
      : v.kind === 'float' && Object.is(v.value, -0)
        ? '-0'
        : String(v.value);

/** True when every component differs in its first input, which detects layout errors (§8.8). */
export const allComponentsDistinct = (p: PackedSubTest): boolean =>
  new Set(p.components.map((t) => distinctKey(t.inputs[0]))).size === p.components.length;

/**
 * Packs scalar tuples into sub-tests of `width` components, in order. Tuples in the reserved
 * classes also get a scalar sub-test of their own. Throws if no packed sub-test has all-distinct
 * components, since then component-order and layout errors could go undetected (§8.8).
 */
export function pack(tuples: readonly SampleTuple[], width: number): PackResult {
  if (!Number.isInteger(width) || width < 2) {
    throw new RangeError('packing width must be an integer of at least 2');
  }
  const scalars = tuples.filter(isReserved).map((t) => ({ width: 1, components: [t] }));
  const packed: PackedSubTest[] = [];
  for (let k = 0; k < tuples.length; k += width) {
    const group = tuples.slice(k, k + width);
    const first = group[0];
    while (first !== undefined && group.length < width) group.push(first);
    packed.push({ width, components: group });
  }
  if (packed.length > 0 && !packed.some(allComponentsDistinct)) {
    throw new Error(`no packed width-${width} sub-test has all-distinct components`);
  }
  return { scalars, packed };
}
