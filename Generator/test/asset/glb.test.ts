import validator from 'gltf-validator';
import { describe, expect, it } from 'vitest';
import { readGlb, writeGlb } from '../../src/asset/glb.js';
import { f64, i32, obj, writeCanonicalJson } from '../../src/numeric/json.js';
import { int } from '../../src/numeric/value.js';

const compact = { context: 'graph', indent: 0 } as const;

/** A one-triangle asset with a BIN buffer, built only from canonical JSON. */
function triangleAsset(): { json: string; bin: Uint8Array } {
  const positions = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  // glTF positions are FLOAT (binary32); write them through DataView to stay off Float32Array.
  const bin = new Uint8Array(positions.length * 4);
  const view = new DataView(bin.buffer);
  positions.forEach((v, i) => view.setFloat32(i * 4, v, true));
  const json = writeCanonicalJson(
    obj([
      [
        'asset',
        obj([
          ['version', '2.0'],
          ['generator', 'khr-itest-gen test'],
        ]),
      ],
      ['scene', i32(int(0))],
      ['scenes', [obj([['nodes', [i32(int(0))]]])]],
      ['nodes', [obj([['mesh', i32(int(0))]])]],
      ['meshes', [obj([['primitives', [obj([['attributes', obj([['POSITION', i32(int(0))]])]])]]])]],
      [
        'accessors',
        [
          obj([
            ['bufferView', i32(int(0))],
            ['componentType', i32(int(5126))],
            ['count', i32(int(3))],
            ['type', 'VEC3'],
            ['min', [f64(0), f64(0), f64(0)]],
            ['max', [f64(1), f64(1), f64(0)]],
          ]),
        ],
      ],
      [
        'bufferViews',
        [
          obj([
            ['buffer', i32(int(0))],
            ['byteLength', i32(int(bin.length))],
          ]),
        ],
      ],
      ['buffers', [obj([['byteLength', i32(int(bin.length))]])]],
    ]),
    compact,
  );
  return { json, bin };
}

describe('writeGlb', () => {
  it('writes the header, pads JSON with spaces and BIN with zeros', () => {
    const glb = writeGlb('{"a":1}', new Uint8Array([1, 2, 3, 4, 5]));
    const view = new DataView(glb.buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(glb.length);
    expect(view.getUint32(12, true)).toBe(8); // 7 bytes of JSON padded to 8
    expect(glb[27]).toBe(0x20);
    expect(view.getUint32(28, true)).toBe(8); // 5 bytes of BIN padded to 8
    expect(view.getUint32(32, true)).toBe(0x004e4942);
    expect([...glb.subarray(41, 44)]).toEqual([0, 0, 0]);
    expect(glb.length % 4).toBe(0);
  });

  it('round-trips through readGlb, with and without BIN', () => {
    const { json, bin } = triangleAsset();
    const parsed = readGlb(writeGlb(json, bin));
    expect(parsed.json).toBe(json);
    expect([...(parsed.bin ?? [])]).toEqual([...bin]);
    expect(readGlb(writeGlb('{}')).bin).toBeUndefined();
  });

  it('is byte-identical for identical input', () => {
    const { json, bin } = triangleAsset();
    expect(writeGlb(json, bin)).toEqual(writeGlb(json, bin));
  });

  it('passes the Khronos glTF Validator with no errors', async () => {
    const { json, bin } = triangleAsset();
    const report = await validator.validateBytes(writeGlb(json, bin));
    expect(report.issues.numErrors).toBe(0);
  });
});

describe('readGlb', () => {
  it('rejects malformed files', () => {
    expect(() => readGlb(new Uint8Array(4))).toThrow(/not a GLB/);
    const glb = writeGlb('{}');
    const badVersion = glb.slice();
    new DataView(badVersion.buffer).setUint32(4, 1, true);
    expect(() => readGlb(badVersion)).toThrow(/version/);
    const badLength = glb.slice();
    new DataView(badLength.buffer).setUint32(8, 999, true);
    expect(() => readGlb(badLength)).toThrow(/length/);
    const noJson = glb.slice();
    new DataView(noJson.buffer).setUint32(16, 0x12345678, true);
    expect(() => readGlb(noJson)).toThrow(/no JSON/);
  });
});
