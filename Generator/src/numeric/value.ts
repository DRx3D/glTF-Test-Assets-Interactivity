// Value model shared by the whole generator (project spec section 5.1).

declare const int32Brand: unique symbol;

/** A two's complement 32-bit signed integer. Always satisfies `(x | 0) === x`. */
export type Int32 = number & { readonly [int32Brand]: true };

/** An IEEE-754 binary64 value. */
export type F64 = number;

export const INT32_MIN = -2147483648 as Int32;
export const INT32_MAX = 2147483647 as Int32;

/** Value types defined by the Specification, in the order used for the `types` array. */
export const VALUE_TYPES = [
  'bool',
  'int',
  'float',
  'float2',
  'float3',
  'float4',
  'float2x2',
  'float3x3',
  'float4x4',
  'ref',
] as const;

export type ValueType = (typeof VALUE_TYPES)[number];

/** Number of components of each numeric value type. */
export const COMPONENT_COUNT: Readonly<Record<Exclude<ValueType, 'ref'>, number>> = {
  bool: 1,
  int: 1,
  float: 1,
  float2: 2,
  float3: 3,
  float4: 4,
  float2x2: 4,
  float3x3: 9,
  float4x4: 16,
};

export function isInt32(x: number): x is Int32 {
  return Number.isInteger(x) && x >= INT32_MIN && x <= INT32_MAX;
}

/**
 * The only way to make an Int32. Throws unless `x` is an integer in [-2^31, 2^31 - 1].
 * Negative zero is normalised to zero, because int32 has no negative zero.
 */
export function int(x: number): Int32 {
  if (!isInt32(x)) {
    throw new RangeError(`not an int32 value: ${String(x)}`);
  }
  return (x === 0 ? 0 : x) as Int32;
}
