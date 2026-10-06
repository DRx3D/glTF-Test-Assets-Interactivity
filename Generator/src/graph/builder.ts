// Typed behavior-graph builder (project spec sections 10.1 and 10.2). Generators and the
// harness describe nodes through this API; it alone writes KHR_interactivity graph JSON, so
// node order, socket ids, type indices and inline number formatting are handled in one place.

import { f64, i32, obj, type JsonNode } from '../numeric/json.js';
import { int, VALUE_TYPES, type F64, type Int32, type ValueType } from '../numeric/value.js';
import type { OperationCatalogue } from '../registry/catalogue.js';
import type { Signature, SocketEntry } from '../registry/specTables.js';

/** What a node is for. V7 checks that only `subject` and `setup` nodes leave the harness set. */
export type NodeRole = 'harness' | 'subject' | 'setup';

export type InlineType = Exclude<ValueType, 'ref'>;

/** An inline value on an input socket, written as `{ "type": i, "value": [...] }`. */
export interface InlineValue {
  readonly kind: 'inline';
  readonly type: InlineType;
  readonly components: readonly (F64 | Int32 | boolean)[];
  /** Write -0 as a literal (value class `literalNegZero`, requirements §8.2). */
  readonly allowLiteralNegZero?: boolean;
}

export interface NodeHandle {
  readonly id: number;
}

/** An output value socket of a node. */
export interface ValueRef {
  readonly kind: 'ref';
  readonly node: NodeHandle;
  readonly socket: string;
  readonly type: ValueType;
}

export type ValueSource = InlineValue | ValueRef;

/** A configuration value: strings, ints and booleans, or a type index resolved at build time. */
export type ConfigValue =
  | { readonly kind: 'values'; readonly values: readonly (string | Int32 | boolean)[] }
  | { readonly kind: 'typeIndex'; readonly type: ValueType };

export const inline = (type: InlineType, components: readonly (F64 | Int32 | boolean)[]): InlineValue => ({
  kind: 'inline',
  type,
  components,
});
export const inlineFloat = (x: F64, allowLiteralNegZero = false): InlineValue => ({
  kind: 'inline',
  type: 'float',
  components: [x],
  allowLiteralNegZero,
});
export const inlineInt = (x: number): InlineValue => inline('int', [int(x)]);
export const inlineBool = (x: boolean): InlineValue => inline('bool', [x]);
export const config = (...values: (string | Int32 | boolean)[]): ConfigValue => ({ kind: 'values', values });
export const configInts = (...values: number[]): ConfigValue => ({ kind: 'values', values: values.map(int) });
export const typeIndexOf = (type: ValueType): ConfigValue => ({ kind: 'typeIndex', type });

interface NodeRecord {
  readonly id: number;
  readonly op: string;
  readonly role: NodeRole;
  readonly configuration: readonly (readonly [string, ConfigValue])[];
  readonly values: Map<string, ValueSource>;
  readonly flows: Map<string, { readonly node: NodeHandle; readonly socket: string }>;
}

export class GraphBuildError extends Error {}

/** Generic socket types in the operation tables, expanded to concrete value types. */
const GENERIC_TYPES: Readonly<Record<string, readonly ValueType[]>> = {
  floatN: ['float', 'float2', 'float3', 'float4'],
  floatNxN: ['float2x2', 'float3x3', 'float4x4'],
};
const PLACEHOLDER = /^<.+>$/;
const isTypeVariable = (t: string): boolean => /^T\w*$/.test(t);

const socketAccepts = (entry: SocketEntry, type: ValueType): boolean =>
  entry.types.length === 0 ||
  entry.types.some((t) => t === type || isTypeVariable(t) || (GENERIC_TYPES[t] ?? []).includes(type));

/** Code-unit order (Specification line 238), which is not localeCompare order. */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Socket ids for `n` ordered outputs (flow/sequence), as decimal numbers with no leading
 * zeros, assigned so that their code-unit order is the intended order: `ids[k]` is the id
 * of the k-th output. With 12 outputs the order is 0, 1, 10, 11, 2, …, so output 2 gets "10".
 */
export function orderedSocketIds(n: number): string[] {
  return Array.from({ length: n }, (_, k) => String(k)).sort(byCodeUnit);
}

export interface Variable {
  readonly name: string;
  readonly type: InlineType;
  readonly initial: readonly (F64 | Int32 | boolean)[];
}

export interface CustomEvent {
  readonly id: string;
  readonly values: readonly (readonly [string, InlineValue])[];
}

/** The serialised graph plus what the self-checks need to know about it. */
export interface BuiltGraph {
  readonly json: JsonNode;
  /** Role of each node, by serialised index. */
  readonly roles: readonly NodeRole[];
  /** Operation of each node, by serialised index. */
  readonly ops: readonly string[];
  /** Serialised index of each node handle id. */
  readonly indexOf: (handle: NodeHandle) => number;
  /** The types array, in order. */
  readonly types: readonly ValueType[];
  /** Every inline value as intended, by serialised node index and socket (for V9). */
  readonly inlineValues: readonly {
    readonly node: number;
    readonly socket: string;
    readonly value: InlineValue;
  }[];
  /** Declared operations, in declaration order. */
  readonly declarations: readonly string[];
}

export class GraphBuilder {
  private readonly nodes: NodeRecord[] = [];
  private readonly variables: Variable[] = [];
  private readonly events: CustomEvent[] = [];

  constructor(private readonly catalogue: OperationCatalogue) {}

  get nodeCount(): number {
    return this.nodes.length;
  }

  /** Adds a custom variable and returns its index. Names must be unique (requirements §7.2). */
  variable(name: string, type: InlineType, initial: readonly (F64 | Int32 | boolean)[]): number {
    if (this.variables.some((v) => v.name === name)) {
      throw new GraphBuildError(`duplicate variable name ${name}`);
    }
    this.variables.push({ name, type, initial });
    return this.variables.length - 1;
  }

  variableType(index: number): InlineType {
    const v = this.variables[index];
    if (v === undefined) throw new GraphBuildError(`no variable ${index}`);
    return v.type;
  }

  /** Adds a custom event and returns its index. */
  event(id: string, values: readonly (readonly [string, InlineValue])[] = []): number {
    if (this.events.some((e) => e.id === id)) throw new GraphBuildError(`duplicate event ${id}`);
    this.events.push({ id, values });
    return this.events.length - 1;
  }

  /**
   * Adds a node. Value and flow socket names are checked against the operation catalogue;
   * placeholder sockets (`<index>`, `<custom>`, `<id>`) accept any id.
   */
  node(
    op: string,
    role: NodeRole,
    options: {
      readonly configuration?: readonly (readonly [string, ConfigValue])[];
      readonly values?: Readonly<Record<string, ValueSource>>;
    } = {},
  ): NodeHandle {
    const operation = this.catalogue.get(op);
    const values = new Map(Object.entries(options.values ?? {}));
    const signature = this.matchSignature(op, operation.signatures, values);
    for (const [name] of options.configuration ?? []) {
      if (!signature.configuration.some((c) => c.name === name)) {
        throw new GraphBuildError(`${op}: no configuration property ${name}`);
      }
    }
    const handle = { id: this.nodes.length };
    this.nodes.push({
      id: handle.id,
      op,
      role,
      configuration: options.configuration ?? [],
      values,
      flows: new Map(),
    });
    return handle;
  }

  /** Adds a pure node and returns its `value` output, typed `outType`. */
  pure(
    op: string,
    role: NodeRole,
    values: Readonly<Record<string, ValueSource>>,
    outType: ValueType,
    configuration?: readonly (readonly [string, ConfigValue])[],
  ): ValueRef {
    const handle = this.node(op, role, configuration === undefined ? { values } : { values, configuration });
    return this.output(handle, 'value', outType);
  }

  /** An output value socket of an existing node, checked against the catalogue. */
  output(handle: NodeHandle, socket: string, type: ValueType): ValueRef {
    const rec = this.record(handle);
    const ok = this.catalogue
      .get(rec.op)
      .signatures.some((s) =>
        s.outputValues.some((o) => (o.name === socket || PLACEHOLDER.test(o.name)) && socketAccepts(o, type)),
      );
    if (!ok) throw new GraphBuildError(`${rec.op}: no output value socket ${socket} of type ${type}`);
    return { kind: 'ref', node: handle, socket, type };
  }

  /** Connects an output flow socket to an input flow socket. */
  flow(from: NodeHandle, socket: string, to: NodeHandle, toSocket = 'in'): void {
    const source = this.record(from);
    const target = this.record(to);
    const fromOp = this.catalogue.get(source.op);
    if (
      !fromOp.signatures.some((s) => s.outputFlows.some((f) => f.name === socket || PLACEHOLDER.test(f.name)))
    ) {
      throw new GraphBuildError(`${source.op}: no output flow socket ${socket}`);
    }
    if (
      !this.catalogue.get(target.op).signatures.some((s) => s.inputFlows.some((f) => f.name === toSocket))
    ) {
      throw new GraphBuildError(`${target.op}: no input flow socket ${toSocket}`);
    }
    if (source.flows.has(socket)) throw new GraphBuildError(`${source.op}: flow ${socket} connected twice`);
    source.flows.set(socket, { node: to, socket: toSocket });
  }

  private record(handle: NodeHandle): NodeRecord {
    const rec = this.nodes[handle.id];
    if (rec === undefined) throw new GraphBuildError(`unknown node ${handle.id}`);
    return rec;
  }

  private matchSignature(
    op: string,
    signatures: readonly Signature[],
    values: ReadonlyMap<string, ValueSource>,
  ): Signature {
    const typeOf = (v: ValueSource): ValueType => (v.kind === 'inline' ? v.type : v.type);
    const match = signatures.find((s) =>
      [...values].every(([name, v]) =>
        s.inputValues.some(
          (e) => (e.name === name || PLACEHOLDER.test(e.name)) && socketAccepts(e, typeOf(v)),
        ),
      ),
    );
    if (match === undefined) {
      const given = [...values].map(([n, v]) => `${n}:${typeOf(v)}`).join(', ');
      throw new GraphBuildError(`${op}: no signature accepts (${given})`);
    }
    return match;
  }

  /**
   * Orders nodes so every value input refers to a lower index and every flow to a higher one
   * (Specification lines 5298 and 5387). Ties keep creation order; a cycle is an error.
   */
  private order(): number[] {
    const n = this.nodes.length;
    const successors: number[][] = Array.from({ length: n }, () => []);
    const indegree = new Array<number>(n).fill(0);
    const edge = (from: number, to: number): void => {
      (successors[from] as number[]).push(to);
      indegree[to] = (indegree[to] as number) + 1;
    };
    for (const rec of this.nodes) {
      for (const v of rec.values.values()) if (v.kind === 'ref') edge(v.node.id, rec.id);
      for (const f of rec.flows.values()) edge(rec.id, f.node.id);
    }
    // Ready nodes kept sorted by id; n is at most a few thousand, so a sorted array suffices.
    const ready: number[] = [];
    for (let id = 0; id < n; id++) if (indegree[id] === 0) ready.push(id);
    const out: number[] = [];
    while (ready.length > 0) {
      const id = ready.shift() as number;
      out.push(id);
      for (const next of successors[id] as number[]) {
        indegree[next] = (indegree[next] as number) - 1;
        if (indegree[next] === 0) {
          const at = ready.findIndex((r) => r > next);
          ready.splice(at === -1 ? ready.length : at, 0, next);
        }
      }
    }
    if (out.length !== n) throw new GraphBuildError('graph has a cycle through value and flow edges');
    return out;
  }

  build(): BuiltGraph {
    const order = this.order();
    const indexById = new Array<number>(this.nodes.length);
    order.forEach((id, index) => (indexById[id] = index));
    const indexOf = (h: NodeHandle): number => indexById[h.id] as number;

    // Types: every type an inline value, variable, event value or type-index configuration uses.
    const used = new Set<ValueType>();
    for (const v of this.variables) used.add(v.type);
    for (const e of this.events) for (const [, v] of e.values) used.add(v.type);
    for (const rec of this.nodes) {
      for (const v of rec.values.values()) if (v.kind === 'inline') used.add(v.type);
      for (const [, c] of rec.configuration) if (c.kind === 'typeIndex') used.add(c.type);
    }
    const types = VALUE_TYPES.filter((t) => used.has(t));
    const typeIndex = (t: ValueType): Int32 => int(types.indexOf(t));

    const declarations: string[] = [];
    for (const id of order) {
      const op = (this.nodes[id] as NodeRecord).op;
      if (!declarations.includes(op)) declarations.push(op);
    }

    const inlineJson = (v: InlineValue): JsonNode =>
      obj([
        ['type', i32(typeIndex(v.type))],
        ['value', v.components.map((c) => component(v.type, c, v.allowLiteralNegZero === true))],
      ]);

    const inlineValues: { node: number; socket: string; value: InlineValue }[] = [];
    const nodesJson = order.map((id, index) => {
      const rec = this.nodes[id] as NodeRecord;
      const entries: [string, JsonNode][] = [['declaration', i32(int(declarations.indexOf(rec.op)))]];
      if (rec.configuration.length > 0) {
        entries.push([
          'configuration',
          obj(
            rec.configuration.map(([name, c]) => [
              name,
              obj([
                ['value', c.kind === 'typeIndex' ? [i32(typeIndex(c.type))] : c.values.map(configComponent)],
              ]),
            ]),
          ),
        ]);
      }
      const values = [...rec.values].sort(([a], [b]) => byCodeUnit(a, b));
      if (values.length > 0) {
        entries.push([
          'values',
          obj(
            values.map(([socket, v]) => {
              if (v.kind === 'inline') {
                inlineValues.push({ node: index, socket, value: v });
                return [socket, inlineJson(v)];
              }
              return [
                socket,
                obj([
                  ['node', i32(int(indexOf(v.node)))],
                  ['socket', v.socket],
                ]),
              ];
            }),
          ),
        ]);
      }
      const flows = [...rec.flows].sort(([a], [b]) => byCodeUnit(a, b));
      if (flows.length > 0) {
        entries.push([
          'flows',
          obj(
            flows.map(([socket, f]) => [
              socket,
              obj([
                ['node', i32(int(indexOf(f.node)))],
                ['socket', f.socket],
              ]),
            ]),
          ),
        ]);
      }
      return obj(entries);
    });

    // Empty arrays are omitted (Specification line 4898).
    const graph: [string, JsonNode][] = [];
    if (types.length > 0) graph.push(['types', types.map((t) => obj([['signature', t]]))]);
    if (this.variables.length > 0) {
      graph.push([
        'variables',
        this.variables.map((v) =>
          obj([
            ['type', i32(typeIndex(v.type))],
            ['name', v.name],
            ['value', v.initial.map((c) => component(v.type, c, false))],
          ]),
        ),
      ]);
    }
    if (this.events.length > 0) {
      graph.push([
        'events',
        this.events.map((e) => {
          const fields: [string, JsonNode][] = [
            ['id', e.id],
            ['name', e.id],
          ];
          if (e.values.length > 0)
            fields.push(['values', obj(e.values.map(([name, v]) => [name, inlineJson(v)]))]);
          return obj(fields);
        }),
      ]);
    }
    if (declarations.length > 0) graph.push(['declarations', declarations.map((op) => obj([['op', op]]))]);
    if (nodesJson.length > 0) graph.push(['nodes', nodesJson]);

    return {
      json: obj(graph),
      roles: order.map((id) => (this.nodes[id] as NodeRecord).role),
      ops: order.map((id) => (this.nodes[id] as NodeRecord).op),
      indexOf,
      types,
      inlineValues,
      declarations,
    };
  }
}

function component(type: InlineType, c: F64 | Int32 | boolean, allowLiteralNegZero: boolean): JsonNode {
  if (type === 'bool') {
    if (typeof c !== 'boolean') throw new GraphBuildError('bool value expected');
    return c;
  }
  if (typeof c !== 'number') throw new GraphBuildError(`${type} value expected`);
  return type === 'int' ? i32(int(c)) : f64(c, allowLiteralNegZero);
}

function configComponent(c: string | Int32 | boolean): JsonNode {
  return typeof c === 'number' ? i32(c) : c;
}
