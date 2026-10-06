// Harness template (requirements §7.2; project spec section 10.3):
//
//   event/onStart ▶ event/send test/onStart {expectedDuration} ▶ flow/sequence
//     ├─ sub-test k: variable/set result ▶ flow/branch(compare(result))
//     │                true  ▶ variable/set HasPassed = true ▶ pointer/set indicator k (pass)
//     │                false ▶ pointer/set indicator k (fail)
//     └─ last: flow/branch(and of every HasPassed) ▶ event/send test/onSuccess | test/onFailed
//
// Each sequence output is an independent chain, so no sub-test can stop another. A sequence
// has at most 64 outputs (requirements §7.7); longer lists are nested.
//
// Only synchronous sub-tests exist so far. Asynchronous sub-tests (Harness_Completed counter
// and the settle flow/setDelay) arrive with the flow, variable and animation generators in M5.

import { obj, type JsonNode } from '../numeric/json.js';
import type { F64 } from '../numeric/value.js';
import {
  config,
  configInts,
  GraphBuilder,
  inline,
  inlineBool,
  inlineFloat,
  orderedSocketIds,
  typeIndexOf,
  type BuiltGraph,
  type NodeHandle,
  type ValueRef,
} from './builder.js';
import { buildComparison, type Comparison } from './compare.js';
import { scalarSource, sentinel, type Scalar, type ScalarType } from './scalar.js';
import type { OperationCatalogue } from '../registry/catalogue.js';

/** Most outputs one flow/sequence may have (requirements §7.7). */
export const MAX_SOCKET_LIST = 64;

export const INDICATOR_COLOURS = {
  initial: [0.5, 0.5, 0.5, 1],
  pass: [0, 1, 0, 1],
  fail: [1, 0, 0, 1],
} as const satisfies Record<string, readonly F64[]>;

export interface HarnessInput {
  readonly socket: string;
  readonly value: Scalar;
  readonly literalNegZero?: boolean;
}

/** A fully resolved synchronous sub-test: one operation applied to scalar inputs. */
export interface HarnessSubTest {
  readonly name: string;
  readonly op: string;
  readonly inputs: readonly HarnessInput[];
  readonly resultType: ScalarType;
  readonly expected: Scalar;
  readonly comparison: Comparison;
}

export interface HarnessOptions {
  /** `<category>/<asset>`, the variable-name prefix (project spec section 10.3). */
  readonly testName: string;
  /** Seconds; 0 when every sub-test is synchronous. */
  readonly expectedDuration: F64;
}

export interface HarnessResult {
  readonly graph: BuiltGraph;
  /** Variable indices for each sub-test, in sub-test order. */
  readonly variables: readonly { readonly result: number; readonly passed: number }[];
  /** Serialised index of the event/onStart node (the test's entry point). */
  readonly onStartNode: number;
}

export const resultVariableName = (testName: string, subTest: string): string =>
  `TestResult_${testName}_${subTest}`;
export const passVariableName = (testName: string, subTest: string): string =>
  `TestResult_HasPassed_${testName}_${subTest}`;

const indicatorPointer = (material: number): string =>
  `/materials/${material}/pbrMetallicRoughness/baseColorFactor`;

/** The KHR_interactivity extension object for one asset, with its single graph. */
export function buildHarness(
  catalogue: OperationCatalogue,
  subTests: readonly HarnessSubTest[],
  options: HarnessOptions,
): HarnessResult {
  const g = new GraphBuilder(catalogue);
  const startEvent = g.event('test/onStart', [['expectedDuration', inlineFloat(options.expectedDuration)]]);
  const successEvent = g.event('test/onSuccess');
  const failedEvent = g.event('test/onFailed');

  const variables = subTests.map((st) => ({
    passed: g.variable(passVariableName(options.testName, st.name), 'bool', [false]),
    result: g.variable(resultVariableName(options.testName, st.name), st.resultType, [
      sentinel(st.expected).value,
    ]),
  }));

  const onStart = g.node('event/onStart', 'harness');
  const sendStart = g.node('event/send', 'harness', {
    configuration: [['event', configInts(startEvent)]],
    values: { expectedDuration: inlineFloat(options.expectedDuration) },
  });
  g.flow(onStart, 'out', sendStart);

  const entries: NodeHandle[] = subTests.map((st, k) =>
    subTestChain(g, st, k, variables[k] as { result: number; passed: number }),
  );
  entries.push(report(g, variables, successEvent, failedEvent));
  g.flow(sendStart, 'out', sequenceTree(g, entries));

  const graph = g.build();
  return { graph, variables, onStartNode: graph.indexOf(onStart) };
}

function subTestChain(
  g: GraphBuilder,
  st: HarnessSubTest,
  index: number,
  vars: { result: number; passed: number },
): NodeHandle {
  const values = Object.fromEntries(
    st.inputs.map((input) => [
      input.socket,
      scalarSource(g, input.value, 'setup', input.literalNegZero === true ? { literalNegZero: true } : {}),
    ]),
  );
  const subject = g.pure(st.op, 'subject', values, st.resultType);
  const setResult = g.node('variable/set', 'harness', {
    configuration: [['variables', configInts(vars.result)]],
    values: { [String(vars.result)]: subject },
  });
  const actual: ValueRef = g.pure('variable/get', 'harness', {}, st.resultType, [
    ['variable', configInts(vars.result)],
  ]);
  const cmp = buildComparison(g, actual, st.expected, st.comparison, {
    op: st.op,
    inputTypes: st.inputs.map((i) => i.value.type),
  });
  const branch = g.node('flow/branch', 'harness', { values: { condition: cmp.condition } });
  g.flow(setResult, 'out', branch);

  const setPassed = g.node('variable/set', 'harness', {
    configuration: [['variables', configInts(vars.passed)]],
    values: { [String(vars.passed)]: inlineBool(true) },
  });
  const indicator = (colour: readonly F64[]): NodeHandle =>
    g.node('pointer/set', 'harness', {
      configuration: [
        ['pointer', config(indicatorPointer(index))],
        ['type', typeIndexOf('float4')],
      ],
      values: { value: inline('float4', colour) },
    });
  const passIndicator = indicator(INDICATOR_COLOURS.pass);
  const failIndicator = indicator(INDICATOR_COLOURS.fail);
  g.flow(branch, cmp.invert ? 'false' : 'true', setPassed);
  g.flow(branch, cmp.invert ? 'true' : 'false', failIndicator);
  g.flow(setPassed, 'out', passIndicator);
  return setResult;
}

/** Sends test/onSuccess if every HasPassed variable is true, otherwise test/onFailed. */
function report(
  g: GraphBuilder,
  vars: readonly { passed: number }[],
  success: number,
  failed: number,
): NodeHandle {
  const passed = vars.map((v) =>
    g.pure('variable/get', 'harness', {}, 'bool', [['variable', configInts(v.passed)]]),
  );
  const all: ValueRef =
    passed.length === 0
      ? g.pure('math/not', 'harness', { a: inlineBool(false) }, 'bool')
      : passed.reduce((acc, p) => g.pure('math/and', 'harness', { a: acc, b: p }, 'bool'));
  const branch = g.node('flow/branch', 'harness', { values: { condition: all } });
  const send = (event: number): NodeHandle =>
    g.node('event/send', 'harness', { configuration: [['event', configInts(event)]] });
  g.flow(branch, 'true', send(success));
  g.flow(branch, 'false', send(failed));
  return branch;
}

/** A flow/sequence (nested when needed) that activates `entries` in order. */
function sequenceTree(g: GraphBuilder, entries: readonly NodeHandle[]): NodeHandle {
  let level: readonly NodeHandle[] = entries;
  do {
    const groups: NodeHandle[] = [];
    for (let at = 0; at < level.length; at += MAX_SOCKET_LIST) {
      const chunk = level.slice(at, at + MAX_SOCKET_LIST);
      const seq = g.node('flow/sequence', 'harness');
      const ids = orderedSocketIds(chunk.length);
      chunk.forEach((entry, k) => g.flow(seq, ids[k] as string, entry));
      groups.push(seq);
    }
    level = groups;
  } while (level.length > 1);
  return level[0] as NodeHandle;
}

/** The extension object written under `extensions.KHR_interactivity` (one graph, §7.1). */
export const interactivityExtension = (graph: BuiltGraph): JsonNode => obj([['graphs', [graph.json]]]);
