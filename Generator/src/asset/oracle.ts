// Oracle file (requirements §7.4; project spec section 11.3). It follows the nested schema
// the existing suite uses on disk (tests[].subTests[] with entryPoints), which existing
// runners read, plus the supplemental properties. Pending R2, project spec section 18.

import { f64, i32, obj, writeCanonicalJson, type JsonNode } from '../numeric/json.js';
import { int } from '../numeric/value.js';
import type { Comparison } from '../graph/compare.js';
import { passVariableName, resultVariableName, type HarnessResult } from '../graph/harness.js';
import { scalarOracle } from '../graph/scalar.js';
import { SPEC_REVISION } from '../registry/specTables.js';
import { GENERATOR_NAME, GENERATOR_VERSION } from '../version.js';
import { testName, type ResolvedAsset } from './model.js';

/** `0x` followed by 16 upper-case hex digits. */
export const seedText = (seed: bigint): string => `0x${seed.toString(16).toUpperCase().padStart(16, '0')}`;

/** Operations declared in the asset, sorted by code unit (usedSchemas and index tags). */
export const usedSchemas = (harness: HarnessResult): string[] =>
  [...harness.graph.declarations].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

function comparisonJson(c: Comparison): JsonNode {
  switch (c.mode) {
    case 'exact':
      return obj([['mode', 'exact']]);
    case 'relative':
      return obj([
        ['mode', 'relative'],
        ['r', f64(c.r)],
        ['a', f64(c.a)],
      ]);
    case 'absolute':
      return obj([
        ['mode', 'absolute'],
        ['a', f64(c.a)],
      ]);
    case 'set': {
      const fields: [string, JsonNode][] = [
        ['mode', 'set'],
        ['inner', c.inner],
        ['values', c.values.map((v) => [scalarOracle(v)])],
      ];
      if (c.r !== undefined) fields.push(['r', f64(c.r)]);
      if (c.a !== undefined) fields.push(['a', f64(c.a)]);
      return obj(fields);
    }
  }
}

export interface OracleInput {
  readonly asset: ResolvedAsset;
  readonly harness: HarnessResult;
  readonly seed: bigint;
}

export function oracleJson({ asset, harness, seed }: OracleInput): string {
  const name = testName(asset);
  const schemas = usedSchemas(harness);
  const subTests = asset.subTests.map((st, k) => {
    const vars = harness.variables[k] as { result: number; passed: number };
    const fields: [string, JsonNode][] = [
      ['name', st.name],
      ['resultVarName', resultVariableName(name, st.name)],
      ['resultVarId', i32(int(vars.result))],
      ['resultVarType', st.resultType],
      // A set comparison shows its first permitted value here (project spec section 11.3).
      [
        'expectedResultValue',
        [scalarOracle(st.comparison.mode === 'set' ? (st.comparison.values[0] ?? st.expected) : st.expected)],
      ],
      ['successResultVarId', i32(int(vars.passed))],
      ['successResultVarName', passVariableName(name, st.name)],
      ['comparison', comparisonJson(st.comparison)],
      ['targets', [...st.targets]],
      [
        'specRefs',
        st.specRefs.map((r) =>
          obj([
            ['revision', r.revision],
            ['line', i32(int(r.line))],
            ['section', r.section],
          ]),
        ),
      ],
      ['valueClasses', [...st.valueClasses]],
      [
        'inputs',
        st.inputs.map((input) =>
          obj([
            ['socket', input.socket],
            ['type', input.value.type],
            ['value', [scalarOracle(input.value)]],
          ]),
        ),
      ],
    ];
    if (st.interpretations.length > 0) fields.push(['reviewRequired', true]);
    return obj(fields);
  });

  const doc = obj([
    ['glbFileName', `${asset.name}.glb`],
    ['name', name],
    ['supplemental', true],
    [
      'generator',
      obj([
        ['name', GENERATOR_NAME],
        ['version', GENERATOR_VERSION],
        ['specRevision', SPEC_REVISION],
        ['seed', seedText(seed)],
      ]),
    ],
    [
      'tests',
      [
        obj([
          ['name', name],
          ['description', asset.description],
          ['usedSchemas', schemas],
          // One entry point, the event/onStart node; none needs user interaction (§7.4).
          [
            'entryPoints',
            [
              obj([
                ['name', name],
                ['nodeId', i32(int(harness.onStartNode))],
              ]),
            ],
          ],
          ['subTests', subTests],
        ]),
      ],
    ],
    ['usedSchemas', schemas],
  ]);
  return writeCanonicalJson(doc, { context: 'oracle', indent: 2 });
}
