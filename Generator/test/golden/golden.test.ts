// Golden test (project spec section 15): the reduced registry generated end to end, compared
// byte for byte with the committed output in test/golden/out/. To accept a change after
// review, run `UPDATE_GOLDEN=1 npx vitest run test/golden` and commit the new output.

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { compareRuns, flush } from '../../src/generate/output.js';
import type { PipelineResult } from '../../src/generate/pipeline.js';
import { GOLDEN_OUT, goldenRun } from './run.js';

function readTree(root: string): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else out.set(relative(root, path).split(sep).join('/'), new Uint8Array(readFileSync(path)));
    }
  };
  if (existsSync(root)) walk(root);
  return out;
}

let run: PipelineResult;
beforeAll(async () => {
  run = await goldenRun();
  if (process.env['UPDATE_GOLDEN'] === '1' && run.failures.length === 0) {
    rmSync(GOLDEN_OUT, { recursive: true, force: true });
    flush(GOLDEN_OUT, run.files);
  }
});

describe('golden output', () => {
  it('passes every self-check, V4 included', () => {
    expect(run.failures).toEqual([]);
    expect(run.warnings).toEqual([]);
  });

  it('matches the committed output byte for byte', () => {
    expect(compareRuns(readTree(GOLDEN_OUT), run.files)).toEqual([]);
  });

  it('covers or explains every in-scope target of the reduced registry', () => {
    const byId = new Map(run.outcomes.map((o) => [o.target.id, o]));
    expect(byId.get('S-2626')?.status).toBe('covered-supplemental');
    expect(byId.get('S-3203')?.status).toBe('covered-existing');
    expect(byId.get('T-math/div-float2')?.reason).toMatch(/R1/);
  });
});
