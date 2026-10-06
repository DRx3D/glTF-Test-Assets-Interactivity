// Generator identity, written into asset.generator and the oracle files (requirements §14).
// Kept equal to package.json "version" by a unit test.

import { SPEC_REVISION } from './registry/specTables.js';

export const GENERATOR_NAME = 'khr-itest-gen';
export const GENERATOR_VERSION = '0.1.0';

/** `asset.generator`: name, version and Specification revision (requirements §7.1). */
export const assetGeneratorString = (): string =>
  `${GENERATOR_NAME} ${GENERATOR_VERSION} (KHR_interactivity spec ${SPEC_REVISION})`;
