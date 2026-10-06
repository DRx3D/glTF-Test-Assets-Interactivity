// Every category generator, sorted by id. The orchestrator runs them in this order.

import { mathDivGenerator } from './math/div.js';
import { prerequisitesGenerator } from './prerequisites/harness.js';
import type { CategoryGenerator } from './types.js';

export const GENERATORS: readonly CategoryGenerator[] = [mathDivGenerator, prerequisitesGenerator].sort(
  (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
);
