// Drafts data/registry/*.yaml from the coverage report's tables (project spec section 8.5).
// Run once, then finish the targets by hand: every `covers` and most `generator` fields are
// left as TODO, and statement scopes are a first guess for review.
//
//   npx tsx tools/bootstrap-registry.ts [--force]
//
// Refuses to overwrite existing registry files unless --force is given.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { SPEC_REVISION } from '../src/registry/specTables.js';
import type { RegistryFile, ReviewStatus, Scope, Target } from '../src/registry/targets.js';

const reportPath = new URL('../../Documents/KHR_interactivity_test_coverage_report.md', import.meta.url);
const outDir = new URL('../data/registry/', import.meta.url);
const report = readFileSync(reportPath, 'utf8');

const section = (start: string, end: string): string => {
  const i = report.indexOf(start);
  const j = report.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error(`report section not found: ${start}`);
  return report.slice(i, j);
};

const slug = (text: string, max = 6): string =>
  text
    .replace(/`/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w !== '')
    .slice(0, max)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

const firstOp = (text: string): string | undefined =>
  /`((?:math|flow|variable|pointer|event|animation|type|debug)\/[A-Za-z0-9]+)`/.exec(text)?.[1];

const byArea = new Map<string, Target[]>();
const add = (area: string, t: Target): void => {
  const list = byArea.get(area) ?? [];
  if (!list.some((x) => x.id === t.id)) list.push(t);
  byArea.set(area, list);
};

// --- Statements: report section 1 tables -------------------------------------------------
const STATEMENT_AREAS: Readonly<Record<string, string>> = {
  '1.1': 'concepts',
  '1.2': 'math',
  '1.3': 'type',
  '1.4': 'flow',
  '1.5': 'variable',
  '1.6': 'pointer',
  '1.7': 'animation',
  '1.8': 'event',
  '1.9': 'debug',
  '1.10': 'pointer',
  '1.11': 'graph',
};
const sec1 = section('## 1. Normative statements', '## 2. Specification content');
let area = 'concepts';
let subsection = '';
for (const line of sec1.split('\n')) {
  const heading = /^### (1\.\d+) (.+)$/.exec(line);
  if (heading !== null) {
    area = STATEMENT_AREAS[heading[1] ?? ''] ?? 'concepts';
    subsection = (heading[2] ?? '').trim();
    continue;
  }
  if (!/^\| \d+ \|/.test(line)) continue;
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());
  const lineNo = Number(cells[0]);
  const requirement = cells[1] ?? '';
  const status = cells[2] ?? '';
  const notes = cells[3] ?? '';
  if (!/^(Covered|Partial|None)/.test(status)) throw new Error(`unexpected status in: ${line}`);
  const impractical = status.includes('impractical');
  const rejectionOnly =
    /reject/i.test(requirement) && !/default|fall back|ignored|retain|keep|no effect/i.test(requirement);
  const scope: Scope = impractical ? 'out-impractical' : rejectionOnly ? 'out-rejection' : 'in';
  const reviewStatus: ReviewStatus = status.startsWith('Covered')
    ? 'covered'
    : status.startsWith('Partial')
      ? 'partial'
      : 'none';
  const op = firstOp(requirement);
  add(area, {
    id: `S-${lineNo}`,
    kind: 'statement',
    specRef: { line: lineNo, section: op ?? subsection },
    summary: requirement,
    scope,
    covers: 'TODO',
    generator: 'TODO',
    reviewStatus,
    ...(notes !== '' ? { notes } : {}),
  });
}

// --- Type signatures: report section 2.1 -------------------------------------------------
const TYPE_WORDS: Readonly<Record<string, readonly string[]>> = {
  'all matrices': ['float2x2', 'float3x3', 'float4x4'],
};
const sec21 = section('### 2.1 Untested type signatures', '### 2.2');
for (const line of sec21.split('\n')) {
  const row = /^\| (`[^|]+) \| (.+?) \|\s*$/.exec(line);
  if (row === null || (row[1] ?? '').includes('Operation')) continue;
  const opsCell = row[1] ?? '';
  const ops = [...opsCell.matchAll(/`([a-z]+\/)?([A-Za-z0-9]+)`/g)].map((m) => m[2] ?? '');
  const category = /`([a-z]+)\//.exec(opsCell)?.[1] ?? 'math';
  const typesCell = (row[2] ?? '').replace(/\(.*?\)/g, '');
  const types = new Set<string>();
  for (const [word, list] of Object.entries(TYPE_WORDS))
    if (typesCell.includes(word)) list.forEach((t) => types.add(t));
  for (const m of typesCell.matchAll(/`(float\d?(?:x\d)?|int|bool|ref)`/g)) types.add(m[1] ?? '');
  if (/scalar `float`/.test(row[2] ?? '')) types.add('float');
  for (const name of ops) {
    const op = `${category}/${name}`;
    for (const type of types) {
      add(category === 'math' ? 'math' : category, {
        id: `T-${op}-${type}`,
        kind: 'type',
        summary: `${op} with ${type} inputs`,
        scope: 'in',
        covers: { op, types: [type] },
        generator: op,
        reviewStatus: 'none',
      });
    }
  }
}

// --- Procedural behaviour: report section 2.2 --------------------------------------------
const sec22 = section('### 2.2 Operation behavior described procedurally', '### 2.3');
for (const para of sec22.split('\n\n')) {
  const m = /^\*\*`([a-z]+\/[A-Za-z0-9]+)`(?: \/ `[^`]+`)?\.\*\* (.+)$/s.exec(para.trim());
  if (m === null) continue;
  const op = m[1] ?? '';
  const missing = (m[2] ?? '')
    .split(/(?<=\.)\s+/)
    .filter((s) => /\bnot\b|missing|untested/i.test(s) && !/^Covered/.test(s));
  if (missing.length === 0) continue;
  add(op.split('/')[0] ?? 'flow', {
    id: `P-${op}-remaining`,
    kind: 'procedure',
    summary: missing.join(' '),
    scope: 'in',
    covers: 'TODO',
    generator: op,
    reviewStatus: 'partial',
    notes: 'Drafted from report section 2.2; split into one target per behaviour.',
  });
}

// --- Object Model pointers: report section 2.3 -------------------------------------------
const sec23 = section('### 2.3 Object model pointers', '## 3. Edge');
for (const line of sec23.split('\n')) {
  const row = /^\| `([^`]+)`[^|]*\| (.+?) \|\s*$/.exec(line);
  if (row === null) continue;
  const status = row[2] ?? '';
  if (/^Covered(?!.*not tested)/.test(status) && !/\(≥ 1 only\)|valid reference only/.test(status)) continue;
  const pointer = (row[1] ?? '').replace(/\s+/g, '');
  add('pointer', {
    id: `O-${pointer}`,
    kind: 'pointer',
    summary: `${pointer}: ${status}`,
    scope: 'in',
    covers: 'TODO',
    generator: 'TODO',
    reviewStatus: status.startsWith('None') ? 'none' : 'partial',
  });
}

// --- Edge cases: report section 3, "Still missing" bullets -------------------------------
const EDGE_AREAS: Readonly<Record<string, string>> = {
  '3.1': 'config',
  '3.2': 'precision',
  '3.3': 'boundary',
  '3.4': 'scalar',
  '3.5': 'special',
  '3.6': 'timing',
  '3.7': 'animation',
  '3.8': 'syntax',
};
const EDGE_FILES: Readonly<Record<string, string>> = {
  config: 'config',
  precision: 'concepts',
  boundary: 'math',
  scalar: 'math',
  special: 'math',
  timing: 'flow',
  animation: 'animation',
  syntax: 'pointer',
};
const sec3 = section('## 3. Edge and corner cases', '## 4. Test suite issues');
let edgeArea = 'config';
let collecting = false;
for (const line of sec3.split('\n')) {
  const heading = /^### (3\.\d+) /.exec(line);
  if (heading !== null) {
    edgeArea = EDGE_AREAS[heading[1] ?? ''] ?? 'config';
    collecting = edgeArea === 'scalar';
    continue;
  }
  if (/^Still missing/.test(line)) {
    collecting = true;
    continue;
  }
  if (/^\d+\. .*Still missing:/.test(line) || /^Rejection cases still missing/.test(line)) {
    const text = line.replace(/^\d+\.\s*/, '');
    add(EDGE_FILES[edgeArea] ?? 'config', {
      id: `E-${edgeArea}-${slug(text.split('Still missing:')[1] ?? text)}`,
      kind: 'edge',
      summary: text,
      scope: /^Rejection/.test(text) ? 'out-rejection' : 'in',
      covers: 'TODO',
      generator: 'TODO',
      reviewStatus: 'partial',
    });
    continue;
  }
  if (line.trim() === '' || line.startsWith('Now covered')) {
    if (edgeArea !== 'scalar') collecting = collecting && line.trim() === '';
    continue;
  }
  const bullet = /^- (.+)$/.exec(line);
  if (collecting && bullet !== null) {
    const text = bullet[1] ?? '';
    add(EDGE_FILES[edgeArea] ?? 'config', {
      id: `E-${edgeArea}-${slug(text)}`,
      kind: 'edge',
      summary: text,
      scope: 'in',
      covers: 'TODO',
      generator: firstOp(text) ?? 'TODO',
      reviewStatus: 'none',
    });
  }
}
// Scalar forms (3.4) are a paragraph, not bullets.
add('math', {
  id: 'E-scalar-floatNOperations',
  kind: 'edge',
  summary: section('### 3.4 Scalar forms', '### 3.5').split('\n').slice(2).join(' ').trim(),
  scope: 'in',
  covers: 'TODO',
  generator: 'TODO',
  reviewStatus: 'none',
});

// --- Write --------------------------------------------------------------------------------
const force = process.argv.includes('--force');
mkdirSync(outDir, { recursive: true });
let total = 0;
for (const [name, targets] of [...byArea.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
  const path = new URL(`${name}.yaml`, outDir);
  if (existsSync(path) && !force) {
    process.stderr.write(`skipping ${name}.yaml: exists (use --force to overwrite)\n`);
    continue;
  }
  const file: RegistryFile = { specRevision: SPEC_REVISION, area: name, targets };
  const header = `# Target registry: ${name}. Drafted by tools/bootstrap-registry.ts from the coverage report;\n# finish each TODO by hand (project spec section 8.5).\n`;
  writeFileSync(path, header + stringify(file, { lineWidth: 0 }), 'utf8');
  total += targets.length;
  process.stdout.write(`${name}.yaml: ${targets.length} targets\n`);
}
process.stdout.write(`${total} targets written\n`);
