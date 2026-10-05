// Existing-coverage mapping and gap determination (requirements §11; project spec sections 8.3, 9.3).
// Credit comes only from data/existing-coverage.yaml; nothing is inferred at generation time.

import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import type { Registry, Target } from '../registry/targets.js';
import type { Inventory } from './reader.js';

export interface CoverageMapping {
  readonly suiteRevision: string;
  /** Runnable sub-tests that cover targets. */
  readonly subTests: readonly {
    readonly asset: string;
    readonly subTest: string;
    readonly credits: readonly string[];
    readonly note?: string;
  }[];
  /** Invalid-graph cases that cover rejection targets (reporting only, requirements §11). */
  readonly invalid: readonly { readonly id: string; readonly credits: readonly string[] }[];
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['suiteRevision', 'subTests', 'invalid'],
  properties: {
    suiteRevision: { type: 'string', pattern: '^[0-9a-f]{7,40}$' },
    subTests: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['asset', 'subTest', 'credits'],
        properties: {
          asset: { type: 'string' },
          subTest: { type: 'string' },
          credits: { type: 'array', minItems: 1, items: { type: 'string' } },
          note: { type: 'string' },
        },
      },
    },
    invalid: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'credits'],
        properties: {
          id: { type: 'string' },
          credits: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
    },
  },
} as const;

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

export function loadCoverageMapping(path: string | URL): CoverageMapping {
  const data = parse(readFileSync(path, 'utf8')) as unknown;
  if (!validate(data)) {
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`);
    throw new Error(`existing-coverage.yaml: ${errors.join('; ')}`);
  }
  return data as unknown as CoverageMapping;
}

export type TargetStatus =
  'covered-existing' | 'gap' | 'rejection-covered-invalid' | 'rejection-not-covered' | 'impractical';

export interface TargetCoverage {
  readonly target: Target;
  readonly status: TargetStatus;
  /** "asset / sub-test" names or invalid-case ids that credit the target. */
  readonly creditedBy: readonly string[];
}

export interface GapReport {
  readonly targets: readonly TargetCoverage[];
  readonly problems: readonly string[];
}

const key = (asset: string, subTest: string): string => `${asset} / ${subTest}`;

/**
 * Determines, for every registry target, whether the existing suite covers it.
 * Mapping problems (stale sub-tests, unknown targets, type mismatches) are reported, not fatal.
 */
export function determineGaps(registry: Registry, inventory: Inventory, mapping: CoverageMapping): GapReport {
  const problems: string[] = [];
  const subTests = new Map(inventory.subTests.map((s) => [key(s.asset, s.name), s]));
  const invalidIds = new Set(inventory.invalidCases.map((c) => c.id));
  const credits = new Map<string, string[]>();
  const credit = (targetId: string, by: string): void => {
    const list = credits.get(targetId) ?? [];
    list.push(by);
    credits.set(targetId, list);
  };

  for (const entry of mapping.subTests) {
    const k = key(entry.asset, entry.subTest);
    const st = subTests.get(k);
    if (st === undefined) {
      problems.push(`stale mapping: no sub-test ${k}`);
      continue;
    }
    for (const id of entry.credits) {
      const target = registry.targets.get(id);
      if (target === undefined) {
        problems.push(`${k}: credits unknown target ${id}`);
        continue;
      }
      // §9.3 mechanical check: the sub-test's result type must be one the target asks for.
      const types = target.covers === 'TODO' ? undefined : target.covers.types;
      if (types !== undefined && !types.includes(st.resultVar.type)) {
        problems.push(`${k}: result type ${st.resultVar.type} cannot cover ${id} (${types.join(', ')})`);
        continue;
      }
      credit(id, k);
    }
  }
  for (const entry of mapping.invalid) {
    if (!invalidIds.has(entry.id)) {
      problems.push(`stale mapping: no invalid case ${entry.id}`);
      continue;
    }
    for (const id of entry.credits) {
      const target = registry.targets.get(id);
      if (target === undefined) {
        problems.push(`invalid ${entry.id}: credits unknown target ${id}`);
      } else if (target.scope !== 'out-rejection') {
        problems.push(`invalid ${entry.id}: ${id} is not a rejection target`);
      } else {
        credit(id, entry.id);
      }
    }
  }

  const targets = [...registry.targets.values()].map((target): TargetCoverage => {
    const by = credits.get(target.id) ?? [];
    let status: TargetStatus;
    if (target.scope === 'out-impractical') status = 'impractical';
    else if (target.scope === 'out-rejection')
      status = by.length > 0 ? 'rejection-covered-invalid' : 'rejection-not-covered';
    else status = by.length > 0 ? 'covered-existing' : 'gap';
    return { target, status, creditedBy: by };
  });
  return { targets, problems };
}

/** One-screen summary for `khr-itest-gen gaps`. */
export function describeGaps(report: GapReport, inventory: Inventory): string {
  const count = (s: TargetStatus): number => report.targets.filter((t) => t.status === s).length;
  const lines = [
    `Existing suite: ${inventory.subTests.length} sub-tests, ${inventory.invalidCases.length} invalid-graph cases`,
    `Targets: ${report.targets.length}`,
    `  in scope:  ${count('covered-existing')} covered by existing sub-tests, ${count('gap')} gaps`,
    `  rejection: ${count('rejection-covered-invalid')} covered by invalid cases, ${count('rejection-not-covered')} not covered`,
    `  impractical: ${count('impractical')}`,
  ];
  const gapsByArea = new Map<string, string[]>();
  for (const t of report.targets.filter((x) => x.status === 'gap')) {
    const area = t.target.id.startsWith('T-') ? 'type signatures' : (t.target.id.split('-')[0] ?? '');
    const list = gapsByArea.get(area) ?? [];
    list.push(t.target.id);
    gapsByArea.set(area, list);
  }
  for (const [area, ids] of [...gapsByArea.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    lines.push(`gaps (${area}, ${ids.length}): ${ids.join(' ')}`);
  }
  for (const p of report.problems) lines.push(`problem: ${p}`);
  return `${lines.join('\n')}\n`;
}
