// The generation pipeline (project spec section 4): load data, find gaps, plan, split and
// name, draw, compute, build, stage and check. Everything stays in memory; the caller writes
// the staging tree only when there are no failures (requirements §5.5).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAsset, copyrightLine, type BuiltAsset } from '../asset/build.js';
import type { Category, ResolvedAsset, ResolvedSubTest, SpecRef } from '../asset/model.js';
import { assetName, splitGreedy } from '../asset/naming.js';
import { indexJson } from '../asset/supplementalIndex.js';
import { determineGaps, loadCoverageMapping, type GapReport } from '../existing/coverage.js';
import { readSuite } from '../existing/reader.js';
import { signatureLine } from '../generators/common.js';
import { GENERATORS } from '../generators/index.js';
import type {
  CategoryGenerator,
  Limits,
  NotCoverable,
  PlanContext,
  SubTestPlan,
  Tolerances,
} from '../generators/types.js';
import { buildHarness } from '../graph/harness.js';
import { float, intScalar, bool, type Scalar } from '../graph/scalar.js';
import { int } from '../numeric/value.js';
import { SplitMix64 } from '../prng/splitmix64.js';
import { GmpReference } from '../reference/reference.js';
import { loadCatalogue, type OperationCatalogue } from '../registry/catalogue.js';
import { checkInterpretations } from '../registry/interpretations.js';
import { SPEC_REVISION } from '../registry/specTables.js';
import { checkRegistry, loadRegistryFiles, type Target } from '../registry/targets.js';
import { coverageJson, coverageMarkdown } from '../report/coverage.js';
import type { InputValue, ScatterSlot } from '../sampling/combine.js';
import { fillScatterSlots } from '../sampling/slots.js';
import { checkAsset, type CheckMessage } from '../validate/checks.js';
import { checkV4, checkV5, targetOutcomes, type TargetOutcome } from '../validate/coverage.js';
import { compileInteractivitySchema } from '../validate/schema.js';
import { parse } from 'yaml';

export interface PipelineInput {
  /** The vendored Specification.adoc. */
  readonly specPath: string;
  readonly schemaDir: string;
  readonly cataloguePath: string;
  readonly registryDir: string;
  readonly coveragePath: string;
  readonly interpretationsPath: string;
  readonly suiteRoot: string;
  readonly seed: bigint;
  readonly copyrightOwner: string;
  readonly copyrightYear: number;
  readonly limits: Limits;
  readonly tolerances: Tolerances;
  /** Generator ids for a partial run (`--only`). */
  readonly only?: readonly string[] | undefined;
  /** Generators to use; defaults to every implemented generator. */
  readonly generators?: readonly CategoryGenerator[];
}

export interface PipelineResult {
  /** POSIX path → bytes; written only when `failures` is empty. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly failures: readonly CheckMessage[];
  readonly warnings: readonly CheckMessage[];
  readonly built: readonly BuiltAsset[];
  readonly outcomes: readonly TargetOutcome[];
}

/** A failure found before any asset is built (data problems, collisions, plan errors). */
export class PipelineError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(problems.join('\n'));
  }
}

/** A plan's sub-test with the asset it belongs to, before naming. */
interface PlannedAsset {
  readonly category: Category;
  readonly subject: string;
  readonly facet: string;
  readonly description: string;
  readonly subTests: readonly SubTestPlan[];
}

const encoder = new TextEncoder();
const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const slotsOf = (st: SubTestPlan): ScatterSlot[] =>
  st.inputs.flatMap((i) => (i.value.kind === 'scatter' ? [i.value.slot] : []));

/** An input as a scalar. Unfilled scatter slots get an ordinary value (node estimates only). */
function scalarOf(type: 'bool' | 'int' | 'float', v: InputValue, allowUnfilled: boolean): Scalar {
  if (v.kind === 'scatter') {
    if (v.slot.value === undefined) {
      if (!allowUnfilled) throw new Error('scatter slot not filled');
      return type === 'int' ? intScalar(7) : float(1.25);
    }
    return type === 'int' ? intScalar(int(v.slot.value)) : float(v.slot.value);
  }
  if (v.kind === 'bool') return bool(v.value);
  if (v.kind === 'int') return intScalar(v.value);
  return float(v.value);
}

function resolveSubTest(
  st: SubTestPlan,
  specRefs: readonly SpecRef[],
  allowUnfilled: boolean,
  fallbackName?: string,
): ResolvedSubTest {
  const values = st.inputs.map((i) => scalarOf(i.type, i.value, allowUnfilled));
  const expected = st.expected(values);
  if (expected.type !== st.resultType)
    throw new Error(`${st.op}: expected ${expected.type} for a ${st.resultType} result`);
  return {
    name: fallbackName ?? st.name(values, expected),
    op: st.op,
    inputs: st.inputs.map((i, k) => ({
      socket: i.socket,
      value: values[k] as Scalar,
      ...(i.literalNegZero === true ? { literalNegZero: true } : {}),
    })),
    resultType: st.resultType,
    expected,
    comparison: st.comparison,
    targets: st.targets,
    specRefs,
    valueClasses: st.valueClasses,
    interpretations: st.interpretations ?? [],
  };
}

function specRefsFor(
  st: SubTestPlan,
  targets: ReadonlyMap<string, Target>,
  catalogue: OperationCatalogue,
): SpecRef[] {
  const refs: SpecRef[] = [];
  const add = (line: number, section: string): void => {
    if (!refs.some((r) => r.line === line && r.section === section))
      refs.push({ revision: SPEC_REVISION, line, section });
  };
  for (const id of st.targets) {
    const t = targets.get(id);
    if (t?.specRef !== undefined) add(t.specRef.line, t.specRef.section);
    else if (t !== undefined && t.covers !== 'TODO' && t.covers.op !== undefined) {
      // Type and edge targets cite the operation's table for the input types in use.
      add(
        signatureLine(
          catalogue,
          t.covers.op,
          st.inputs.map((i) => i.type),
        ),
        t.covers.op,
      );
    }
  }
  for (const r of st.extraSpecRefs ?? []) add(r.line, r.section);
  return refs;
}

/** Nodes an asset would have, built with placeholder values for scatter slots. */
function estimateNodes(
  catalogue: OperationCatalogue,
  plan: PlannedAsset,
  part: readonly SubTestPlan[],
): number {
  const subTests = part.map((st, k) => resolveSubTest(st, [], true, `estimate ${k}`));
  return buildHarness(catalogue, subTests, { testName: `${plan.category}/estimate`, expectedDuration: 0 })
    .graph.ops.length;
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  // 1. Load and validate data.
  const specLineCount = readFileSync(input.specPath, 'utf8').split(/\r?\n/).length;
  const catalogue = loadCatalogue(input.cataloguePath);
  const ctxCheck = { specRevision: SPEC_REVISION, specLineCount, catalogue };
  const { registry, problems: registryProblems } = checkRegistry(
    loadRegistryFiles(input.registryDir),
    ctxCheck,
  );
  const interp = checkInterpretations(parse(readFileSync(input.interpretationsPath, 'utf8')), {
    ...ctxCheck,
    registry,
  });
  const inventory = readSuite(input.suiteRoot);
  const mapping = loadCoverageMapping(input.coveragePath);
  const gaps: GapReport = determineGaps(registry, inventory, mapping);
  const dataProblems = [
    ...registryProblems.map((p) => `${p.file}: ${p.message}`),
    ...interp.problems.map((p) => `${p.file}: ${p.message}`),
    ...inventory.problems.map((p) => `existing suite: ${p}`),
    ...gaps.problems.map((p) => `coverage mapping: ${p}`),
  ];
  if (dataProblems.length > 0) throw new PipelineError(dataProblems);

  // 2. Plan with every generator that owns gaps (or always runs).
  const all = input.generators ?? GENERATORS;
  const unknown = (input.only ?? []).filter((id) => !all.some((g) => g.id === id));
  if (unknown.length > 0) throw new PipelineError(unknown.map((id) => `--only: no generator ${id}`));
  const selected = input.only === undefined ? all : all.filter((g) => input.only?.includes(g.id));
  const ctx: PlanContext = {
    catalogue,
    ref: await GmpReference.create(),
    limits: input.limits,
    tolerances: input.tolerances,
    interpretations: interp.interpretations,
  };
  const gapTargets = gaps.targets.filter((t) => t.status === 'gap').map((t) => t.target);
  const gapIds = new Set(gapTargets.map((t) => t.id));
  const planProblems: string[] = [];
  const planned: PlannedAsset[] = [];
  const notCoverable: NotCoverable[] = [];
  for (const gen of selected) {
    const owned = gapTargets.filter((t) => t.generator === gen.id);
    if (owned.length === 0 && gen.alwaysRun !== true) continue;
    const result = gen.plan(ctx, owned);
    notCoverable.push(...result.notCoverable);
    for (const asset of result.assets) {
      // Supplemental only (§4.3): drop targets that are not gaps, then empty sub-tests.
      const subTests = asset.subTests
        .map((st) => ({ ...st, targets: st.targets.filter((id) => gapIds.has(id)) }))
        .filter((st) => st.targets.length > 0 || asset.category === 'prerequisites');
      if (subTests.length > 0) planned.push({ ...asset, subTests });
    }
    const covered = new Set(result.assets.flatMap((a) => a.subTests.flatMap((st) => st.targets)));
    const explained = new Set(result.notCoverable.map((n) => n.target));
    for (const t of owned) {
      if (!covered.has(t.id) && !explained.has(t.id))
        planProblems.push(`${gen.id}: ${t.id} neither covered nor explained`);
    }
  }

  // 3. Split, name and check names against the suite and each other (§6.2, §7.7).
  const named: { name: string; plan: PlannedAsset; subTests: readonly SubTestPlan[] }[] = [];
  for (const plan of planned) {
    const parts = splitGreedy(plan.subTests, input.limits.maxSubTests, input.limits.maxNodes, (part) =>
      estimateNodes(catalogue, plan, part),
    );
    parts.forEach((subTests, k) => {
      named.push({
        name: assetName(plan.subject, plan.facet, parts.length > 1 ? k + 1 : undefined),
        plan,
        subTests,
      });
    });
  }
  const seen = new Set<string>();
  for (const a of named) {
    if (inventory.names.has(a.name))
      planProblems.push(`asset name ${a.name} collides with the existing suite`);
    if (seen.has(a.name)) planProblems.push(`asset name ${a.name} is generated twice`);
    seen.add(a.name);
  }
  if (planProblems.length > 0) throw new PipelineError(planProblems);

  // 4. Draw scatter values in asset-name order (§8.10).
  fillScatterSlots(
    named.map((a) => ({ name: a.name, subTests: a.subTests.map((st) => ({ slots: slotsOf(st) })) })),
    new SplitMix64(input.seed),
  );

  // 5. Resolve inputs, expected values and names; 6. build files.
  const copyright = copyrightLine(input.copyrightYear, input.copyrightOwner);
  const resolved: ResolvedAsset[] = named
    .slice()
    .sort((a, b) => byCode(`${a.plan.category}/${a.name}`, `${b.plan.category}/${b.name}`))
    .map((a) => ({
      category: a.plan.category,
      name: a.name,
      description: a.plan.description,
      subTests: a.subTests.map((st) =>
        resolveSubTest(st, specRefsFor(st, registry.targets, catalogue), false),
      ),
      expectedDuration: 0,
    }));
  for (const asset of resolved) {
    const names = asset.subTests.map((st) => st.name);
    const dup = names.find((nm, k) => names.indexOf(nm) !== k);
    if (dup !== undefined)
      planProblems.push(`${asset.category}/${asset.name}: sub-test name "${dup}" is not unique`);
  }
  if (planProblems.length > 0) throw new PipelineError(planProblems);
  const built = resolved.map((asset) => buildAsset(asset, { catalogue, seed: input.seed, copyright }));

  // 7. Self-checks.
  const schema = compileInteractivitySchema(input.schemaDir);
  const failures: CheckMessage[] = [];
  const warnings: CheckMessage[] = [];
  for (const b of built) {
    const r = await checkAsset(b, schema, input.limits);
    failures.push(...r.failures);
    warnings.push(...r.warnings);
  }
  const outcomes = targetOutcomes({
    gaps,
    built,
    notCoverable,
    implemented: new Set(all.map((g) => g.id)),
    ran: new Set(selected.map((g) => g.id)),
  });
  const partial = input.only !== undefined;
  if (!partial) failures.push(...checkV4(outcomes, notCoverable));
  failures.push(...checkV5(gaps, built, inventory));

  // 8. Staging tree.
  const files = new Map<string, Uint8Array>();
  for (const b of built) {
    files.set(b.paths.glb, b.glb);
    files.set(b.paths.oracle, encoder.encode(b.oracle));
    files.set(b.paths.description, encoder.encode(b.description));
  }
  const report = {
    suiteRevision: mapping.suiteRevision,
    seed: input.seed,
    copyright,
    limits: input.limits,
    tolerances: input.tolerances,
    partial,
    built,
    outcomes,
    mapping,
    interpretations: interp.interpretations,
  };
  files.set('supplemental-index.json', encoder.encode(indexJson(built.map((b) => b.index))));
  files.set('supplemental-coverage.json', encoder.encode(coverageJson(report)));
  files.set('supplemental-coverage.md', encoder.encode(coverageMarkdown(report)));
  const sorted = new Map([...files].sort(([a], [b]) => byCode(a, b)));
  return { files: sorted, failures, warnings, built, outcomes };
}

/** Default data locations under Generator/data. */
export const dataPaths = (
  dataDir: string,
): Pick<
  PipelineInput,
  'specPath' | 'schemaDir' | 'cataloguePath' | 'registryDir' | 'coveragePath' | 'interpretationsPath'
> => ({
  specPath: join(dataDir, 'spec', 'Specification.adoc'),
  schemaDir: join(dataDir, 'spec', 'schema'),
  cataloguePath: join(dataDir, 'operations.yaml'),
  registryDir: join(dataDir, 'registry'),
  coveragePath: join(dataDir, 'existing-coverage.yaml'),
  interpretationsPath: join(dataDir, 'interpretations.yaml'),
});
