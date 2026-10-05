import { describe, expect, it } from 'vitest';
import { describeCheck, loadDataSet } from '../../src/registry/check.js';
import { loadCatalogue } from '../../src/registry/catalogue.js';
import { SPEC_REVISION } from '../../src/registry/specTables.js';
import { checkRegistry, countTodo, ID_PATTERNS } from '../../src/registry/targets.js';

const catalogue = loadCatalogue(new URL('../../data/operations.yaml', import.meta.url));
const ctx = { specRevision: SPEC_REVISION, specLineCount: 6000, catalogue };

const target = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'S-568-negzero',
  kind: 'statement',
  specRef: { line: 568, section: 'math/round' },
  summary: 'round of x in (-0.5, 0) returns -0',
  scope: 'in',
  covers: { op: 'math/round', types: ['float'], comparison: 'exact' },
  generator: 'math/round',
  ...overrides,
});
const file = (targets: unknown[], extra: Record<string, unknown> = {}): { file: string; data: unknown } => ({
  file: 'test.yaml',
  data: { specRevision: SPEC_REVISION, area: 'math', targets, ...extra },
});

describe('committed data/', () => {
  it('passes check-registry with no problems', () => {
    const data = loadDataSet();
    expect(data.problems).toEqual([]);
    expect(data.registry.targets.size).toBeGreaterThanOrEqual(128);
    const { text, ok } = describeCheck(data);
    expect(ok).toBe(true);
    expect(text).toMatch(
      /135 operations; \d+ targets \(edge \d+, pointer \d+, procedure \d+, statement 128, type \d+\)/,
    );
  });
});

describe('checkRegistry', () => {
  it('accepts a valid file', () => {
    const { problems, registry } = checkRegistry([file([target()])], ctx);
    expect(problems).toEqual([]);
    expect(countTodo(registry)).toBe(0);
  });

  it('reports schema errors, duplicate ids, wrong id forms, bad lines and unknown operations', () => {
    const { problems } = checkRegistry(
      [
        file([{ id: 'x' }]),
        file([
          target(),
          target(),
          target({ id: 'T-bad' }),
          target({ id: 'S-9999', specRef: { line: 9999, section: 'x' } }),
          target({ id: 'S-1', covers: { op: 'math/addd' } }),
          target({ id: 'S-2', generator: 'TODO' }),
        ]),
        file([], { specRevision: 'deadbee' }),
      ],
      ctx,
    );
    const messages = problems.map((p) => p.message).join('\n');
    expect(messages).toMatch(/schema:/);
    expect(messages).toMatch(/duplicate target id S-568-negzero/);
    expect(messages).toMatch(/T-bad: id does not match the statement form/);
    expect(messages).toMatch(/S-9999: specRef line 9999 is beyond/);
    expect(messages).toMatch(/S-1: unknown operation math\/addd/);
    expect(messages).toMatch(/S-2: in-scope target with covers but no owning generator/);
    expect(messages).toMatch(/specRevision deadbee does not match/);
  });

  it('counts TODO targets and describes failures', () => {
    const { registry, problems } = checkRegistry(
      [file([target({ covers: 'TODO', generator: 'TODO' })])],
      ctx,
    );
    expect(countTodo(registry)).toBe(1);
    const failing = describeCheck({
      catalogue,
      registry,
      problems: [{ file: 'a.yaml', message: 'bad' }],
      specLineCount: 1,
    });
    expect(failing.ok).toBe(false);
    expect(failing.text).toMatch(/^a\.yaml: bad\n/);
    expect(problems).toEqual([]);
  });
});

describe('ID_PATTERNS (requirements §10.1)', () => {
  it.each([
    ['statement', 'S-568-negzero'],
    ['type', 'T-math/clamp-float3'],
    ['procedure', 'P-flow/for-endIndexReevaluated'],
    ['pointer', 'O-/extensions/KHR_interactivity/activeCamera/position'],
    ['edge', 'E-precision-intToFloat16777217'],
  ] as const)('%s accepts %s', (kind, id) => {
    expect(ID_PATTERNS[kind].test(id)).toBe(true);
  });
});
