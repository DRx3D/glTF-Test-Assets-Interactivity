// Existing suite reader (requirements §11; project spec section 9.1).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { readGlb } from '../asset/glb.js';

export interface ExistingSubTest {
  /** Asset name as the indexes write it, e.g. `math/abs`. */
  readonly asset: string;
  readonly name: string;
  readonly resultVar: { readonly id: number; readonly name: string; readonly type: string };
  readonly successVar: { readonly id: number; readonly name: string };
  readonly expected: readonly unknown[];
  readonly usedSchemas: readonly string[];
  /** True when the result variable doubles as the pass variable (suite convention, see readSuite). */
  readonly sharedPassVariable: boolean;
}

export interface InvalidCase {
  readonly id: string;
  readonly file: string;
  readonly expectedOutcome: string;
  readonly specSection: string;
}

export interface Inventory {
  readonly subTests: readonly ExistingSubTest[];
  readonly invalidCases: readonly InvalidCase[];
  /** Every directory name, file name, asset name and index name, for collision checks (§6.2). */
  readonly names: ReadonlySet<string>;
  readonly problems: readonly string[];
}

interface OracleSubTest {
  readonly name: string;
  readonly resultVarName: string;
  readonly resultVarId: number;
  readonly resultVarType: string;
  readonly expectedResultValue: readonly unknown[];
  readonly successResultVarId: number;
  readonly successResultVarName: string;
}

interface Oracle {
  readonly glbFileName: string;
  readonly name?: string;
  readonly usedSchemas?: readonly string[];
  readonly tests?: readonly {
    readonly subTests?: readonly OracleSubTest[];
    readonly usedSchemas?: readonly string[];
  }[];
  readonly subTests?: readonly OracleSubTest[];
}

interface GraphVariable {
  readonly name?: string;
  readonly type?: number;
}
interface Graph {
  readonly types?: readonly { readonly signature?: string }[];
  readonly variables?: readonly GraphVariable[];
}

const posix = (p: string): string => p.split(sep).join('/');
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** All files under `dir`, as paths relative to `root`, in sorted order. */
function walk(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort(byCodeUnit)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(root, full));
    } else {
      out.push(posix(relative(root, full)));
    }
  }
  return out;
}

/** Both oracle shapes: nested `tests[].subTests[]` (on disk) and the flat §7.4 list. */
function oracleSubTests(oracle: Oracle): { subTests: OracleSubTest[]; usedSchemas: string[] } {
  if (oracle.tests !== undefined) {
    return {
      subTests: oracle.tests.flatMap((t) => [...(t.subTests ?? [])]),
      usedSchemas: [
        ...new Set([...(oracle.usedSchemas ?? []), ...oracle.tests.flatMap((t) => t.usedSchemas ?? [])]),
      ],
    };
  }
  return { subTests: [...(oracle.subTests ?? [])], usedSchemas: [...(oracle.usedSchemas ?? [])] };
}

function readGraph(glbPath: string): Graph {
  const doc = JSON.parse(readGlb(new Uint8Array(readFileSync(glbPath))).json) as {
    extensions?: { KHR_interactivity?: { graphs?: Graph[]; graph?: number } };
  };
  const ext = doc.extensions?.KHR_interactivity;
  const graph = ext?.graphs?.[ext.graph ?? 0];
  if (graph === undefined) {
    throw new Error('no KHR_interactivity graph');
  }
  return graph;
}

/** Reads `Tests/Interactivity` (the existing suite root). */
export function readSuite(root: string): Inventory {
  const files = walk(root);
  const names = new Set<string>();
  const problems: string[] = [];
  const subTests: ExistingSubTest[] = [];

  for (const file of files) {
    for (const part of file.split('/')) names.add(part);
  }

  for (const file of files.filter((f) => /\/test-Json\/[^/]+\.json$/.test(f))) {
    const assetDir = dirname(dirname(file));
    const asset = assetDir;
    names.add(asset);
    let oracle: Oracle;
    try {
      oracle = JSON.parse(readFileSync(join(root, file), 'utf8')) as Oracle;
    } catch (error) {
      problems.push(`${file}: unreadable oracle (${String(error)})`);
      continue;
    }
    const glbPath = join(root, assetDir, 'glTF-Binary', oracle.glbFileName);
    let graph: Graph | undefined;
    if (existsSync(glbPath)) {
      try {
        graph = readGraph(glbPath);
      } catch (error) {
        problems.push(`${file}: ${String(error)}`);
      }
    } else {
      problems.push(`${file}: missing ${posix(relative(root, glbPath))}`);
    }
    const { subTests: list, usedSchemas } = oracleSubTests(oracle);
    for (const st of list) {
      if (graph !== undefined) {
        const resultVar = graph.variables?.[st.resultVarId];
        const successVar = graph.variables?.[st.successResultVarId];
        const typeOf = (v: GraphVariable | undefined): string | undefined =>
          v?.type === undefined ? undefined : graph?.types?.[v.type]?.signature;
        if (resultVar?.name !== st.resultVarName || typeOf(resultVar) !== st.resultVarType) {
          problems.push(`${asset} / ${st.name}: result variable ${st.resultVarId} does not match the GLB`);
        }
        // Suite convention: a bool sub-test expecting `true` may use its result variable as its
        // pass variable (same id). The oracle then names a HasPassed variable that does not exist.
        const shared =
          st.successResultVarId === st.resultVarId &&
          st.resultVarType === 'bool' &&
          st.expectedResultValue.length === 1 &&
          st.expectedResultValue[0] === true;
        if (!shared && (successVar?.name !== st.successResultVarName || typeOf(successVar) !== 'bool')) {
          problems.push(
            `${asset} / ${st.name}: pass variable ${st.successResultVarId} does not match the GLB`,
          );
        }
      }
      subTests.push({
        asset,
        name: st.name,
        resultVar: { id: st.resultVarId, name: st.resultVarName, type: st.resultVarType },
        successVar: { id: st.successResultVarId, name: st.successResultVarName },
        expected: st.expectedResultValue,
        usedSchemas,
        sharedPassVariable: st.successResultVarId === st.resultVarId,
      });
    }
  }

  for (const index of ['test-index.json', 'mathtests-index.json']) {
    const path = join(root, index);
    if (!existsSync(path)) continue;
    for (const entry of JSON.parse(readFileSync(path, 'utf8')) as { name?: string }[]) {
      if (entry.name !== undefined) names.add(entry.name);
    }
  }

  const invalidCases: InvalidCase[] = [];
  const invalidIndex = join(root, 'invalid', 'invalid-index.json');
  if (existsSync(invalidIndex)) {
    for (const e of JSON.parse(readFileSync(invalidIndex, 'utf8')) as Record<string, unknown>[]) {
      const variants = (e.variants ?? {}) as Record<string, string>;
      invalidCases.push({
        id: String(e.id),
        file: `${String(e.name)}/${variants.glTF ?? ''}`,
        expectedOutcome: String(e.expectedOutcome),
        specSection: String(e.specSection),
      });
    }
  }

  return {
    subTests: subTests.sort((a, b) => byCodeUnit(a.asset, b.asset) || byCodeUnit(a.name, b.name)),
    invalidCases,
    names,
    problems,
  };
}

/** The suite root relative to the Generator package, as in the repository layout. */
export const defaultSuiteRoot = (dataDir: string): string =>
  join(dataDir, '..', '..', 'Tests', 'Interactivity');

export const assetBaseName = (asset: string): string => basename(asset);
