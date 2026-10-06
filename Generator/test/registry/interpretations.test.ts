import { describe, expect, it } from 'vitest';
import { loadDataSet } from '../../src/registry/check.js';
import { checkInterpretations } from '../../src/registry/interpretations.js';
import { SPEC_REVISION } from '../../src/registry/specTables.js';

const data = loadDataSet();
const ctx = {
  specRevision: SPEC_REVISION,
  specLineCount: 6000,
  catalogue: data.catalogue,
  registry: data.registry,
};
const entry = {
  id: 'I-example',
  affects: ['math/div'],
  specLine: 100,
  specText: 'quoted text',
  reading: 'the reading chosen',
};

describe('interpretations', () => {
  it('loads the shipped file without problems', () => {
    expect(data.problems).toEqual([]);
    expect(data.interpretations).toEqual([]);
  });

  it('accepts a well-formed entry naming an operation or a target', () => {
    const target = [...data.registry.targets.keys()][0] ?? '';
    const file = {
      specRevision: SPEC_REVISION,
      interpretations: [entry, { ...entry, id: 'I-two', affects: [target] }],
    };
    const result = checkInterpretations(file, ctx);
    expect(result.problems).toEqual([]);
    expect(result.interpretations).toHaveLength(2);
  });

  it('reports schema errors, revision, duplicates, lines and unknown names', () => {
    expect(checkInterpretations({ interpretations: [] }, ctx).problems[0]?.message).toMatch(/^schema:/);
    const bad = {
      specRevision: 'abcdef0',
      interpretations: [entry, { ...entry, specLine: 7000, affects: ['math/nope'] }],
    };
    const messages = checkInterpretations(bad, ctx).problems.map((p) => p.message);
    expect(messages).toEqual([
      'specRevision abcdef0 does not match c5d1e1e8',
      'duplicate interpretation id I-example',
      'I-example: specLine 7000 is beyond the Specification',
      'I-example: affects unknown target or operation math/nope',
    ]);
  });
});
