// `khr-itest-gen generate` (project spec section 14).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_LIMITS, DEFAULT_TOLERANCES, type Limits, type Tolerances } from '../generators/types.js';
import { compareRuns, flush } from '../generate/output.js';
import { dataPaths, PipelineError, runPipeline, type PipelineInput } from '../generate/pipeline.js';
import { SPEC_REVISION } from '../registry/specTables.js';
import { UsageError, type GenerateOptions } from './options.js';

/**
 * `--spec` is a commit id or a path. A commit id must match the vendored revision; a path must
 * be byte-identical to the vendored copy. There is no network access (requirements §5.2).
 */
export function resolveSpec(spec: string, dataDir: string): string {
  const vendored = join(dataDir, 'spec', 'Specification.adoc');
  if (/^[0-9a-f]{7,40}$/i.test(spec)) {
    const id = spec.toLowerCase();
    if (!(id.startsWith(SPEC_REVISION) || SPEC_REVISION.startsWith(id))) {
      throw new UsageError(`--spec ${spec} does not match the vendored revision ${SPEC_REVISION}`);
    }
    return vendored;
  }
  if (!existsSync(spec)) throw new UsageError(`--spec ${spec}: no such file`);
  if (!readFileSync(spec).equals(readFileSync(vendored))) {
    throw new UsageError(`--spec ${spec} differs from the vendored Specification at ${SPEC_REVISION}`);
  }
  return vendored;
}

interface ConfigFile {
  readonly limits?: Partial<Record<keyof Limits, number>>;
  readonly tolerances?: Partial<Record<keyof Tolerances, { r?: number; a?: number }>>;
}

/** Reads `--config`: optional `limits` and `tolerances` overrides; flags are not repeated there. */
export function loadConfig(path: string | undefined): { limits: Limits; tolerances: Tolerances } {
  if (path === undefined) return { limits: DEFAULT_LIMITS, tolerances: DEFAULT_TOLERANCES };
  const raw = JSON.parse(readFileSync(path, 'utf8')) as ConfigFile;
  const limits: Record<string, number> = { ...DEFAULT_LIMITS };
  for (const [key, value] of Object.entries(raw.limits ?? {})) {
    if (!(key in DEFAULT_LIMITS)) throw new UsageError(`config: unknown limit ${key}`);
    if (typeof value !== 'number' || !(value > 0))
      throw new UsageError(`config: limit ${key} must be a positive number`);
    limits[key] = value;
  }
  if ((limits['referenceBits'] ?? 0) < 128)
    throw new UsageError('config: referenceBits must be at least 128');
  const tolerances: Record<string, { r: number; a: number }> = { ...DEFAULT_TOLERANCES };
  for (const [key, value] of Object.entries(raw.tolerances ?? {})) {
    const base = tolerances[key];
    if (base === undefined) throw new UsageError(`config: unknown tolerance ${key}`);
    tolerances[key] = { r: value.r ?? base.r, a: value.a ?? base.a };
  }
  return { limits: limits as unknown as Limits, tolerances: tolerances as unknown as Tolerances };
}

export interface GenerateOutcome {
  readonly ok: boolean;
  readonly messages: readonly string[];
}

export async function generate(
  options: GenerateOptions & { readonly config?: string | undefined },
  dataDir: string,
): Promise<GenerateOutcome> {
  if (options.adapter !== undefined) {
    throw new UsageError(
      `--adapter ${options.adapter}: engine adapters are not available yet (project spec section 16)`,
    );
  }
  const { limits, tolerances } = loadConfig(options.config);
  const input: PipelineInput = {
    ...dataPaths(dataDir),
    specPath: resolveSpec(options.spec, dataDir),
    registryDir: resolve(options.registry),
    suiteRoot: resolve(options.suite),
    seed: options.seed,
    copyrightOwner: options.copyrightOwner,
    copyrightYear: options.copyrightYear,
    limits,
    tolerances,
    only: options.only,
  };
  const messages: string[] = [];
  try {
    const result = await runPipeline(input);
    for (const w of result.warnings)
      messages.push(`warning ${w.check}${w.asset === undefined ? '' : ` ${w.asset}`}: ${w.message}`);
    for (const f of result.failures)
      messages.push(`${f.check}${f.asset === undefined ? '' : ` ${f.asset}`}: ${f.message}`);
    if (options.verifyDeterminism) {
      const second = await runPipeline(input);
      for (const d of compareRuns(result.files, second.files)) messages.push(`determinism: ${d}`);
    }
    const ok = result.failures.length === 0 && !messages.some((m) => m.startsWith('determinism:'));
    if (ok) {
      flush(resolve(options.out), result.files);
      messages.push(`wrote ${result.built.length} assets (${result.files.size} files) to ${options.out}`);
    } else {
      messages.push('no files written');
    }
    return { ok, messages };
  } catch (error) {
    if (error instanceof PipelineError)
      return { ok: false, messages: [...error.problems, 'no files written'] };
    throw error;
  }
}
