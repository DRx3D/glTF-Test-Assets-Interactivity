// Each self-check must catch the defect it exists for: tampered copies of a good asset.

import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { readGlb, writeGlb } from '../../src/asset/glb.js';
import { buildAsset, type BuiltAsset } from '../../src/asset/build.js';
import { intScalar } from '../../src/graph/scalar.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';
import { DEFAULT_LIMITS } from '../../src/generators/types.js';
import { checkAsset, type CheckId } from '../../src/validate/checks.js';
import { compileInteractivitySchema } from '../../src/validate/schema.js';
import { goldenRun } from '../golden/run.js';

const schema = compileInteractivitySchema(fileURLToPath(new URL('../../data/spec/schema', import.meta.url)));
let good: BuiltAsset;
beforeAll(async () => {
  const run = await goldenRun();
  const div = run.built.find((b) => b.index.name === 'math/div-boundary');
  if (div === undefined) throw new Error('no div asset');
  good = div;
});

type Doc = {
  accessors: { count: number }[];
  extensions: {
    KHR_interactivity: { graphs: { nodes: Record<string, unknown>[]; variables: { name: string }[] }[] };
  };
};
const withGlb = (b: BuiltAsset, edit: (doc: Doc) => void): BuiltAsset => {
  const { json, bin } = readGlb(b.glb);
  const doc = JSON.parse(json) as Doc;
  edit(doc);
  return { ...b, glb: writeGlb(JSON.stringify(doc), bin) };
};
const graph = (doc: Doc) =>
  doc.extensions.KHR_interactivity.graphs[0] as Doc['extensions']['KHR_interactivity']['graphs'][number];
const checksFailing = async (b: BuiltAsset, limits = DEFAULT_LIMITS): Promise<CheckId[]> =>
  [...new Set((await checkAsset(b, schema, limits)).failures.map((f) => f.check))].sort();

describe('per-asset self-checks', () => {
  it('pass for a generated asset', async () => {
    expect(await checksFailing(good)).toEqual([]);
  });

  it('V1 catches glTF errors', async () => {
    expect(
      await checksFailing(withGlb(good, (d) => void ((d.accessors[0] as { count: number }).count = 999))),
    ).toContain('V1');
  });

  it('V2 catches schema violations', async () => {
    expect(
      await checksFailing(withGlb(good, (d) => void delete graph(d).nodes[0]?.['declaration'])),
    ).toContain('V2');
  });

  it('V3 catches oracle variables that do not match the GLB', async () => {
    expect(
      await checksFailing({ ...good, oracle: good.oracle.replace('"resultVarId": 1,', '"resultVarId": 0,') }),
    ).toContain('V3');
  });

  it('V6 catches size limits', async () => {
    expect(await checksFailing(good, { ...DEFAULT_LIMITS, maxNodes: 10, maxSubTests: 2 })).toEqual(['V6']);
    const slow = { ...good, asset: { ...good.asset, expectedDuration: 11 } };
    expect(await checksFailing(slow)).toEqual(['V6']);
    const warn = await checkAsset(
      { ...good, asset: { ...good.asset, expectedDuration: 6 } },
      schema,
      DEFAULT_LIMITS,
    );
    expect(warn.warnings.map((w) => w.check)).toEqual(['V6']);
  });

  it('V7 catches harness nodes outside the harness set', async () => {
    // math/div is itself a harness operation, so use an asset whose subject is math/add.
    const add = buildAsset(
      {
        ...good.asset,
        name: 'add-boundary',
        subTests: good.asset.subTests
          .slice(0, 1)
          .map((st) => ({ ...st, op: 'math/add', expected: intScalar(-5), name: 'add(-7, 2) is -5' })),
      },
      {
        catalogue: loadCatalogue(fileURLToPath(new URL('../../data/operations.yaml', import.meta.url))),
        seed: 1n,
        copyright: 'Copyright (c) 2026, Owner',
      },
    );
    expect(await checksFailing(add)).toEqual([]);
    const roles = add.harness.graph.roles.map((r) => (r === 'subject' ? 'harness' : r));
    expect(
      await checksFailing({ ...add, harness: { ...add.harness, graph: { ...add.harness.graph, roles } } }),
    ).toEqual(['V7']);
  });

  it('V8 catches backward flows and duplicate variable names', async () => {
    const tampered = withGlb(good, (d) => {
      const nodes = graph(d).nodes;
      (nodes[0] as { flows: { out: { node: number } } }).flows.out.node = 0;
      const vars = graph(d).variables;
      (vars[1] as { name: string }).name = (vars[0] as { name: string }).name;
    });
    expect(await checksFailing(tampered)).toEqual(expect.arrayContaining(['V8']));
  });

  it('V9 catches numbers that do not re-parse as intended', async () => {
    expect(
      await checksFailing({
        ...good,
        oracle: good.oracle.replace('"value": [\n                -7', '"value": [\n                -8'),
      }),
    ).toEqual(['V9']);
    const graphTampered = withGlb(good, (d) => {
      const node = graph(d).nodes.find(
        (n) => (n['values'] as Record<string, { value?: number[] }> | undefined)?.['a']?.value?.[0] === -7,
      );
      ((node?.['values'] as Record<string, { value: number[] }>)['a'] as { value: number[] }).value[0] = -6;
    });
    expect(await checksFailing(graphTampered)).toContain('V9');
  });
});
