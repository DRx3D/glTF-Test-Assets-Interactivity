import { describe, expect, it } from 'vitest';
import {
  determineGaps,
  describeGaps,
  loadCoverageMapping,
  type CoverageMapping,
} from '../../src/existing/coverage.js';
import { defaultSuiteRoot, readSuite, type Inventory } from '../../src/existing/reader.js';
import { DEFAULT_DATA_DIR, loadDataSet } from '../../src/registry/check.js';

const inventory = readSuite(defaultSuiteRoot(DEFAULT_DATA_DIR));
const data = loadDataSet();
const mapping = loadCoverageMapping(`${DEFAULT_DATA_DIR}/existing-coverage.yaml`);

describe('readSuite against the existing suite at 9ffd30e', () => {
  it('reads every sub-test and invalid case with no problems', () => {
    expect(inventory.subTests.length).toBe(1073);
    expect(inventory.invalidCases.length).toBe(179);
    expect(inventory.problems).toEqual([]);
  });

  it('records the shared pass-variable convention (124 bool sub-tests)', () => {
    const shared = inventory.subTests.filter((s) => s.sharedPassVariable);
    expect(shared.length).toBe(124);
    expect(shared.every((s) => s.resultVar.type === 'bool' && s.expected[0] === true)).toBe(true);
  });

  it('collects names for collision checks', () => {
    for (const name of ['math', 'abs', 'math/abs', 'abs.glb', 'invalid-index.json']) {
      expect(inventory.names.has(name)).toBe(true);
    }
  });
});

describe('determineGaps', () => {
  it('applies the committed mapping with no problems', () => {
    const report = determineGaps(data.registry, inventory, mapping);
    expect(report.problems).toEqual([]);
    const status = (id: string): string | undefined => report.targets.find((t) => t.target.id === id)?.status;
    expect(status('S-568')).toBe('covered-existing');
    expect(status('S-2626')).toBe('gap');
    expect(status('S-3705')).toBe('rejection-covered-invalid');
    expect(status('S-400')).toBe('rejection-not-covered');
    expect(status('S-4894')).toBe('impractical');
    const text = describeGaps(report, inventory);
    expect(text).toMatch(/Existing suite: 1073 sub-tests, 179 invalid-graph cases/);
    expect(text).toMatch(/gaps \(type signatures, \d+\):/);
  });

  it('reports stale entries, unknown targets, type mismatches and misused invalid credits', () => {
    const bad: CoverageMapping = {
      suiteRevision: '9ffd30e',
      subTests: [
        { asset: 'math/abs', subTest: 'no such sub-test', credits: ['S-568'] },
        { asset: 'math/abs', subTest: '[a] -10 = 10', credits: ['S-0', 'T-math/abs-float2'] },
      ],
      invalid: [
        { id: 'Z9', credits: ['S-400'] },
        { id: 'G1a', credits: ['S-0', 'S-568'] },
      ],
    };
    const messages = determineGaps(data.registry, inventory, bad).problems.join('\n');
    expect(messages).toMatch(/stale mapping: no sub-test math\/abs \/ no such sub-test/);
    expect(messages).toMatch(/credits unknown target S-0/);
    expect(messages).toMatch(/result type int cannot cover T-math\/abs-float2/);
    expect(messages).toMatch(/stale mapping: no invalid case Z9/);
    expect(messages).toMatch(/invalid G1a: credits unknown target S-0/);
    expect(messages).toMatch(/invalid G1a: S-568 is not a rejection target/);
  });

  it('marks in-scope targets as gaps when nothing credits them', () => {
    const empty: Inventory = { subTests: [], invalidCases: [], names: new Set(), problems: [] };
    const report = determineGaps(data.registry, empty, {
      suiteRevision: '9ffd30e',
      subTests: [],
      invalid: [],
    });
    expect(report.targets.filter((t) => t.status === 'covered-existing')).toEqual([]);
  });
});

describe('loadCoverageMapping', () => {
  it('rejects a malformed file', () => {
    expect(() => loadCoverageMapping(new URL('../../data/operations.yaml', import.meta.url))).toThrow(
      /existing-coverage.yaml/,
    );
  });
});
