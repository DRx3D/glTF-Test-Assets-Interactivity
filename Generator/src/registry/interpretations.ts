// Interpretations (requirements §9.5; project spec section 8.4): readings of the Specification
// that a generator relies on but the text does not state directly. Sub-tests that cite one
// are marked `reviewRequired: true`.

import { Ajv2020 } from 'ajv/dist/2020.js';
import type { OperationCatalogue } from './catalogue.js';
import type { RegistryProblem, Registry } from './targets.js';

export interface Interpretation {
  readonly id: string;
  /** Target ids or operation names the reading affects; at least one. */
  readonly affects: readonly string[];
  /** Specification line the reading interprets. */
  readonly specLine: number;
  /** The Specification text, quoted. */
  readonly specText: string;
  /** The reading chosen. */
  readonly reading: string;
}

export interface InterpretationsFile {
  readonly specRevision: string;
  readonly interpretations: readonly Interpretation[];
}

export const interpretationsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['specRevision', 'interpretations'],
  properties: {
    specRevision: { type: 'string', pattern: '^[0-9a-f]{7,40}$' },
    interpretations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'affects', 'specLine', 'specText', 'reading'],
        properties: {
          id: { type: 'string', pattern: '^I-[a-z0-9][a-zA-Z0-9-]*$' },
          affects: { type: 'array', minItems: 1, items: { type: 'string' } },
          specLine: { type: 'integer', minimum: 1 },
          specText: { type: 'string', minLength: 1 },
          reading: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

const validate = new Ajv2020({ allErrors: true, strict: true }).compile(interpretationsSchema);

export interface InterpretationContext {
  readonly specRevision: string;
  readonly specLineCount: number;
  readonly catalogue: OperationCatalogue;
  readonly registry: Registry;
}

/** Validates the parsed file and cross-checks ids, revision, lines and the names in `affects`. */
export function checkInterpretations(
  data: unknown,
  ctx: InterpretationContext,
): { interpretations: readonly Interpretation[]; problems: RegistryProblem[] } {
  const file = 'interpretations.yaml';
  if (!validate(data)) {
    const problems = (validate.errors ?? []).map((e) => ({
      file,
      message: `schema: ${e.instancePath || '/'} ${e.message ?? ''}`.trim(),
    }));
    return { interpretations: [], problems };
  }
  const parsed = data as unknown as InterpretationsFile;
  const problems: RegistryProblem[] = [];
  if (parsed.specRevision !== ctx.specRevision) {
    problems.push({
      file,
      message: `specRevision ${parsed.specRevision} does not match ${ctx.specRevision}`,
    });
  }
  const seen = new Set<string>();
  for (const i of parsed.interpretations) {
    if (seen.has(i.id)) problems.push({ file, message: `duplicate interpretation id ${i.id}` });
    seen.add(i.id);
    if (i.specLine > ctx.specLineCount) {
      problems.push({ file, message: `${i.id}: specLine ${i.specLine} is beyond the Specification` });
    }
    for (const name of i.affects) {
      if (!ctx.registry.targets.has(name) && !ctx.catalogue.has(name)) {
        problems.push({ file, message: `${i.id}: affects unknown target or operation ${name}` });
      }
    }
  }
  return { interpretations: parsed.interpretations, problems };
}
