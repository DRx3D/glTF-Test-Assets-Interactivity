import validator from 'gltf-validator';
import { describe, expect, it } from 'vitest';
import { readGlb } from '../../src/asset/glb.js';
import { buildAsset, copyrightLine } from '../../src/asset/build.js';
import type { ResolvedAsset } from '../../src/asset/model.js';
import { assetName, FACETS, splitGreedy } from '../../src/asset/naming.js';
import { seedText } from '../../src/asset/oracle.js';
import { indexJson } from '../../src/asset/supplementalIndex.js';
import { MAX_SOCKET_LIST } from '../../src/graph/harness.js';
import { float, intScalar } from '../../src/graph/scalar.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';
import { GENERATOR_VERSION } from '../../src/version.js';
import pkg from '../../package.json' with { type: 'json' };

const catalogue = loadCatalogue(new URL('../../data/operations.yaml', import.meta.url));

const asset = (
  n: number,
  comparison: ResolvedAsset['subTests'][number]['comparison'] = { mode: 'exact' },
): ResolvedAsset => ({
  category: 'math',
  name: 'add-boundary',
  description: 'test | asset',
  expectedDuration: 0,
  subTests: Array.from({ length: n }, (_, k) => ({
    name: `add(${k}, 1) is ${k + 1}`,
    op: 'math/add',
    inputs: [
      { socket: 'a', value: intScalar(k) },
      { socket: 'b', value: intScalar(1) },
    ],
    resultType: 'int' as const,
    expected: intScalar(k + 1),
    comparison,
    targets: ['S-1'],
    specRefs: [{ revision: 'c5d1e1e8', line: 2534, section: 'math/add' }],
    valueClasses: ['ordinary'],
    interpretations: k === 0 ? ['I-x'] : [],
  })),
});
const ctx = { catalogue, seed: 0x4b48525f494e5445n, copyright: copyrightLine(2026, 'Owner') };

describe('naming', () => {
  it('builds <subject>-<facet>[-partN] and rejects anything else (§6.2)', () => {
    expect(FACETS).toHaveLength(13);
    expect(assetName('div', 'boundary')).toBe('div-boundary');
    expect(assetName('div', 'boundary', 2)).toBe('div-boundary-part2');
    expect(() => assetName('div', 'prerequisites')).toThrow(/facet/);
    expect(() => assetName('math/div', 'types')).toThrow(/subject/);
    expect(() => assetName('div', 'types', 0)).toThrow(/part/);
  });

  it('splits greedily by count and cost, and refuses an item over the cost limit', () => {
    expect(splitGreedy([1, 2, 3, 4, 5], 2, 100, () => 1)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitGreedy([5, 5, 5], 10, 10, (p) => p.reduce((s, x) => s + x, 0))).toEqual([[5, 5], [5]]);
    expect(() => splitGreedy([20], 10, 10, (p) => p[0] ?? 0)).toThrow(/exceeds/);
  });
});

describe('asset writers', () => {
  it('writes a GLB that passes the glTF Validator, with metadata (§7.1, §14)', async () => {
    const built = buildAsset(asset(3), ctx);
    const report = await validator.validateBytes(built.glb);
    expect(report.issues.numErrors).toBe(0);
    const doc = JSON.parse(readGlb(built.glb).json) as {
      asset: Record<string, string>;
      extensionsUsed: string[];
      materials: unknown[];
    };
    expect(doc.asset['generator']).toBe(
      `khr-itest-gen ${GENERATOR_VERSION} (KHR_interactivity spec c5d1e1e8)`,
    );
    expect(doc.asset['copyright']).toBe('Copyright (c) 2026, Owner');
    expect(doc.extensionsUsed).toEqual(['KHR_interactivity']);
    expect(doc.materials).toHaveLength(3);
    expect(built.paths).toEqual({
      glb: 'math/add-boundary/glTF-Binary/add-boundary.glb',
      oracle: 'math/add-boundary/test-Json/add-boundary.json',
      description: 'math/add-boundary/add-boundary.md',
    });
  });

  it('writes the oracle in the on-disk nested schema with the supplemental properties (§7.4)', () => {
    const oracle = JSON.parse(buildAsset(asset(2), ctx).oracle) as {
      supplemental: boolean;
      generator: { seed: string };
      tests: { entryPoints: { nodeId: number }[]; subTests: Record<string, unknown>[] }[];
    };
    expect(oracle.supplemental).toBe(true);
    expect(oracle.generator.seed).toBe('0x4B48525F494E5445');
    const st = oracle.tests[0]?.subTests[0] ?? {};
    expect(Object.keys(st)).toEqual([
      'name',
      'resultVarName',
      'resultVarId',
      'resultVarType',
      'expectedResultValue',
      'successResultVarId',
      'successResultVarName',
      'comparison',
      'targets',
      'specRefs',
      'valueClasses',
      'inputs',
      'reviewRequired',
    ]);
    expect(oracle.tests[0]?.subTests[1]).not.toHaveProperty('reviewRequired');
    expect(oracle.tests[0]?.entryPoints).toEqual([{ name: 'math/add-boundary', nodeId: 0 }]);
  });

  it('writes special values as strings and set comparisons with their members', () => {
    const special = asset(1, { mode: 'set', inner: 'exact', values: [float(NaN), float(-0)] });
    const built = buildAsset(
      {
        ...special,
        subTests: special.subTests.map((s) => ({
          ...s,
          op: 'math/add',
          inputs: [
            { socket: 'a', value: float(-0) },
            { socket: 'b', value: float(-0) },
          ],
          resultType: 'float' as const,
          expected: float(-0),
        })),
      },
      ctx,
    );
    expect(built.oracle).toContain('"NaN"');
    expect(built.oracle).toContain('"-0"');
    expect(built.description).toContain('NaN or -0');
  });

  it('describes sub-tests with a Spec refs column and the licence (§7.5, §14)', () => {
    const md = buildAsset(asset(2), ctx).description;
    expect(md).toContain('| Sub Test | Result Var.Name | Result Var.Id | Expected Value | Spec refs |');
    expect(md).toContain('math/add (line 2534)');
    expect(md).toContain('### **Description:** test | asset');
    expect(md).toContain('Copyright (c) 2026, Owner\n\nLicensed under CC BY 4.0 International.');
  });

  it('nests flow/sequence nodes so none has more than 64 outputs (§7.7)', () => {
    const built = buildAsset(asset(100), ctx);
    const graph = (
      JSON.parse(readGlb(built.glb).json) as {
        extensions: {
          KHR_interactivity: {
            graphs: { declarations: { op: string }[]; nodes: { declaration: number; flows?: object }[] }[];
          };
        };
      }
    ).extensions.KHR_interactivity.graphs[0];
    const seq = graph?.declarations.findIndex((d) => d.op === 'flow/sequence');
    const sequences = graph?.nodes.filter((n) => n.declaration === seq) ?? [];
    expect(sequences.length).toBe(3);
    for (const s of sequences) expect(Object.keys(s.flows ?? {}).length).toBeLessThanOrEqual(MAX_SOCKET_LIST);
  });

  it('sorts index entries by name (§6.3)', () => {
    const text = indexJson([
      { name: 'math/z', assetName: 'z', tags: ['a'] },
      { name: 'math/a', assetName: 'a', tags: ['b'] },
    ]);
    const entries = JSON.parse(text) as { name: string; variants: Record<string, string> }[];
    expect(entries.map((e) => e.name)).toEqual(['math/a', 'math/z']);
    expect(entries[0]?.variants).toEqual({ 'glTF-Binary': 'a.glb', 'test-Json': 'a.json' });
  });

  it('keeps the generator version equal to package.json and formats seeds', () => {
    expect(GENERATOR_VERSION).toBe(pkg.version);
    expect(seedText(1n)).toBe('0x0000000000000001');
  });
});
