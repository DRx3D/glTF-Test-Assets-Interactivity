// Per-asset self-checks (requirements §12; project spec section 13.1). Each runs on the
// in-memory files, re-parsing them as a consumer would, and reports every failure it finds.
// V4 and V5 need the whole run and live in coverage.ts.

import validator from 'gltf-validator';
import type { ValidateFunction } from 'ajv/dist/2020.js';
import { sameBits } from '../numeric/f64.js';
import { readGlb } from '../asset/glb.js';
import type { BuiltAsset } from '../asset/build.js';
import type { Scalar } from '../graph/scalar.js';
import { MAX_SOCKET_LIST } from '../graph/harness.js';
import type { Limits } from '../generators/types.js';

export type CheckId = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9';

export interface CheckMessage {
  readonly check: CheckId;
  /** The asset path (`<category>/<asset>`), or undefined for run-level checks. */
  readonly asset?: string;
  readonly message: string;
}

export interface CheckResult {
  readonly failures: readonly CheckMessage[];
  readonly warnings: readonly CheckMessage[];
}

/** The harness operation set (requirements §7.2). */
export const HARNESS_OPS: ReadonlySet<string> = new Set([
  'event/onStart',
  'event/onTick',
  'event/send',
  'flow/sequence',
  'flow/branch',
  'flow/setDelay',
  'variable/get',
  'variable/set',
  'math/eq',
  'math/and',
  'math/not',
  'math/lt',
  'math/le',
  'math/abs',
  'math/sub',
  'math/mul',
  'math/max',
  'math/div',
  'math/neg',
  'math/isNaN',
  'math/Inf',
  'math/NaN',
  'pointer/set',
]);

interface ParsedSocket {
  readonly node?: number;
  readonly socket?: string;
  readonly type?: number;
  readonly value?: readonly unknown[];
}
interface ParsedNode {
  readonly declaration: number;
  readonly configuration?: Record<string, { readonly value: readonly unknown[] }>;
  readonly values?: Record<string, ParsedSocket>;
  readonly flows?: Record<string, { readonly node: number; readonly socket?: string }>;
}
interface ParsedGraph {
  readonly types?: readonly { readonly signature: string }[];
  readonly variables?: readonly { readonly name?: string; readonly type: number }[];
  readonly declarations?: readonly { readonly op: string }[];
  readonly nodes?: readonly ParsedNode[];
}
interface ParsedOracleSubTest {
  readonly name: string;
  readonly resultVarName: string;
  readonly resultVarId: number;
  readonly resultVarType: string;
  readonly expectedResultValue: readonly unknown[];
  readonly successResultVarId: number;
  readonly successResultVarName: string;
  readonly inputs: readonly {
    readonly socket: string;
    readonly type: string;
    readonly value: readonly unknown[];
  }[];
}
interface ParsedOracle {
  readonly tests: readonly { readonly subTests: readonly ParsedOracleSubTest[] }[];
}

/** An oracle value as the reader sees it: special floats are strings (requirements §7.4). */
const oracleNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v;
  if (v === 'NaN') return NaN;
  if (v === 'Infinity') return Infinity;
  if (v === '-Infinity') return -Infinity;
  if (v === '-0') return -0;
  return undefined;
};

const matchesScalar = (parsed: unknown, s: Scalar, oracle: boolean): boolean => {
  if (s.type === 'bool') return parsed === s.value;
  const x = oracle ? oracleNumber(parsed) : typeof parsed === 'number' ? parsed : undefined;
  if (x === undefined) return false;
  return s.type === 'float' && Number.isNaN(s.value) ? Number.isNaN(x) : sameBits(x, s.value);
};

function graphOf(built: BuiltAsset): ParsedGraph {
  const doc = JSON.parse(readGlb(built.glb).json) as {
    extensions: { KHR_interactivity: { graphs: ParsedGraph[] } };
  };
  const g = doc.extensions.KHR_interactivity.graphs[0];
  if (g === undefined) throw new Error('no graph');
  return g;
}

export async function checkAsset(
  built: BuiltAsset,
  schema: ValidateFunction,
  limits: Limits,
): Promise<CheckResult> {
  const name = built.index.name;
  const failures: CheckMessage[] = [];
  const warnings: CheckMessage[] = [];
  const fail = (check: CheckId, message: string): void => void failures.push({ check, asset: name, message });
  const warn = (check: CheckId, message: string): void => void warnings.push({ check, asset: name, message });

  // V1: glTF Validator, zero errors.
  const report = await validator.validateBytes(built.glb);
  for (const m of report.issues.messages) {
    const text = `${m.code}${m.pointer === undefined ? '' : ` at ${m.pointer}`}: ${m.message}`;
    if (m.severity === 0) fail('V1', text);
    else if (m.severity === 1) warn('V1', text);
  }

  const doc = JSON.parse(readGlb(built.glb).json) as { extensions?: { KHR_interactivity?: unknown } };
  // V2: KHR_interactivity schema.
  if (!schema(doc.extensions?.KHR_interactivity)) {
    for (const e of schema.errors ?? []) fail('V2', `${e.instancePath || '/'} ${e.message ?? ''}`.trim());
  }

  const graph = graphOf(built);
  const types = graph.types ?? [];
  const variables = graph.variables ?? [];
  const nodes = graph.nodes ?? [];
  const declarations = graph.declarations ?? [];
  const opAt = (k: number): string => declarations[nodes[k]?.declaration ?? -1]?.op ?? '?';
  const oracle = JSON.parse(built.oracle) as ParsedOracle;
  const parsedSubTests = oracle.tests.flatMap((t) => t.subTests);

  // V3: oracle variables match the GLB.
  for (const st of parsedSubTests) {
    const check = (id: number, varName: string, type: string): void => {
      const v = variables[id];
      if (v === undefined) return fail('V3', `${st.name}: no variable ${id}`);
      if (v.name !== varName)
        fail('V3', `${st.name}: variable ${id} is named ${v.name ?? '(none)'}, not ${varName}`);
      const sig = types[v.type]?.signature;
      if (sig !== type) fail('V3', `${st.name}: variable ${id} has type ${sig ?? '?'}, not ${type}`);
    };
    check(st.resultVarId, st.resultVarName, st.resultVarType);
    check(st.successResultVarId, st.successResultVarName, 'bool');
  }

  // V6: structural limits.
  if (built.asset.subTests.length > limits.maxSubTests)
    fail('V6', `${built.asset.subTests.length} sub-tests exceed ${limits.maxSubTests}`);
  if (nodes.length > limits.maxNodes) fail('V6', `${nodes.length} nodes exceed ${limits.maxNodes}`);
  nodes.forEach((node, k) => {
    const op = opAt(k);
    if (op === 'flow/sequence' && Object.keys(node.flows ?? {}).length > MAX_SOCKET_LIST) {
      fail('V6', `node ${k}: flow/sequence has more than ${MAX_SOCKET_LIST} outputs`);
    }
    const listed = node.configuration?.['variables']?.value.length ?? 0;
    if (listed > MAX_SOCKET_LIST) fail('V6', `node ${k}: ${op} lists more than ${MAX_SOCKET_LIST} variables`);
  });
  const duration = built.asset.expectedDuration;
  if (duration > limits.maxExpectedDuration)
    fail('V6', `expectedDuration ${duration} s exceeds ${limits.maxExpectedDuration} s`);
  else if (duration > limits.preferredExpectedDuration)
    warn('V6', `expectedDuration ${duration} s exceeds ${limits.preferredExpectedDuration} s`);
  if (duration > 0) {
    const settle = nodes.some((node, k) => {
      const d = node.values?.['duration']?.value?.[0];
      return opAt(k) === 'flow/setDelay' && typeof d === 'number' && d >= duration;
    });
    if (!settle)
      fail('V6', `asynchronous asset has no flow/setDelay with an inline duration of at least ${duration} s`);
  }

  // V7: harness operation set. Roles come from the builder, in serialised node order.
  if (built.harness.graph.roles.length !== nodes.length)
    fail('V7', 'node roles do not match the serialised graph');
  built.harness.graph.roles.forEach((role, k) => {
    if (role === 'harness' && !HARNESS_OPS.has(opAt(k)))
      fail('V7', `node ${k}: ${opAt(k)} is not a harness operation`);
  });

  // V8: forward-only references and unique variable names.
  nodes.forEach((node, k) => {
    for (const [socket, v] of Object.entries(node.values ?? {})) {
      if (v.node !== undefined && v.node >= k)
        fail('V8', `node ${k} value ${socket} refers forward to node ${v.node}`);
    }
    for (const [socket, flow] of Object.entries(node.flows ?? {})) {
      if (flow.node <= k) fail('V8', `node ${k} flow ${socket} goes back to node ${flow.node}`);
    }
  });
  const names = variables.map((v) => v.name);
  if (new Set(names).size !== names.length) fail('V8', 'variable names are not unique');

  // V9: every number re-parses to the bit pattern intended.
  for (const { node, socket, value } of built.harness.graph.inlineValues) {
    const parsed = nodes[node]?.values?.[socket];
    const sig = types[parsed?.type ?? -1]?.signature;
    if (sig !== value.type) fail('V9', `node ${node} ${socket}: type ${sig ?? '?'} is not ${value.type}`);
    value.components.forEach((c, k) => {
      const p = parsed?.value?.[k];
      const ok = typeof c === 'boolean' ? p === c : typeof p === 'number' && sameBits(p, c);
      if (!ok) fail('V9', `node ${node} ${socket}[${k}] does not re-parse to the intended value`);
    });
  }
  built.asset.subTests.forEach((st, k) => {
    const p = parsedSubTests[k];
    if (p === undefined) return fail('V9', `${st.name}: missing from the oracle`);
    const expected = st.comparison.mode === 'set' ? (st.comparison.values[0] ?? st.expected) : st.expected;
    if (!matchesScalar(p.expectedResultValue[0], expected, true))
      fail('V9', `${st.name}: expectedResultValue does not re-parse`);
    st.inputs.forEach((input, j) => {
      if (!matchesScalar(p.inputs[j]?.value[0], input.value, true))
        fail('V9', `${st.name}: input ${input.socket} does not re-parse`);
    });
  });

  return { failures, warnings };
}
