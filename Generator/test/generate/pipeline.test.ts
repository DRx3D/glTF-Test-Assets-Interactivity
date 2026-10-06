import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { generate, loadConfig, resolveSpec } from '../../src/cli/generate.js';
import { UsageError } from '../../src/cli/options.js';
import { compareRuns } from '../../src/generate/output.js';
import { PipelineError, runPipeline } from '../../src/generate/pipeline.js';
import { callName } from '../../src/generators/common.js';
import { prerequisitesGenerator } from '../../src/generators/prerequisites/harness.js';
import type { CategoryGenerator } from '../../src/generators/types.js';
import { intScalar } from '../../src/graph/scalar.js';
import { int } from '../../src/numeric/value.js';
import { DEFAULT_DATA_DIR } from '../../src/registry/check.js';
import { defaultSuiteRoot } from '../../src/existing/reader.js';
import { goldenInput, goldenRun } from '../golden/run.js';

const temp = mkdtempSync(join(tmpdir(), 'khr-itest-gen-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

/** A generator that plans one asset per name, each with one div sub-test covering `targets`. */
const fake = (id: string, names: readonly string[], targets: readonly string[] = []): CategoryGenerator => ({
  id,
  category: 'prerequisites',
  alwaysRun: true,
  plan: () => ({
    assets: names.map((subject) => ({
      category: 'prerequisites' as const,
      subject,
      facet: 'types' as const,
      description: 'fake',
      subTests: [
        {
          op: 'math/div',
          inputs: [
            { socket: 'a', type: 'int' as const, value: { kind: 'int' as const, value: int(7) } },
            { socket: 'b', type: 'int' as const, value: { kind: 'int' as const, value: int(2) } },
          ],
          resultType: 'int' as const,
          targets,
          valueClasses: [],
          comparison: { mode: 'exact' as const },
          expected: () => intScalar(3),
          name: (inputs, e) => callName('math/div', inputs, e),
        },
      ],
    })),
    notCoverable: [],
  }),
});

describe('pipeline', () => {
  it('is deterministic: two runs give identical bytes (§5.3)', async () => {
    const second = await runPipeline(goldenInput());
    expect(compareRuns((await goldenRun()).files, second.files)).toEqual([]);
  });

  it('fails V4 on the full registry, and skips V4 for --only runs', async () => {
    const full = {
      ...goldenInput(),
      registryDir: join(DEFAULT_DATA_DIR, 'registry'),
      coveragePath: join(DEFAULT_DATA_DIR, 'existing-coverage.yaml'),
    };
    const all = await runPipeline(full);
    expect(all.failures.some((f) => f.check === 'V4')).toBe(true);
    expect(all.failures.every((f) => f.check === 'V4')).toBe(true);
    const partial = await runPipeline({ ...full, only: ['prerequisites', 'math/div'] });
    expect(partial.failures).toEqual([]);
    const report = JSON.parse(new TextDecoder().decode(partial.files.get('supplemental-coverage.json'))) as {
      inputs: { partial: boolean };
    };
    expect(report.inputs.partial).toBe(true);
  });

  it('rejects unknown --only ids, duplicate names and unexplained targets before building', async () => {
    await expect(runPipeline({ ...goldenInput(), only: ['nope'] })).rejects.toThrow(PipelineError);
    await expect(
      runPipeline({ ...goldenInput(), generators: [fake('a/b', ['dup', 'dup'])] }),
    ).rejects.toThrow(/generated twice/);
    const owner: CategoryGenerator = { ...fake('math/div', []), alwaysRun: false };
    await expect(runPipeline({ ...goldenInput(), generators: [owner] })).rejects.toThrow(
      /neither covered nor explained/,
    );
    await expect(
      runPipeline({ ...goldenInput(), generators: [fake('a/b', ['Float'])] }),
    ).resolves.toBeDefined();
  });

  it('drops targets that are not gaps (§4.3)', async () => {
    const run = await runPipeline({
      ...goldenInput(),
      generators: [fake('a/b', ['x'], ['S-3203']), prerequisitesGenerator],
    });
    // The fake prerequisites-category sub-test survives without targets; S-3203 is covered by the suite.
    expect(run.built.flatMap((b) => b.asset.subTests.flatMap((s) => s.targets))).not.toContain('S-3203');
  });
});

describe('generate command', () => {
  it('resolves --spec against the vendored copy only', () => {
    const vendored = join(DEFAULT_DATA_DIR, 'spec', 'Specification.adoc');
    expect(resolveSpec('c5d1e1e8', DEFAULT_DATA_DIR)).toBe(vendored);
    expect(resolveSpec(vendored, DEFAULT_DATA_DIR)).toBe(vendored);
    expect(() => resolveSpec('abcdef0', DEFAULT_DATA_DIR)).toThrow(UsageError);
    expect(() => resolveSpec(join(temp, 'missing.adoc'), DEFAULT_DATA_DIR)).toThrow(/no such file/);
    const other = join(temp, 'other.adoc');
    writeFileSync(other, 'different');
    expect(() => resolveSpec(other, DEFAULT_DATA_DIR)).toThrow(/differs/);
  });

  it('reads limits and tolerances from --config', () => {
    const path = join(temp, 'config.json');
    writeFileSync(path, '{"limits":{"maxSubTests":50},"tolerances":{"composite":{"r":1e-10}}}');
    const cfg = loadConfig(path);
    expect(cfg.limits.maxSubTests).toBe(50);
    expect(cfg.limits.maxNodes).toBe(2000);
    expect(cfg.tolerances.composite).toEqual({ r: 1e-10, a: 1e-12 });
    for (const bad of [
      '{"limits":{"nope":1}}',
      '{"limits":{"maxNodes":-1}}',
      '{"limits":{"referenceBits":64}}',
      '{"tolerances":{"nope":{}}}',
    ]) {
      writeFileSync(path, bad);
      expect(() => loadConfig(path)).toThrow(UsageError);
    }
  });

  it('writes files only when every check passes, and verifies determinism', async () => {
    const base = {
      spec: 'c5d1e1e8',
      suite: defaultSuiteRoot(DEFAULT_DATA_DIR),
      registry: join(DEFAULT_DATA_DIR, 'registry'),
      seed: 0x4b48525f494e5445n,
      copyrightOwner: 'Owner',
      copyrightYear: 2026,
      adapter: undefined,
    };
    const failed = await generate(
      { ...base, out: join(temp, 'full'), only: undefined, verifyDeterminism: false },
      DEFAULT_DATA_DIR,
    );
    expect(failed.ok).toBe(false);
    expect(failed.messages.at(-1)).toBe('no files written');
    expect(() => readdirSync(join(temp, 'full'))).toThrow();

    const ok = await generate(
      { ...base, out: join(temp, 'slice'), only: ['prerequisites', 'math/div'], verifyDeterminism: true },
      DEFAULT_DATA_DIR,
    );
    expect(ok.ok).toBe(true);
    expect(readdirSync(join(temp, 'slice')).sort()).toEqual([
      'math',
      'prerequisites',
      'supplemental-coverage.json',
      'supplemental-coverage.md',
      'supplemental-index.json',
    ]);

    const unknown = await generate(
      { ...base, out: join(temp, 'x'), only: ['nope'], verifyDeterminism: false },
      DEFAULT_DATA_DIR,
    );
    expect(unknown.messages[0]).toMatch(/no generator nope/);
    await expect(
      generate(
        { ...base, out: temp, only: undefined, verifyDeterminism: false, adapter: 'babylon' },
        DEFAULT_DATA_DIR,
      ),
    ).rejects.toThrow(UsageError);
  });
});
