// glTF document for one asset (requirements §7.1; project spec section 11.2): the indicator
// grid and the KHR_interactivity extension, written as an ordered tree so the JSON chunk is
// byte-for-byte determined.

import { f64, i32, obj, writeCanonicalJson, type JsonNode } from '../numeric/json.js';
import { int, type F64 } from '../numeric/value.js';
import { INDICATOR_COLOURS } from '../graph/harness.js';
import { writeGlb } from './glb.js';

/** Indicator grid (project spec section 10.5): 10 per row, 1.2 m apart. */
export const GRID_COLUMNS = 10;
export const GRID_SPACING = 1.2;
const HALF = 0.5; // cube half-size; exact in binary32, so the mesh data is exact

export interface GltfInput {
  readonly generator: string;
  /** `Copyright (c) YYYY, Owner` (requirements §14). */
  readonly copyright: string;
  /** Scene name: the asset name. */
  readonly sceneName: string;
  /** One indicator per sub-test, in sub-test order (material k belongs to sub-test k). */
  readonly indicatorNames: readonly string[];
  readonly interactivity: JsonNode;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;

/** A unit cube with flat normals: 24 vertices, 36 indices. */
function cube(): { positions: number[]; normals: number[]; indices: number[] } {
  const faces: readonly (readonly [readonly number[], readonly number[], readonly number[]])[] = [
    // normal, u axis, v axis (u × v = normal, so triangles wind counter-clockwise from outside)
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [0, 1, 0],
      [1, 0, 0],
    ],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach(([n, u, v], face) => {
    for (const [su, sv] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      for (let k = 0; k < 3; k++) {
        positions.push(HALF * ((n[k] as number) + su * (u[k] as number) + sv * (v[k] as number)) + 0);
        normals.push((n[k] as number) + 0);
      }
    }
    const b = face * 4;
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { positions, normals, indices };
}

/** Little-endian binary32 and uint16 data; every value written is exact in binary32. */
function packBin(c: ReturnType<typeof cube>): { bin: Uint8Array; views: readonly [number, number][] } {
  const floats = c.positions.length + c.normals.length;
  const bytes = new Uint8Array(floats * 4 + c.indices.length * 2);
  const view = new DataView(bytes.buffer);
  let at = 0;
  for (const x of [...c.positions, ...c.normals]) {
    view.setFloat32(at, x, true);
    at += 4;
  }
  for (const i of c.indices) {
    view.setUint16(at, i, true);
    at += 2;
  }
  const p = c.positions.length * 4;
  return {
    bin: bytes,
    views: [
      [0, p],
      [p, p],
      [2 * p, c.indices.length * 2],
    ],
  };
}

const nums = (xs: readonly F64[]): JsonNode => xs.map((x) => f64(x));
const ints = (xs: readonly number[]): JsonNode => xs.map((x) => i32(int(x)));

/** Builds the GLB bytes. */
export function buildGlb(input: GltfInput): Uint8Array {
  if (input.indicatorNames.length === 0) throw new Error('an asset needs at least one sub-test');
  const c = cube();
  const { bin, views } = packBin(c);
  const row = (k: number): number => Math.floor(k / GRID_COLUMNS);
  const translation = (k: number): F64[] => [
    (k % GRID_COLUMNS) * GRID_SPACING,
    (0 - row(k)) * GRID_SPACING,
    0,
  ];

  const doc = obj([
    [
      'asset',
      obj([
        ['version', '2.0'],
        ['generator', input.generator],
        ['copyright', input.copyright],
      ]),
    ],
    ['extensionsUsed', ['KHR_interactivity']],
    ['extensions', obj([['KHR_interactivity', input.interactivity]])],
    ['scene', i32(int(0))],
    [
      'scenes',
      [
        obj([
          ['name', input.sceneName],
          ['nodes', ints(input.indicatorNames.map((_, k) => k))],
        ]),
      ],
    ],
    [
      'nodes',
      input.indicatorNames.map((name, k) =>
        obj([
          ['name', name],
          ['mesh', i32(int(k))],
          ['translation', nums(translation(k))],
        ]),
      ),
    ],
    [
      'meshes',
      input.indicatorNames.map((_, k) =>
        obj([
          ['name', `indicator ${k}`],
          [
            'primitives',
            [
              obj([
                [
                  'attributes',
                  obj([
                    ['POSITION', i32(int(0))],
                    ['NORMAL', i32(int(1))],
                  ]),
                ],
                ['indices', i32(int(2))],
                ['material', i32(int(k))],
              ]),
            ],
          ],
        ]),
      ),
    ],
    [
      'materials',
      input.indicatorNames.map((_, k) =>
        obj([
          ['name', `indicator ${k}`],
          [
            'pbrMetallicRoughness',
            obj([
              ['baseColorFactor', nums(INDICATOR_COLOURS.initial)],
              ['metallicFactor', f64(0)],
              ['roughnessFactor', f64(1)],
            ]),
          ],
        ]),
      ),
    ],
    [
      'accessors',
      [
        obj([
          ['bufferView', i32(int(0))],
          ['componentType', i32(int(FLOAT))],
          ['count', i32(int(c.positions.length / 3))],
          ['type', 'VEC3'],
          ['min', nums([-HALF, -HALF, -HALF])],
          ['max', nums([HALF, HALF, HALF])],
        ]),
        obj([
          ['bufferView', i32(int(1))],
          ['componentType', i32(int(FLOAT))],
          ['count', i32(int(c.normals.length / 3))],
          ['type', 'VEC3'],
        ]),
        obj([
          ['bufferView', i32(int(2))],
          ['componentType', i32(int(UNSIGNED_SHORT))],
          ['count', i32(int(c.indices.length))],
          ['type', 'SCALAR'],
        ]),
      ],
    ],
    [
      'bufferViews',
      views.map(([offset, length], k) =>
        obj([
          ['buffer', i32(int(0))],
          ['byteOffset', i32(int(offset))],
          ['byteLength', i32(int(length))],
          ['target', i32(int(k === 2 ? ELEMENT_ARRAY_BUFFER : ARRAY_BUFFER))],
        ]),
      ),
    ],
    ['buffers', [obj([['byteLength', i32(int(bin.length))]])]],
  ]);
  // Graph JSON uses `graph` context: a NaN, ±Infinity or unflagged -0 literal is refused.
  return writeGlb(writeCanonicalJson(doc, { context: 'graph', indent: 0 }), bin);
}
