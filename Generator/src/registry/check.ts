// `khr-itest-gen check-registry`: validates data/ (project spec sections 8 and 14).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { loadCatalogue, type OperationCatalogue } from './catalogue.js';
import { checkInterpretations, type Interpretation } from './interpretations.js';
import { SPEC_REVISION } from './specTables.js';
import {
  checkRegistry,
  countTodo,
  loadRegistryFiles,
  type Registry,
  type RegistryProblem,
} from './targets.js';

/** The generator's data directory: Generator/data, found relative to src/ or dist/. */
export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));

export interface DataSet {
  readonly catalogue: OperationCatalogue;
  readonly registry: Registry;
  readonly interpretations: readonly Interpretation[];
  readonly problems: readonly RegistryProblem[];
  readonly specLineCount: number;
}

export function loadDataSet(dataDir: string = DEFAULT_DATA_DIR): DataSet {
  const specText = readFileSync(`${dataDir}/spec/Specification.adoc`, 'utf8');
  const specLineCount = specText.split(/\r?\n/).length;
  const catalogue = loadCatalogue(`${dataDir}/operations.yaml`);
  const ctx = { specRevision: SPEC_REVISION, specLineCount, catalogue };
  const { registry, problems } = checkRegistry(loadRegistryFiles(`${dataDir}/registry`), ctx);
  const checked = checkInterpretations(parse(readFileSync(`${dataDir}/interpretations.yaml`, 'utf8')), {
    ...ctx,
    registry,
  });
  return {
    catalogue,
    registry,
    interpretations: checked.interpretations,
    problems: [...problems, ...checked.problems],
    specLineCount,
  };
}

/** Human-readable summary for the CLI; returns the text and whether the data is valid. */
export function describeCheck(data: DataSet): { text: string; ok: boolean } {
  const lines = data.problems.map((p) => `${p.file}: ${p.message}`);
  const byKind = new Map<string, number>();
  for (const t of data.registry.targets.values()) byKind.set(t.kind, (byKind.get(t.kind) ?? 0) + 1);
  const kinds = [...byKind.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
  lines.push(
    `${data.catalogue.size} operations; ${data.registry.targets.size} targets (${kinds}); ` +
      `${countTodo(data.registry)} still marked TODO; ${data.interpretations.length} interpretation(s); ` +
      `${data.problems.length} problem(s)`,
  );
  return { text: `${lines.join('\n')}\n`, ok: data.problems.length === 0 };
}
