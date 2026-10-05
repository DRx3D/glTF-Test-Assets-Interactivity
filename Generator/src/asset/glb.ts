// Binary glTF (GLB) container writer and reader (glTF 2.0 specification, "GLB File Format
// Specification"; project spec section 11.2). The JSON chunk text must come from the
// canonical JSON writer, so the bytes are fully determined by the caller.

const MAGIC = 0x46546c67; // "glTF"
const VERSION = 2;
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const CHUNK_BIN = 0x004e4942; // "BIN\0"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;

const padded = (length: number): number => Math.ceil(length / 4) * 4;

/**
 * Builds a GLB file. The JSON chunk is padded with spaces (0x20) and the BIN chunk with
 * zeros, both to 4-byte boundaries. No BIN chunk is written when `bin` is undefined.
 */
export function writeGlb(json: string, bin?: Uint8Array): Uint8Array {
  const jsonBytes = new TextEncoder().encode(json);
  const jsonLength = padded(jsonBytes.length);
  const binLength = bin === undefined ? 0 : padded(bin.length);
  const total =
    HEADER_BYTES + CHUNK_HEADER_BYTES + jsonLength + (bin === undefined ? 0 : CHUNK_HEADER_BYTES + binLength);

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, total, true);

  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  out.fill(0x20, 20 + jsonBytes.length, 20 + jsonLength);

  if (bin !== undefined) {
    const at = 20 + jsonLength;
    view.setUint32(at, binLength, true);
    view.setUint32(at + 4, CHUNK_BIN, true);
    out.set(bin, at + 8);
    // Remaining bytes are already zero.
  }
  return out;
}

export interface ParsedGlb {
  readonly json: string;
  readonly bin: Uint8Array | undefined;
}

/** Parses a GLB file; throws on a malformed header or chunk layout. */
export function readGlb(bytes: Uint8Array): ParsedGlb {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER_BYTES || view.getUint32(0, true) !== MAGIC) {
    throw new Error('not a GLB file');
  }
  if (view.getUint32(4, true) !== VERSION) {
    throw new Error('unsupported GLB version');
  }
  if (view.getUint32(8, true) !== bytes.byteLength) {
    throw new Error('GLB length does not match file size');
  }
  let at = HEADER_BYTES;
  let json: string | undefined;
  let bin: Uint8Array | undefined;
  while (at < bytes.byteLength) {
    const length = view.getUint32(at, true);
    const type = view.getUint32(at + 4, true);
    const data = bytes.subarray(at + CHUNK_HEADER_BYTES, at + CHUNK_HEADER_BYTES + length);
    if (type === CHUNK_JSON) {
      json = new TextDecoder().decode(data).replace(/ +$/, '');
    } else if (type === CHUNK_BIN) {
      bin = data;
    }
    at += CHUNK_HEADER_BYTES + length;
  }
  if (json === undefined) {
    throw new Error('GLB has no JSON chunk');
  }
  return { json, bin };
}
