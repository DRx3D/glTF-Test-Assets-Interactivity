// The resolved form of an asset: final name, concrete inputs and expected values
// (project spec section 4, `ResolvedAsset`). Writers take only this.

import type { HarnessSubTest } from '../graph/harness.js';

export const CATEGORIES = [
  'math',
  'type',
  'ref',
  'flow',
  'variable',
  'pointer',
  'animation',
  'event',
  'debug',
  'concepts',
  'config',
  'prerequisites',
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface SpecRef {
  readonly revision: string;
  readonly line: number;
  readonly section: string;
}

export interface ResolvedSubTest extends HarnessSubTest {
  readonly targets: readonly string[];
  readonly specRefs: readonly SpecRef[];
  readonly valueClasses: readonly string[];
  /** Interpretation ids the expected value relies on (requirements §9.5). */
  readonly interpretations: readonly string[];
}

export interface ResolvedAsset {
  readonly category: Category;
  /** `<subject>-<facet>[-part<N>]` (requirements §6.2). */
  readonly name: string;
  readonly description: string;
  readonly subTests: readonly ResolvedSubTest[];
  /** Seconds (requirements §7.2 item 3). */
  readonly expectedDuration: number;
}

/** `<category>/<asset>`: the oracle's `name` and the variable-name prefix. */
export const testName = (asset: Pick<ResolvedAsset, 'category' | 'name'>): string =>
  `${asset.category}/${asset.name}`;
