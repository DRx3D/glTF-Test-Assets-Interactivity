// supplemental-index.json (requirements §6.3; project spec section 11.5): the entry format of
// the existing test-index.json, sorted by name, tags listing every declared operation.

import { obj, writeCanonicalJson } from '../numeric/json.js';

export interface IndexEntry {
  /** `<category>/<asset>`. */
  readonly name: string;
  readonly assetName: string;
  /** Declared operations, sorted. */
  readonly tags: readonly string[];
}

export function indexJson(entries: readonly IndexEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return writeCanonicalJson(
    sorted.map((e) =>
      obj([
        ['label', e.name],
        ['name', e.name],
        ['tags', [...e.tags]],
        [
          'variants',
          obj([
            ['glTF-Binary', `${e.assetName}.glb`],
            ['test-Json', `${e.assetName}.json`],
          ]),
        ],
      ]),
    ),
    { context: 'oracle', indent: 2 },
  );
}
