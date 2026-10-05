// Canonical JSON writer (project spec section 5.5). JSON.stringify writes NaN and ±Infinity
// as null and -0 as 0, and orders integer-like keys first, so generated files are written
// from a typed tree instead: every number is tagged, and object keys keep the order given.

import { formatF64, formatInt, specialName, type NumberContext } from './format.js';
import type { F64, Int32 } from './value.js';

export class F64Num {
  constructor(
    readonly value: F64,
    readonly allowLiteralNegZero = false,
  ) {}
}

export class IntNum {
  constructor(readonly value: Int32) {}
}

export class JsonObject {
  constructor(readonly entries: readonly (readonly [string, JsonNode])[]) {
    const seen = new Set<string>();
    for (const [key] of entries) {
      if (seen.has(key)) {
        throw new Error(`duplicate key ${key}`);
      }
      seen.add(key);
    }
  }
}

export type JsonNode = null | boolean | string | F64Num | IntNum | JsonObject | readonly JsonNode[];

/** Helpers for building trees. */
export const f64 = (x: F64, allowLiteralNegZero = false): F64Num => new F64Num(x, allowLiteralNegZero);
export const i32 = (x: Int32): IntNum => new IntNum(x);
export const obj = (entries: readonly (readonly [string, JsonNode])[]): JsonObject => new JsonObject(entries);

export interface WriteOptions {
  /** `oracle` writes special float values as strings; `graph` refuses them. */
  readonly context: Exclude<NumberContext, 'text'>;
  /** Spaces per indentation level; 0 writes compact JSON (used for the GLB JSON chunk). */
  readonly indent: number;
}

const ESCAPES: Readonly<Record<string, string>> = {
  '"': '\\"',
  '\\': '\\\\',
  '\b': '\\b',
  '\f': '\\f',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/** JSON string literal; non-ASCII characters are written as-is (files are UTF-8). */
export function quote(s: string): string {
  let out = '"';
  for (const ch of s) {
    const escaped = ESCAPES[ch];
    if (escaped !== undefined) {
      out += escaped;
    } else if (ch < ' ') {
      out += `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  return `${out}"`;
}

function writeNumber(node: F64Num, context: WriteOptions['context']): string {
  const text = formatF64(node.value, context, { allowLiteralNegZero: node.allowLiteralNegZero });
  return context === 'oracle' && specialName(node.value) !== undefined ? quote(text) : text;
}

function write(node: JsonNode, options: WriteOptions, depth: number): string {
  if (node === null) return 'null';
  if (typeof node === 'boolean') return node ? 'true' : 'false';
  if (typeof node === 'string') return quote(node);
  if (node instanceof F64Num) return writeNumber(node, options.context);
  if (node instanceof IntNum) return formatInt(node.value);
  if (typeof node === 'number') {
    throw new TypeError('untagged number in JSON tree; use f64() or i32()');
  }

  const items: string[] =
    node instanceof JsonObject
      ? node.entries.map(
          ([key, value]) =>
            `${quote(key)}${options.indent > 0 ? ': ' : ':'}${write(value, options, depth + 1)}`,
        )
      : node.map((value) => write(value, options, depth + 1));
  const [open, close] = node instanceof JsonObject ? ['{', '}'] : ['[', ']'];
  if (items.length === 0) {
    return open + close;
  }
  if (options.indent === 0) {
    return open + items.join(',') + close;
  }
  const inner = ' '.repeat(options.indent * (depth + 1));
  const outer = ' '.repeat(options.indent * depth);
  return `${open}\n${inner}${items.join(`,\n${inner}`)}\n${outer}${close}`;
}

/** Writes a JSON tree. Pretty output ends with a newline, compact output does not. */
export function writeCanonicalJson(node: JsonNode, options: WriteOptions): string {
  const text = write(node, options, 0);
  return options.indent > 0 ? `${text}\n` : text;
}
