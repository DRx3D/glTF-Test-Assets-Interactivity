// Writing the staging tree and verifying determinism (requirements §5.3, §5.5, §12 item 5;
// project spec section 13.2).

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Writes every staged file under `outDir`. Call only when every check passed. */
export function flush(outDir: string, files: ReadonlyMap<string, Uint8Array>): void {
  for (const [path, bytes] of files) {
    const target = join(outDir, ...path.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
}

export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/**
 * Compares two staging trees file by file. Returns one line per difference: a file present
 * in only one run, or the first differing byte offset.
 */
export function compareRuns(
  a: ReadonlyMap<string, Uint8Array>,
  b: ReadonlyMap<string, Uint8Array>,
): string[] {
  const out: string[] = [];
  const paths = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  for (const path of paths) {
    const x = a.get(path);
    const y = b.get(path);
    if (x === undefined || y === undefined) {
      out.push(`${path}: only in run ${x === undefined ? 2 : 1}`);
      continue;
    }
    if (sha256(x) === sha256(y)) continue;
    let at = 0;
    while (at < x.length && at < y.length && x[at] === y[at]) at++;
    out.push(`${path}: first difference at byte ${at}`);
  }
  return out;
}
