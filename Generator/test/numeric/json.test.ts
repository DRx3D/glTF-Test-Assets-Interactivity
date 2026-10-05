import { describe, expect, it } from 'vitest';
import { NumberFormatError } from '../../src/numeric/format.js';
import { f64, i32, obj, quote, writeCanonicalJson, type JsonNode } from '../../src/numeric/json.js';
import { int } from '../../src/numeric/value.js';

const oracle = { context: 'oracle', indent: 2 } as const;
const graph = { context: 'graph', indent: 0 } as const;

describe('writeCanonicalJson', () => {
  it('matches the existing suite oracle layout', () => {
    const tree = obj([
      ['glbFileName', 'abs.glb'],
      [
        'tests',
        [
          obj([
            ['expectedResultValue', [f64(7)]],
            ['resultVarId', i32(int(1))],
          ]),
        ],
      ],
      ['empty', []],
      ['none', obj([])],
    ]);
    expect(writeCanonicalJson(tree, oracle)).toBe(
      [
        '{',
        '  "glbFileName": "abs.glb",',
        '  "tests": [',
        '    {',
        '      "expectedResultValue": [',
        '        7.0',
        '      ],',
        '      "resultVarId": 1',
        '    }',
        '  ],',
        '  "empty": [],',
        '  "none": {}',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('keeps the given key order, including integer-like keys', () => {
    const tree = obj([
      ['b', true],
      ['10', false],
      ['2', null],
      ['a', 'x'],
    ]);
    expect(writeCanonicalJson(tree, graph)).toBe('{"b":true,"10":false,"2":null,"a":"x"}');
  });

  it('writes special values as strings in oracles and refuses them in graphs', () => {
    const values = [f64(NaN), f64(Infinity), f64(-Infinity), f64(-0), f64(0.5)];
    expect(writeCanonicalJson(values, { context: 'oracle', indent: 0 })).toBe(
      '["NaN","Infinity","-Infinity","-0",0.5]',
    );
    expect(() => writeCanonicalJson([f64(NaN)], graph)).toThrow(NumberFormatError);
    expect(writeCanonicalJson([f64(-0, true)], graph)).toBe('[-0.0]');
  });

  it('rejects untagged numbers and duplicate keys', () => {
    expect(() => writeCanonicalJson([1] as unknown as JsonNode, graph)).toThrow(TypeError);
    expect(() =>
      obj([
        ['a', null],
        ['a', null],
      ]),
    ).toThrow(/duplicate key/);
  });
});

describe('quote', () => {
  it('escapes JSON specials and control characters, keeps non-ASCII', () => {
    expect(quote('a"b\\c\n\t\r\b\f')).toBe('"a\\"b\\\\c\\n\\t\\r\\b\\f"');
    expect(quote('\u0001')).toBe('"\\u0001"');
    expect(quote('≈ ±0 é')).toBe('"≈ ±0 é"');
    expect(JSON.parse(quote('x\u001f"y'))).toBe('x\u001f"y');
  });
});
