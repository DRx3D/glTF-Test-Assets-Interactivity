import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  byCodeUnit,
  configInts,
  GraphBuilder,
  inlineFloat,
  inlineInt,
  orderedSocketIds,
  typeIndexOf,
} from '../../src/graph/builder.js';
import { writeCanonicalJson } from '../../src/numeric/json.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';

const catalogue = loadCatalogue(new URL('../../data/operations.yaml', import.meta.url));

interface Parsed {
  types: { signature: string }[];
  declarations: { op: string }[];
  nodes: {
    declaration: number;
    values?: Record<string, { node?: number; type?: number; value?: unknown[] }>;
    flows?: Record<string, { node: number }>;
  }[];
  variables?: unknown[];
  events?: unknown[];
}
const parsed = (g: GraphBuilder): Parsed =>
  JSON.parse(writeCanonicalJson(g.build().json, { context: 'graph', indent: 0 })) as Parsed;

describe('orderedSocketIds', () => {
  it('assigns decimal ids whose code-unit order is the output order (spec line 238)', () => {
    expect(orderedSocketIds(3)).toEqual(['0', '1', '2']);
    const ids = orderedSocketIds(12);
    expect(ids.slice(0, 4)).toEqual(['0', '1', '10', '11']);
    expect([...ids].sort(byCodeUnit)).toEqual(ids);
    expect(new Set(ids).size).toBe(12);
    expect(ids.every((id) => /^(0|[1-9]\d*)$/.test(id))).toBe(true);
  });
});

describe('GraphBuilder', () => {
  it('orders nodes forward-only: value refs lower, flows higher (spec lines 5298, 5387)', () => {
    const g = new GraphBuilder(catalogue);
    // Created out of order on purpose: the flow target and the value producer come last.
    const start = g.node('event/onStart', 'harness');
    const set = g.node('variable/set', 'harness', {
      configuration: [['variables', configInts(g.variable('v', 'int', [0]))]],
      values: { '0': g.pure('math/add', 'subject', { a: inlineInt(1), b: inlineInt(2) }, 'int') },
    });
    g.flow(start, 'out', set);
    const out = parsed(g);
    out.nodes.forEach((n, k) => {
      for (const v of Object.values(n.values ?? {})) if (v.node !== undefined) expect(v.node).toBeLessThan(k);
      for (const f of Object.values(n.flows ?? {})) expect(f.node).toBeGreaterThan(k);
    });
    expect(out.declarations.map((d) => d.op)).toEqual(['event/onStart', 'math/add', 'variable/set']);
  });

  it('keeps the forward-only rule for random chains (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 30 }), (perm) => {
        const g = new GraphBuilder(catalogue);
        // A chain of adds fed by literals, built in an arbitrary creation order.
        let acc = g.pure('math/add', 'subject', { a: inlineInt(0), b: inlineInt(perm[0] ?? 0) }, 'int');
        for (const x of perm.slice(1))
          acc = g.pure('math/add', 'subject', { a: acc, b: inlineInt(x) }, 'int');
        const out = parsed(g);
        return out.nodes.every((n, k) =>
          Object.values(n.values ?? {}).every((v) => v.node === undefined || v.node < k),
        );
      }),
      { numRuns: 200 },
    );
  });

  it('writes only the types in use, in the fixed order, with inline type indices', () => {
    const g = new GraphBuilder(catalogue);
    g.variable('x', 'float', [0.5]);
    g.node('pointer/set', 'harness', {
      configuration: [
        ['pointer', { kind: 'values', values: ['/materials/0/pbrMetallicRoughness/baseColorFactor'] }],
        ['type', typeIndexOf('float4')],
      ],
      values: { value: { kind: 'inline', type: 'float4', components: [0, 1, 0, 1] } },
    });
    const out = parsed(g);
    expect(out.types.map((t) => t.signature)).toEqual(['float', 'float4']);
  });

  it('omits empty arrays (spec line 4898)', () => {
    const g = new GraphBuilder(catalogue);
    g.node('event/onStart', 'harness');
    const out = parsed(g);
    expect(out.variables).toBeUndefined();
    expect(out.events).toBeUndefined();
  });

  it('rejects unknown sockets, wrong types, duplicates and cycles', () => {
    const g = new GraphBuilder(catalogue);
    expect(() => g.pure('math/add', 'subject', { c: inlineInt(1) }, 'int')).toThrow(/no signature/);
    expect(() => g.pure('math/isNaN', 'subject', { a: inlineInt(1) }, 'bool')).toThrow(/no signature/);
    expect(() => g.node('math/add', 'subject', { configuration: [['nope', configInts(1)]] })).toThrow(
      /no configuration/,
    );
    const n = g.node('math/add', 'subject');
    expect(() => g.output(n, 'value', 'bool')).toThrow(/no output value socket/);
    const start = g.node('event/onStart', 'harness');
    expect(() => g.flow(start, 'nope', start)).toThrow(/no output flow/);
    const seq = g.node('flow/sequence', 'harness');
    expect(() => g.flow(start, 'out', start)).toThrow(/no input flow/);
    g.flow(start, 'out', seq);
    expect(() => g.flow(start, 'out', seq)).toThrow(/twice/);
    g.variable('v', 'int', [0]);
    expect(() => g.variable('v', 'int', [0])).toThrow(/duplicate variable/);
    expect(() => g.variableType(9)).toThrow(/no variable/);
    expect(g.variableType(0)).toBe('int');
    g.event('e');
    expect(() => g.event('e')).toThrow(/duplicate event/);

    const cyc = new GraphBuilder(catalogue);
    const a = cyc.node('flow/sequence', 'harness');
    const b = cyc.node('flow/sequence', 'harness');
    cyc.flow(a, '0', b);
    cyc.flow(b, '0', a);
    expect(() => cyc.build()).toThrow(/cycle/);
  });

  it('refuses special floats as plain literals and writes flagged -0', () => {
    const g = new GraphBuilder(catalogue);
    g.pure('math/abs', 'subject', { a: inlineFloat(NaN) }, 'float');
    expect(() => writeCanonicalJson(g.build().json, { context: 'graph', indent: 0 })).toThrow();
    const h = new GraphBuilder(catalogue);
    h.pure('math/abs', 'subject', { a: inlineFloat(-0, true) }, 'float');
    expect(writeCanonicalJson(h.build().json, { context: 'graph', indent: 0 })).toContain('"value":[-0.0]');
  });
});
