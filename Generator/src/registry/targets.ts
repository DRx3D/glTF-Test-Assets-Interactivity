// Target registry: types, JSON Schema, loader and cross-reference checks
// (requirements §10.1; project spec section 8.1).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import type { OperationCatalogue } from './catalogue.js';

export const TARGET_KINDS = ['statement', 'type', 'procedure', 'pointer', 'edge'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const SCOPES = ['in', 'out-rejection', 'out-impractical'] as const;
export type Scope = (typeof SCOPES)[number];

/** Coverage status recorded by the coverage report the registry was drafted from. */
export const REVIEW_STATUSES = ['covered', 'partial', 'none'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface Covers {
  readonly op?: string;
  readonly types?: readonly string[];
  readonly valueClasses?: readonly string[];
  readonly comparison?: 'exact' | 'relative' | 'absolute' | 'set' | 'property';
  readonly requires?: readonly string[];
}

export interface Target {
  readonly id: string;
  readonly kind: TargetKind;
  readonly specRef?: { readonly line: number; readonly section: string };
  readonly summary: string;
  readonly scope: Scope;
  /** What a sub-test must do to cover the target; `TODO` until a person fills it in. */
  readonly covers: Covers | 'TODO';
  /** The generator that owns the target; `TODO` until assigned. */
  readonly generator: string;
  readonly reviewStatus?: ReviewStatus;
  readonly isolated?: boolean;
  readonly reviewRequired?: boolean;
  readonly notes?: string;
}

export interface RegistryFile {
  readonly specRevision: string;
  readonly area: string;
  readonly targets: readonly Target[];
}

/** Identifier forms from requirements §10.1. */
export const ID_PATTERNS: Readonly<Record<TargetKind, RegExp>> = {
  statement: /^S-\d+(-[A-Za-z0-9]+)*$/,
  type: /^T-[a-z]+\/[A-Za-z0-9]+-[A-Za-z0-9]+$/,
  procedure: /^P-[a-z]+\/[A-Za-z0-9]+-[A-Za-z0-9]+$/,
  pointer: /^O-\/\S+$/,
  edge: /^E-[a-z]+-[A-Za-z0-9]+$/,
};

export const registryFileSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['specRevision', 'area', 'targets'],
  properties: {
    specRevision: { type: 'string', pattern: '^[0-9a-f]{7,40}$' },
    area: { type: 'string', pattern: '^[a-z]+$' },
    targets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'summary', 'scope', 'covers', 'generator'],
        properties: {
          id: { type: 'string', minLength: 3 },
          kind: { enum: [...TARGET_KINDS] },
          specRef: {
            type: 'object',
            additionalProperties: false,
            required: ['line', 'section'],
            properties: { line: { type: 'integer', minimum: 1 }, section: { type: 'string' } },
          },
          summary: { type: 'string', minLength: 1 },
          scope: { enum: [...SCOPES] },
          covers: {
            oneOf: [
              { const: 'TODO' },
              {
                type: 'object',
                additionalProperties: false,
                properties: {
                  op: { type: 'string' },
                  types: { type: 'array', items: { type: 'string' } },
                  valueClasses: { type: 'array', items: { type: 'string' } },
                  comparison: { enum: ['exact', 'relative', 'absolute', 'set', 'property'] },
                  requires: { type: 'array', items: { type: 'string' } },
                },
              },
            ],
          },
          generator: { type: 'string', pattern: '^(TODO|[a-z]+/[A-Za-z0-9]+)$' },
          reviewStatus: { enum: [...REVIEW_STATUSES] },
          isolated: { type: 'boolean' },
          reviewRequired: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    },
  },
} as const;

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateFile = ajv.compile(registryFileSchema);

export interface RegistryProblem {
  readonly file: string;
  readonly message: string;
}

export interface Registry {
  readonly files: readonly { readonly file: string; readonly data: RegistryFile }[];
  readonly targets: ReadonlyMap<string, Target>;
}

/** Loads every `*.yaml` registry file in a directory, sorted by name. */
export function loadRegistryFiles(dir: string): { file: string; data: unknown }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((file) => ({ file, data: parse(readFileSync(join(dir, file), 'utf8')) as unknown }));
}

export interface CheckContext {
  readonly specRevision: string;
  readonly specLineCount: number;
  readonly catalogue: OperationCatalogue;
}

/**
 * Validates registry files against the schema and cross-checks them: unique ids, id form
 * matching the kind, Specification revision and line numbers, and known operations.
 * Returns the registry and every problem found (an empty list means valid).
 */
export function checkRegistry(
  files: readonly { file: string; data: unknown }[],
  ctx: CheckContext,
): { registry: Registry; problems: RegistryProblem[] } {
  const problems: RegistryProblem[] = [];
  const valid: { file: string; data: RegistryFile }[] = [];
  const targets = new Map<string, Target>();
  const report = (file: string, message: string): void => {
    problems.push({ file, message });
  };

  for (const { file, data } of files) {
    if (!validateFile(data)) {
      for (const err of validateFile.errors ?? []) {
        report(file, `schema: ${err.instancePath || '/'} ${err.message ?? ''}`.trim());
      }
      continue;
    }
    const reg = data as unknown as RegistryFile;
    valid.push({ file, data: reg });
    if (reg.specRevision !== ctx.specRevision) {
      report(file, `specRevision ${reg.specRevision} does not match ${ctx.specRevision}`);
    }
    for (const t of reg.targets) {
      if (targets.has(t.id)) {
        report(file, `duplicate target id ${t.id}`);
      }
      targets.set(t.id, t);
      if (!ID_PATTERNS[t.kind].test(t.id)) {
        report(file, `${t.id}: id does not match the ${t.kind} form`);
      }
      if (t.specRef !== undefined && t.specRef.line > ctx.specLineCount) {
        report(file, `${t.id}: specRef line ${t.specRef.line} is beyond the Specification`);
      }
      if (t.covers !== 'TODO' && t.covers.op !== undefined && !ctx.catalogue.has(t.covers.op)) {
        report(file, `${t.id}: unknown operation ${t.covers.op}`);
      }
      if (t.scope === 'in' && t.reviewStatus !== 'covered' && t.generator === 'TODO' && t.covers !== 'TODO') {
        report(file, `${t.id}: in-scope target with covers but no owning generator`);
      }
    }
  }
  return { registry: { files: valid, targets }, problems };
}

/** Counts targets still waiting for a person: `covers` or `generator` set to TODO. */
export function countTodo(registry: Registry): number {
  let n = 0;
  for (const t of registry.targets.values()) {
    if (t.covers === 'TODO' || t.generator === 'TODO') n++;
  }
  return n;
}
