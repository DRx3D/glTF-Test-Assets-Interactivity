// Draw order for scatter values (requirements §8.10; project spec section 6.2): assets by name
// (code-unit order), then sub-tests in order, then slots in order within a sub-test. Slot counts
// are fixed before any value is drawn, so the draws never depend on drawn values.

import { SplitMix64 } from '../prng/splitmix64.js';
import type { ScatterSlot } from './combine.js';

export interface SlottedAsset {
  readonly name: string;
  readonly subTests: readonly { readonly slots: readonly ScatterSlot[] }[];
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Fills every slot in the documented order. Returns the number of values drawn. */
export function fillScatterSlots(assets: readonly SlottedAsset[], rng: SplitMix64): number {
  const names = assets.map((a) => a.name);
  if (new Set(names).size !== names.length) {
    throw new Error('asset names must be unique before drawing scatter values');
  }
  let drawn = 0;
  for (const asset of [...assets].sort((a, b) => byCodeUnit(a.name, b.name))) {
    for (const subTest of asset.subTests) {
      for (const slot of subTest.slots) {
        if (slot.value !== undefined) {
          throw new Error(`${asset.name}: scatter slot filled twice`);
        }
        slot.value = slot.kind === 'f64' ? rng.scatterF64() : rng.scatterInt32();
        drawn++;
      }
    }
  }
  return drawn;
}
