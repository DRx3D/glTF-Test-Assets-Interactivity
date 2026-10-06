// Writes the reduced registry and coverage mapping for the golden test (project spec section
// 15) from the real data files, so the golden inputs stay consistent with data/:
//
//   npx tsx tools/make-golden-inputs.ts
//
// The golden set mixes targets the supplemental generators cover, targets they report as not
// coverable, targets the existing suite covers, rejection targets and an impractical target.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import type { CoverageMapping } from '../src/existing/coverage.js';
import type { RegistryFile } from '../src/registry/targets.js';
import { loadRegistryFiles } from '../src/registry/targets.js';

export const GOLDEN_TARGETS: readonly string[] = [
  // Covered by the M3 math/div generator.
  'S-2626',
  // Owned by math/div but not coverable until R1 is decided.
  'T-math/div-float2',
  'T-math/div-float4x4',
  // Covered by the existing suite through the mapping.
  'S-3203',
  'S-3205',
  'S-568',
  'S-184',
  'S-3891',
  'S-4352',
  'S-4423',
];

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
const dataDir = here('../data/');
const outDir = here('../test/golden/');

function main(): void {
  const files = loadRegistryFiles(`${dataDir}registry`).map((f) => ({
    file: f.file,
    data: f.data as RegistryFile,
  }));
  const all = files.flatMap((f) => f.data.targets);
  // One rejection target credited by an invalid case, one not, and one impractical target.
  const mapping = parse(readFileSync(`${dataDir}existing-coverage.yaml`, 'utf8')) as CoverageMapping;
  const creditedRejection = mapping.invalid[0]?.credits[0];
  const credited = new Set(mapping.invalid.flatMap((e) => e.credits));
  const uncreditedRejection = all.find((t) => t.scope === 'out-rejection' && !credited.has(t.id))?.id;
  const impractical = all.find((t) => t.scope === 'out-impractical')?.id;
  const wanted = new Set(
    [...GOLDEN_TARGETS, creditedRejection, uncreditedRejection, impractical].filter(
      (x): x is string => x !== undefined,
    ),
  );

  rmSync(`${outDir}registry`, { recursive: true, force: true });
  mkdirSync(`${outDir}registry`, { recursive: true });
  for (const { file, data } of files) {
    const targets = data.targets.filter((t) => wanted.has(t.id));
    if (targets.length === 0) continue;
    writeFileSync(
      `${outDir}registry/${file}`,
      `# Golden-test subset of data/registry/${file}; regenerate with tools/make-golden-inputs.ts.\n${stringify({ ...data, targets })}`,
    );
  }
  const reduced: CoverageMapping = {
    suiteRevision: mapping.suiteRevision,
    subTests: mapping.subTests
      .map((e) => ({ ...e, credits: e.credits.filter((id) => wanted.has(id)) }))
      .filter((e) => e.credits.length > 0),
    invalid: mapping.invalid
      .map((e) => ({ ...e, credits: e.credits.filter((id) => wanted.has(id)) }))
      .filter((e) => e.credits.length > 0),
  };
  writeFileSync(
    `${outDir}existing-coverage.yaml`,
    `# Golden-test subset of data/existing-coverage.yaml; regenerate with tools/make-golden-inputs.ts.\n${stringify(reduced)}`,
  );
  process.stdout.write(
    `${wanted.size} targets, ${reduced.subTests.length} sub-test credits, ${reduced.invalid.length} invalid credits\n`,
  );
}

main();
