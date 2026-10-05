// Drafts data/existing-coverage.yaml from the registry notes copied out of the coverage report
// (project spec sections 8.3 and 9.4). Every entry it writes is marked for review, and every
// target the report calls covered but this tool cannot map is listed for a person to map.
//
//   npx tsx tools/bootstrap-coverage.ts [--force]

import { existsSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { DEFAULT_DATA_DIR, loadDataSet } from '../src/registry/check.js';
import { defaultSuiteRoot, readSuite } from '../src/existing/reader.js';
import type { CoverageMapping } from '../src/existing/coverage.js';

const SUITE_REVISION = '9ffd30e';
const outPath = `${DEFAULT_DATA_DIR}/existing-coverage.yaml`;
if (existsSync(outPath) && !process.argv.includes('--force')) {
  process.stderr.write('existing-coverage.yaml exists; use --force to overwrite\n');
  process.exit(2);
}

const data = loadDataSet();
const inventory = readSuite(defaultSuiteRoot(DEFAULT_DATA_DIR));
const invalidIds = new Set(inventory.invalidCases.map((c) => c.id));
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Expands "`G1a`–`G1f`", "`G5-01`–`G5-22`" and single ids into invalid-case ids. */
function invalidIdsIn(text: string): string[] {
  const out: string[] = [];
  const re = /`([A-H]\d+(?:-\d+)?[a-z]?)`(?:–`([A-H]\d+(?:-\d+)?[a-z]?)`)?/g;
  for (const m of text.matchAll(re)) {
    const from = m[1] ?? '';
    const to = m[2];
    if (to === undefined) {
      out.push(from);
      continue;
    }
    const letters = /^(.*?)([a-z])$/.exec(from);
    const lettersTo = /^(.*?)([a-z])$/.exec(to);
    const numbers = /^(.*-)(\d+)$/.exec(from);
    const numbersTo = /^(.*-)(\d+)$/.exec(to);
    if (letters && lettersTo && letters[1] === lettersTo[1]) {
      for (let c = (letters[2] ?? 'a').charCodeAt(0); c <= (lettersTo[2] ?? 'a').charCodeAt(0); c++) {
        out.push(`${letters[1] ?? ''}${String.fromCharCode(c)}`);
      }
    } else if (numbers && numbersTo && numbers[1] === numbersTo[1]) {
      const width = (numbers[2] ?? '').length;
      for (let n = Number(numbers[2]); n <= Number(numbersTo[2]); n++) {
        out.push(`${numbers[1] ?? ''}${String(n).padStart(width, '0')}`);
      }
    } else {
      out.push(from, to);
    }
  }
  return out.filter((id) => invalidIds.has(id));
}

/** Finds sub-tests named in quotes, attributed to the most recent `category/asset` mention. */
function quotedSubTests(text: string): { asset: string; subTest: string }[] {
  const found: { asset: string; subTest: string }[] = [];
  let asset: string | undefined;
  const tokens = text.matchAll(/`((?:[A-Za-z]+)\/[A-Za-z0-9_]+)`|"([^"]+)"/g);
  for (const m of tokens) {
    if (m[1] !== undefined) {
      asset = inventory.subTests.some((s) => s.asset === m[1]) ? m[1] : asset;
      continue;
    }
    const quote = norm(m[2] ?? '');
    const pool = inventory.subTests.filter((s) => asset === undefined || s.asset === asset);
    const hit =
      pool.find((s) => norm(s.name) === quote) ??
      pool.find((s) => norm(s.name).startsWith(quote) || quote.startsWith(norm(s.name)));
    if (hit !== undefined) found.push({ asset: hit.asset, subTest: hit.name });
  }
  return found;
}

const subTests = new Map<string, { asset: string; subTest: string; credits: string[]; note: string }>();
const invalid = new Map<string, string[]>();
const unmapped: string[] = [];

for (const t of data.registry.targets.values()) {
  const notes = t.notes ?? '';
  if (t.scope === 'out-rejection') {
    for (const id of invalidIdsIn(notes)) invalid.set(id, [...(invalid.get(id) ?? []), t.id]);
    continue;
  }
  if (t.scope !== 'in' || t.reviewStatus !== 'covered') continue;
  const hits = quotedSubTests(notes);
  if (hits.length === 0) {
    unmapped.push(`${t.id}: ${notes || t.summary}`);
    continue;
  }
  for (const h of hits) {
    const k = `${h.asset} / ${h.subTest}`;
    const entry = subTests.get(k) ?? { ...h, credits: [], note: 'Drafted from the coverage report; review.' };
    if (!entry.credits.includes(t.id)) entry.credits.push(t.id);
    subTests.set(k, entry);
  }
}

const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const mapping: CoverageMapping = {
  suiteRevision: SUITE_REVISION,
  subTests: [...subTests.entries()].sort(([a], [b]) => byCodeUnit(a, b)).map(([, v]) => v),
  invalid: [...invalid.entries()]
    .sort(([a], [b]) => byCodeUnit(a, b))
    .map(([id, credits]) => ({ id, credits: [...new Set(credits)].sort(byCodeUnit) })),
};
const header = [
  '# Existing-coverage mapping: which existing sub-tests and invalid-graph cases cover which targets.',
  '# The only source of credit for the existing suite (requirements §11). Drafted by',
  '# tools/bootstrap-coverage.ts from the coverage report; review every entry.',
  '',
].join('\n');
writeFileSync(outPath, header + stringify(mapping, { lineWidth: 0 }), 'utf8');
process.stdout.write(
  `${mapping.subTests.length} sub-test entries, ${mapping.invalid.length} invalid-case entries\n` +
    `${unmapped.length} covered targets need mapping by hand:\n${unmapped.map((u) => `  ${u}`).join('\n')}\n`,
);
