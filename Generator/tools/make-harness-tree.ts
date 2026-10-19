// Builds a sample-asset tree for the authoring tool's harness (glTF-InteractivityGraph-AuthoringTool,
// `npm run test:assets:core` / `test:assets:e2e`): a copy of the existing suite with the generated
// assets added under `Tests/Interactivity`, as if the supplemental output had been written there.
// The harness needs the whole suite (both index files and `Overview.json`) and picks up the
// unindexed supplemental assets by their `test-Json/*.json` files.
//
//   npx tsx tools/make-harness-tree.ts <generated output> <tree>
//
// Then, in the authoring tool, set KHR_INTERACTIVITY_SAMPLE_ASSETS=<tree> and, to run one asset,
// KHR_INTERACTIVITY_ASSET_NAME_FILTER=<asset name>. The tree is disposable; keep it under out/.

import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { DEFAULT_DATA_DIR } from '../src/registry/check.js';
import { defaultSuiteRoot } from '../src/existing/reader.js';

const [outputArg, treeArg] = process.argv.slice(2);
if (outputArg === undefined || treeArg === undefined) {
  process.stderr.write('usage: make-harness-tree <generated output> <tree>\n');
  process.exit(2);
}
const output = resolve(outputArg);
const suite = resolve(defaultSuiteRoot(DEFAULT_DATA_DIR));
const target = join(resolve(treeArg), 'Tests', 'Interactivity');

/** Asset directories in the generated output: those with a `test-Json` child. */
function assetDirs(dir: string): string[] {
  const entries = readdirSync(dir).sort();
  if (entries.includes('test-Json')) return [dir];
  return entries.flatMap((e) => (statSync(join(dir, e)).isDirectory() ? assetDirs(join(dir, e)) : []));
}

const assets = assetDirs(output).map((d) => relative(output, d).split(sep).join('/'));
if (assets.length === 0) {
  process.stderr.write(`no generated assets found under ${output}\n`);
  process.exit(1);
}
const collisions = assets.filter((a) => existsSync(join(suite, a)));
if (collisions.length > 0) {
  process.stderr.write(`assets already in the existing suite: ${collisions.join(', ')}\n`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(suite, target, { recursive: true });
for (const a of assets) cpSync(join(output, a), join(target, a), { recursive: true });
process.stdout.write(
  `${resolve(treeArg)}: existing suite plus ${assets.length} asset(s): ${assets.join(', ')}\n`,
);
