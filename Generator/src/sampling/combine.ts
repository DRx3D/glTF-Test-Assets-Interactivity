// Combination rules for operation inputs (requirements §8.6, §8.7; project spec section 6.4).

import { sameBits } from '../numeric/f64.js';
import { int, type F64, type Int32 } from '../numeric/value.js';
import { floatSamples, intSamples, MIN_INT_SCATTER, SHIFT_COUNTS } from './classes.js';

/** A value still to be drawn from the PRNG (project spec section 6.2). */
export interface ScatterSlot {
  readonly kind: 'f64' | 'int32';
  /** Filled by fillScatterSlots; undefined until then. */
  value?: F64 | Int32;
}

export type ScalarDomain = 'float' | 'int' | 'bool';

export type InputValue =
  | { readonly kind: 'float'; readonly value: F64 }
  | { readonly kind: 'int'; readonly value: Int32 }
  | { readonly kind: 'bool'; readonly value: boolean }
  | { readonly kind: 'scatter'; readonly slot: ScatterSlot };

export interface SampleTuple {
  readonly inputs: readonly InputValue[];
  /** Union of the value classes of the inputs (written to the oracle, requirements §7.4). */
  readonly classes: readonly string[];
}

export interface CombineOptions {
  /** Rows of the operation's special-case table (§8.7 rule 1), first in the output. */
  readonly specialRows?: readonly (readonly InputValue[])[];
  /** Integer division-like operations get every sampled dividend with divisor 0 (§8.7 rule 3). */
  readonly divisorZero?: boolean;
  /** Index of a shift-count input, which uses the §8.4 shift counts instead of the int classes. */
  readonly shiftCountInput?: number;
  /** Extra domain-specific values per input position (§8.3). */
  readonly domainValues?: Readonly<Record<number, readonly InputValue[]>>;
  /** Scatter draws per input position; at least MIN_INT_SCATTER for int inputs. */
  readonly scatterPerInput?: number;
}

/** Ordinary values used in the other positions (project spec section 6.4). */
export const ORDINARY: Readonly<Record<ScalarDomain, InputValue>> = {
  float: { kind: 'float', value: 1.25 },
  int: { kind: 'int', value: int(7) },
  bool: { kind: 'bool', value: true },
};

const f = (value: F64): InputValue => ({ kind: 'float', value });
const i = (value: number): InputValue => ({ kind: 'int', value: int(value) });

/** Mandatory int32 pairs for binary integer operations (§8.7 rule 3). */
export const MANDATORY_INT_PAIRS: readonly (readonly [number, number])[] = [
  [-2147483648, -1],
  [2147483647, 1],
  [-2147483648, -2147483648],
  [-2147483648, 2147483647],
];

const sameInput = (a: InputValue, b: InputValue): boolean => {
  if (a.kind === 'scatter' || b.kind === 'scatter') return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'float' && b.kind === 'float' ? sameBits(a.value, b.value) : a.value === b.value;
};

const sameTuple = (a: SampleTuple, b: SampleTuple): boolean =>
  a.inputs.length === b.inputs.length && a.inputs.every((x, k) => sameInput(x, b.inputs[k] as InputValue));

/**
 * Input tuples for an operation, in a fixed order: special-case rows, then each sampled value
 * in each position with ordinary values elsewhere, then the integer pairs, divisor-0 cases and
 * scatter slots. Boolean-only operations get every combination (§8.6). Duplicates are dropped,
 * keeping the first. Full Cartesian products are never produced (§8.7).
 */
export function samplesFor(domains: readonly ScalarDomain[], options: CombineOptions = {}): SampleTuple[] {
  const out: SampleTuple[] = [];
  const push = (inputs: readonly InputValue[], classes: readonly string[]): void => {
    const tuple = { inputs, classes: [...new Set(classes)] };
    if (!out.some((t) => sameTuple(t, tuple))) out.push(tuple);
  };
  const ordinary = domains.map((d) => ORDINARY[d]);

  for (const row of options.specialRows ?? []) push(row, ['special']);

  if (domains.length > 0 && domains.every((d) => d === 'bool')) {
    for (let mask = 0; mask < 2 ** domains.length; mask++) {
      push(
        domains.map((_, k) => ({ kind: 'bool', value: Math.floor(mask / 2 ** k) % 2 === 1 }) as InputValue),
        ['bool'],
      );
    }
    return out;
  }

  const floats = floatSamples();
  const ints = intSamples();
  domains.forEach((domain, position) => {
    const at = (value: InputValue): InputValue[] => ordinary.map((o, k) => (k === position ? value : o));
    if (domain === 'float') {
      for (const s of floats) push(at(f(s.value)), s.classes);
    } else if (domain === 'int') {
      if (position === options.shiftCountInput) {
        for (const n of SHIFT_COUNTS) push(at(i(n)), ['shiftCount']);
      } else {
        for (const s of ints) push(at(i(s.value)), s.classes);
      }
    } else {
      for (const value of [true, false]) push(at({ kind: 'bool', value }), ['bool']);
    }
    for (const v of options.domainValues?.[position] ?? []) push(at(v), ['domain']);
  });

  const allInt = domains.length === 2 && domains.every((d) => d === 'int');
  if (allInt) {
    for (const [a, b] of MANDATORY_INT_PAIRS) push([i(a), i(b)], ['limit']);
    if (options.divisorZero === true) {
      for (const s of ints) push([i(s.value), i(0)], [...s.classes, 'zero']);
    }
  }

  domains.forEach((domain, position) => {
    if (domain === 'bool') return;
    const count = Math.max(options.scatterPerInput ?? 0, domain === 'int' ? MIN_INT_SCATTER : 0);
    for (let n = 0; n < count; n++) {
      const slot: ScatterSlot = { kind: domain === 'int' ? 'int32' : 'f64' };
      push(
        ordinary.map((o, k) => (k === position ? { kind: 'scatter', slot } : o)),
        ['scatter'],
      );
    }
  });
  return out;
}

/** Fails when a single check would enumerate more than `limit` items (requirements §4.2, §8.1). */
export function checkEnumeration(what: string, count: number, limit = 64): void {
  if (count > limit) {
    throw new Error(`${what}: ${count} items exceeds the enumeration limit of ${limit}`);
  }
}
