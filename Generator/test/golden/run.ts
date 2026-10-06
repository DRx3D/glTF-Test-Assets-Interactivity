// Runs the pipeline on the golden inputs (reduced registry and mapping, real suite). Shared
// by the golden test and the engine test so both see the same output.

import { fileURLToPath } from 'node:url';
import { DEFAULT_DATA_DIR } from '../../src/registry/check.js';
import { defaultSuiteRoot } from '../../src/existing/reader.js';
import { DEFAULT_LIMITS, DEFAULT_TOLERANCES } from '../../src/generators/types.js';
import {
  dataPaths,
  runPipeline,
  type PipelineInput,
  type PipelineResult,
} from '../../src/generate/pipeline.js';
import { DEFAULT_SEED } from '../../src/prng/splitmix64.js';

export const GOLDEN_DIR = fileURLToPath(new URL('./', import.meta.url));
export const GOLDEN_OUT = fileURLToPath(new URL('./out/', import.meta.url));

export const goldenInput = (): PipelineInput => ({
  ...dataPaths(DEFAULT_DATA_DIR),
  registryDir: `${GOLDEN_DIR}registry`,
  coveragePath: `${GOLDEN_DIR}existing-coverage.yaml`,
  suiteRoot: defaultSuiteRoot(DEFAULT_DATA_DIR),
  seed: DEFAULT_SEED,
  copyrightOwner: 'The Khronos Group Inc.',
  copyrightYear: 2026,
  limits: DEFAULT_LIMITS,
  tolerances: DEFAULT_TOLERANCES,
});

let cached: Promise<PipelineResult> | undefined;

/** The golden run, computed once per test process. */
export const goldenRun = (): Promise<PipelineResult> => (cached ??= runPipeline(goldenInput()));
