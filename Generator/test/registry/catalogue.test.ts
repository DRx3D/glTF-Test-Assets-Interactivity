import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { loadCatalogue, OPERATION_COUNT, OperationCatalogue } from '../../src/registry/catalogue.js';
import { parseOperationTables, SPEC_REVISION, type Catalogue } from '../../src/registry/specTables.js';

const specText = readFileSync(new URL('../../data/spec/Specification.adoc', import.meta.url), 'utf8');
const yamlPath = new URL('../../data/operations.yaml', import.meta.url);

describe('data/operations.yaml', () => {
  it('is up to date with the vendored Specification (re-run tools/extract-operations.ts)', () => {
    const committed = parse(readFileSync(yamlPath, 'utf8')) as Catalogue;
    expect(committed).toEqual(parseOperationTables(specText));
  });

  it('has all 135 operations of the Specification', () => {
    const catalogue = loadCatalogue(yamlPath);
    expect(catalogue.size).toBe(OPERATION_COUNT);
    expect(catalogue.data.specRevision).toBe(SPEC_REVISION);
  });

  it('records overloads, placeholders, configuration and flows', () => {
    const c = loadCatalogue(yamlPath);
    expect(c.get('math/eq').signatures.map((s) => s.inputValues[0]?.types)).toEqual([
      ['floatN', 'floatNxN'],
      ['int'],
      ['bool'],
    ]);
    const sw = c.get('math/switch').signatures[0];
    expect(sw?.configuration.map((e) => e.name)).toEqual(['cases']);
    expect(sw?.inputValues.map((e) => e.name)).toEqual(['selection', '<case>', 'default']);
    const loop = c.get('flow/for').signatures[0];
    expect(loop?.inputFlows.map((e) => e.name)).toEqual(['in']);
    expect(loop?.outputFlows.map((e) => e.name)).toEqual(['loopBody', 'completed']);
    expect(c.get('math/E').signatures[0]?.outputValues[0]?.description).toBe('2.718281828459045');
    expect(c.get('math/sinh').category).toBe('math');
    expect(c.ops()).toEqual([...c.ops()].sort());
    expect(c.has('math/addd')).toBe(false);
    expect(() => c.get('math/addd')).toThrow(/unknown operation/);
  });

  it('rejects duplicate operations', () => {
    const one = parseOperationTables(specText).operations[0];
    expect(one).toBeDefined();
    if (one === undefined) return;
    expect(() => new OperationCatalogue({ specRevision: SPEC_REVISION, operations: [one, one] })).toThrow(
      /duplicate/,
    );
  });
});

describe('parseOperationTables', () => {
  it('reports malformed tables', () => {
    expect(() => parseOperationTables('| Operation | `x/y` | t\nnot a row\n|===')).toThrow(/unexpected row/);
    expect(() => parseOperationTables('| Operation | `x/y` | t\n| `float a` | A\n|===')).toThrow(
      /before any section/,
    );
    expect(() =>
      parseOperationTables('| Operation | `x/y` | t\n| Input value sockets\n| no socket here | A\n|==='),
    ).toThrow(/no socket/);
    expect(() =>
      parseOperationTables(
        '| Operation | `x/y` | t\n| Input value sockets\n| `float a` or + `int b` | A\n|===',
      ),
    ).toThrow(/inconsistent/);
  });
});
