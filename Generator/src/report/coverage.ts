// supplemental-coverage.json and supplemental-coverage.md (requirements §13; project spec
// section 13.3). The JSON is the source of truth; the Markdown is rendered from the same
// data by a pure function. Neither contains file system paths or times.

import { f64, i32, obj, writeCanonicalJson, type JsonNode } from '../numeric/json.js';
import { int } from '../numeric/value.js';
import type { BuiltAsset } from '../asset/build.js';
import { seedText } from '../asset/oracle.js';
import type { CoverageMapping } from '../existing/coverage.js';
import type { Limits, Tolerances } from '../generators/types.js';
import type { Interpretation } from '../registry/interpretations.js';
import { SPEC_REVISION } from '../registry/specTables.js';
import type { TargetOutcome } from '../validate/coverage.js';
import { GENERATOR_NAME, GENERATOR_VERSION } from '../version.js';

export interface ReportInput {
  readonly suiteRevision: string;
  readonly seed: bigint;
  readonly copyright: string;
  readonly limits: Limits;
  readonly tolerances: Tolerances;
  /** True for `--only` runs (project spec section 14). */
  readonly partial: boolean;
  readonly built: readonly BuiltAsset[];
  readonly outcomes: readonly TargetOutcome[];
  readonly mapping: CoverageMapping;
  readonly interpretations: readonly Interpretation[];
}

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const n = (x: number): JsonNode => i32(int(x));

interface MatrixRow {
  readonly op: string;
  readonly type: string;
  readonly cells: ReadonlyMap<string, 'S'>;
}

/** Per operation and input type, the value classes supplemental sub-tests exercise. */
function matrix(built: readonly BuiltAsset[]): MatrixRow[] {
  const rows = new Map<string, Map<string, 'S'>>();
  for (const b of built) {
    for (const st of b.asset.subTests) {
      const key = `${st.op}\u0000${st.inputs.map((i) => i.value.type).join(',') || '-'}`;
      const cells = rows.get(key) ?? new Map<string, 'S'>();
      for (const c of st.valueClasses) cells.set(c, 'S');
      rows.set(key, cells);
    }
  }
  return [...rows.keys()].sort(byCode).map((key) => {
    const [op = '', type = ''] = key.split('\u0000');
    return { op, type, cells: rows.get(key) ?? new Map() };
  });
}

export function coverageJson(input: ReportInput): string {
  const categories = [...new Set(input.built.map((b) => b.asset.category))].sort(byCode);
  const reviewRequired = input.built.flatMap((b) =>
    b.asset.subTests
      .filter((st) => st.interpretations.length > 0)
      .map((st) =>
        obj([
          ['asset', b.index.name],
          ['subTest', st.name],
          [
            'interpretations',
            st.interpretations.map((id) =>
              obj([
                ['id', id],
                ['reading', input.interpretations.find((i) => i.id === id)?.reading ?? ''],
              ]),
            ),
          ],
        ]),
      ),
  );
  const doc = obj([
    [
      'inputs',
      obj([
        [
          'generator',
          obj([
            ['name', GENERATOR_NAME],
            ['version', GENERATOR_VERSION],
          ]),
        ],
        ['specRevision', SPEC_REVISION],
        ['suiteRevision', input.suiteRevision],
        ['seed', seedText(input.seed)],
        ['copyright', input.copyright],
        ['partial', input.partial],
        [
          'limits',
          obj([
            ['maxSubTests', n(input.limits.maxSubTests)],
            ['maxNodes', n(input.limits.maxNodes)],
            ['maxEnumeration', n(input.limits.maxEnumeration)],
            ['preferredExpectedDuration', f64(input.limits.preferredExpectedDuration)],
            ['maxExpectedDuration', f64(input.limits.maxExpectedDuration)],
            ['timeTolerance', f64(input.limits.timeTolerance)],
            ['referenceBits', n(input.limits.referenceBits)],
          ]),
        ],
        [
          'tolerances',
          obj([
            [
              'transcendental',
              obj([
                ['r', f64(input.tolerances.transcendental.r)],
                ['a', f64(input.tolerances.transcendental.a)],
              ]),
            ],
            [
              'composite',
              obj([
                ['r', f64(input.tolerances.composite.r)],
                ['a', f64(input.tolerances.composite.a)],
              ]),
            ],
          ]),
        ],
      ]),
    ],
    [
      'counts',
      obj([
        ['assets', n(input.built.length)],
        ['subTests', n(input.built.reduce((s, b) => s + b.asset.subTests.length, 0))],
        [
          'byCategory',
          obj(
            categories.map((c) => {
              const inCat = input.built.filter((b) => b.asset.category === c);
              return [
                c,
                obj([
                  ['assets', n(inCat.length)],
                  ['subTests', n(inCat.reduce((s, b) => s + b.asset.subTests.length, 0))],
                ]),
              ];
            }),
          ),
        ],
      ]),
    ],
    [
      'targets',
      [...input.outcomes]
        .sort((a, b) => byCode(a.target.id, b.target.id))
        .map((o) => {
          const fields: [string, JsonNode][] = [
            ['id', o.target.id],
            ['scope', o.target.scope],
            ['status', o.status],
            ['coveredBy', [...o.coveredBy]],
          ];
          if (o.reason !== undefined) fields.push(['reason', o.reason]);
          return obj(fields);
        }),
    ],
    [
      'typeValueClassMatrix',
      matrix(input.built).map((r) =>
        obj([
          ['op', r.op],
          ['inputTypes', r.type],
          ['cells', obj([...r.cells.keys()].sort(byCode).map((c) => [c, r.cells.get(c) ?? 'S']))],
        ]),
      ),
    ],
    [
      'existingCredits',
      [
        ...input.mapping.subTests.map((e) => {
          const fields: [string, JsonNode][] = [
            ['asset', e.asset],
            ['subTest', e.subTest],
            ['credits', [...e.credits]],
          ];
          if (e.note !== undefined) fields.push(['note', e.note]);
          return obj(fields);
        }),
        ...input.mapping.invalid.map((e) =>
          obj([
            ['invalidCase', e.id],
            ['credits', [...e.credits]],
          ]),
        ),
      ],
    ],
    ['reviewRequired', reviewRequired],
    // Engine adapters arrive with M5; until then there are no disagreements to record.
    ['adapterDisagreements', []],
  ]);
  return writeCanonicalJson(doc, { context: 'oracle', indent: 2 });
}

const cell = (s: string): string => s.replace(/\|/g, '\\|');

export function coverageMarkdown(input: ReportInput): string {
  const count = (s: string): number => input.outcomes.filter((o) => o.status === s).length;
  const lines = [
    '# Supplemental coverage report',
    '',
    `Generator ${GENERATOR_NAME} ${GENERATOR_VERSION}; Specification ${SPEC_REVISION}; suite ${input.suiteRevision}; seed ${seedText(input.seed)}.`,
    '',
    input.copyright,
    ...(input.partial ? ['', '**Partial run** (`--only`): V4 was not checked.'] : []),
    '',
    '## Counts',
    '',
    `${input.built.length} assets, ${input.built.reduce((s, b) => s + b.asset.subTests.length, 0)} sub-tests.`,
    '',
    '| Category | Assets | Sub-tests |',
    '| --- | --- | --- |',
    ...[...new Set(input.built.map((b) => b.asset.category))].sort(byCode).map((c) => {
      const inCat = input.built.filter((b) => b.asset.category === c);
      return `| ${c} | ${inCat.length} | ${inCat.reduce((s, b) => s + b.asset.subTests.length, 0)} |`;
    }),
    '',
    '## Targets',
    '',
    `${count('covered-existing')} covered by the existing suite, ${count('covered-supplemental')} by supplemental assets, ${count('not-covered')} not covered.`,
    '',
    '| Target | Scope | Status | Covered by or reason |',
    '| --- | --- | --- | --- |',
    ...[...input.outcomes]
      .sort((a, b) => byCode(a.target.id, b.target.id))
      .map((o) => {
        const detail = o.status === 'not-covered' ? (o.reason ?? '') : o.coveredBy.join('; ');
        return `| ${cell(o.target.id)} | ${o.target.scope} | ${o.status} | ${cell(detail)} |`;
      }),
    '',
    '## Type and value-class matrix (supplemental)',
    '',
    '| Operation | Input types | Value classes |',
    '| --- | --- | --- |',
    ...matrix(input.built).map(
      (r) => `| ${r.op} | ${r.type} | ${[...r.cells.keys()].sort(byCode).join(', ')} |`,
    ),
    '',
    '## Existing credits',
    '',
    `${input.mapping.subTests.length} sub-test credits and ${input.mapping.invalid.length} invalid-case credits; the JSON report lists each one.`,
    '',
    '## Review required',
    '',
    ...(input.built.some((b) => b.asset.subTests.some((st) => st.interpretations.length > 0))
      ? input.built.flatMap((b) =>
          b.asset.subTests
            .filter((st) => st.interpretations.length > 0)
            .map((st) => `- ${b.index.name} / ${st.name}: ${st.interpretations.join(', ')}`),
        )
      : ['None.']),
    '',
    '## Adapter disagreements',
    '',
    'None recorded (no adapter run).',
    '',
  ];
  return lines.join('\n');
}
