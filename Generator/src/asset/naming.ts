// Asset names and splitting (requirements §6.2, §7.7; project spec section 11.1).

export const FACETS = [
  'types',
  'special',
  'boundary',
  'precision',
  'negzero',
  'config',
  'order',
  'timing',
  'syntax',
  'errors',
  'state',
  'scalar',
  'objectModel',
] as const;
export type Facet = (typeof FACETS)[number];

/** `<subject>-<facet>` or `<subject>-<facet>-part<N>`. */
export function assetName(subject: string, facet: string, part?: number): string {
  if (!(FACETS as readonly string[]).includes(facet)) {
    throw new Error(`facet ${facet} is not one of ${FACETS.join(', ')} (requirements §6.2)`);
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(subject)) {
    throw new Error(`asset subject ${subject} must be an operation or topic name`);
  }
  if (part !== undefined && !(Number.isInteger(part) && part >= 1)) {
    throw new Error(`part number ${part} must be a positive integer`);
  }
  return part === undefined ? `${subject}-${facet}` : `${subject}-${facet}-part${part}`;
}

/**
 * Splits items greedily, in order, so that no part has more than `maxItems` items or a cost
 * above `maxCost`. `cost(items)` measures a candidate part. A single item over `maxCost` is
 * an error.
 */
export function splitGreedy<T>(
  items: readonly T[],
  maxItems: number,
  maxCost: number,
  cost: (part: readonly T[]) => number,
): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length > 0 && (candidate.length > maxItems || cost(candidate) > maxCost)) {
      parts.push(current);
      current = [item];
    } else {
      current = candidate;
    }
    if (current.length === 1 && cost(current) > maxCost) {
      throw new Error(`one sub-test alone exceeds the limit of ${maxCost}`);
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}
