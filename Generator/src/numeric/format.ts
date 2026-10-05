// Number formatting for everything the generator writes (requirements §5.4, §7.4, §7.5;
// project spec section 5.4).

import { sameBits, isNegZero } from './f64.js';
import type { F64, Int32 } from './value.js';

/**
 * Where a number is written:
 * - `graph`: an inline value in the behavior graph JSON. NaN, ±Infinity and -0 are not
 *   representable there (they are built with math/NaN, math/Inf and math/neg), so they throw,
 *   except -0 when the caller opts in for the `literalNegZero` value class.
 * - `oracle`: an oracle file value. Special values become the strings "NaN", "Infinity",
 *   "-Infinity" and "-0".
 * - `text`: sub-test names and description files. Special values are spelled the same way.
 */
export type NumberContext = 'graph' | 'oracle' | 'text';

export interface FormatOptions {
  /** Allow -0 as a JSON literal in graph context (value class `literalNegZero`, requirements §8.2). */
  readonly allowLiteralNegZero?: boolean;
}

/** The special values' spelling in oracle and text contexts. */
export const specialName = (x: F64): 'NaN' | 'Infinity' | '-Infinity' | '-0' | undefined => {
  if (Number.isNaN(x)) return 'NaN';
  if (x === Infinity) return 'Infinity';
  if (x === -Infinity) return '-Infinity';
  if (isNegZero(x)) return '-0';
  return undefined;
};

/**
 * Shortest decimal that parses back to the same binary64 value, with `.` as the separator
 * whatever the locale. ECMAScript defines `String(x)` this way. Integer values get `.0`,
 * matching the existing suite's oracle style (`7.0`).
 */
const shortest = (x: F64): string => {
  const s = String(x);
  return /^-?\d+$/.test(s) ? `${s}.0` : s;
};

export class NumberFormatError extends Error {}

/**
 * Formats a binary64 value for the given context. In `oracle` and `text` contexts special
 * values return their name; the JSON writer quotes them.
 */
export function formatF64(x: F64, context: NumberContext, options: FormatOptions = {}): string {
  const special = specialName(x);
  if (special !== undefined) {
    if (context !== 'graph') {
      return special;
    }
    if (special === '-0' && options.allowLiteralNegZero === true) {
      return '-0.0';
    }
    throw new NumberFormatError(`${special} cannot be written as a graph JSON literal`);
  }
  const out = shortest(x);
  // Invariant guard: ECMAScript guarantees String(x) round-trips, so this cannot fire in a
  // conforming engine. It stays as a cheap check against engine bugs (project spec section 5.4).
  /* v8 ignore next 3 */
  if (!sameBits(Number(out), x)) {
    throw new NumberFormatError(`round-trip failure formatting ${out}`);
  }
  return out;
}

/** Formats an int32 value. */
export const formatInt = (x: Int32): string => String(x);
