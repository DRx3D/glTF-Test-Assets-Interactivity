// Parser for the operation tables in Specification.adoc (AsciiDoc). Shared by the extraction
// tool and by tests that check data/operations.yaml is up to date with the vendored Specification.

export const SPEC_REVISION = 'c5d1e1e8';

export type SectionKind = 'configuration' | 'inputValues' | 'outputValues' | 'inputFlows' | 'outputFlows';

export interface SocketEntry {
  /** Socket id, configuration property name, or a placeholder such as `<case>`. */
  readonly name: string;
  /** Accepted types; several when the table lists alternatives with "or". Empty for flows. */
  readonly types: readonly string[];
  readonly description: string;
}

export interface Signature {
  /** 1-based line of the `| Operation |` row in Specification.adoc. */
  readonly line: number;
  readonly configuration: readonly SocketEntry[];
  readonly inputValues: readonly SocketEntry[];
  readonly outputValues: readonly SocketEntry[];
  readonly inputFlows: readonly SocketEntry[];
  readonly outputFlows: readonly SocketEntry[];
}

export interface Operation {
  readonly op: string;
  readonly category: string;
  readonly summary: string;
  readonly signatures: readonly Signature[];
}

export interface Catalogue {
  readonly specRevision: string;
  readonly operations: readonly Operation[];
}

const SECTION_HEADINGS: readonly (readonly [RegExp, SectionKind])[] = [
  [/^Configuration\b/, 'configuration'],
  [/^Input value sockets\b/, 'inputValues'],
  [/^Output value sockets\b/, 'outputValues'],
  [/^Input flow sockets\b/, 'inputFlows'],
  [/^Output flow sockets\b/, 'outputFlows'],
];

const OPERATION_ROW = /^\|\s*Operation\s*\|\s*`([^`]+)`\s*\|\s*(.*)$/;

/** Splits a table cell row on `|` separators, ignoring escaped `\|`. */
const splitCells = (row: string): string[] => row.split(/(?<!\\)\|/).map((c) => c.trim());

/** Parses one socket cell such as "`floatN a` or + `floatNxN a`" into a name and its types. */
function parseSocketCell(cell: string, kind: SectionKind): { name: string; types: string[] } {
  const ticks = [...cell.matchAll(/`([^`]+)`/g)].map((m) => (m[1] ?? '').trim());
  if (ticks.length === 0) {
    throw new Error(`no socket in cell "${cell}"`);
  }
  if (kind === 'inputFlows' || kind === 'outputFlows') {
    return { name: ticks[0] ?? '', types: [] };
  }
  const names = new Set<string>();
  const types: string[] = [];
  for (const tick of ticks) {
    const space = tick.lastIndexOf(' ');
    if (space < 0) {
      // e.g. `<custom>` for event/send: the sockets come from the event definition.
      names.add(tick);
    } else {
      types.push(tick.slice(0, space).trim());
      names.add(tick.slice(space + 1).trim());
    }
  }
  if (names.size !== 1) {
    throw new Error(`inconsistent socket names in "${cell}"`);
  }
  return { name: [...names][0] ?? '', types };
}

/** A line that starts a table row: "|", "d|", ".2+|" or ".2+d|". */
const ROW_START = /^\s*(?:\.\d+\+)?d?\|/;

/**
 * Joins continuation lines to the row they belong to: type alternatives written as
 * "`floatN a` or +" newline "`floatNxN a`", and multi-line descriptions such as the
 * latexmath formulas of definition tables.
 */
function logicalRows(lines: readonly string[]): string[] {
  const rows: string[] = [];
  for (const line of lines) {
    const prev = rows.length - 1;
    if (prev >= 0 && !ROW_START.test(line)) {
      rows[prev] = `${(rows[prev] ?? '').replace(/\s\+\s*$/, '')} ${line.trim()}`;
    } else {
      rows.push(line);
    }
  }
  return rows;
}

function parseTable(op: string, summary: string, line: number, body: readonly string[]): Signature {
  const sections: Record<SectionKind, SocketEntry[]> = {
    configuration: [],
    inputValues: [],
    outputValues: [],
    inputFlows: [],
    outputFlows: [],
  };
  let current: SectionKind | undefined;
  for (const raw of logicalRows(body)) {
    // Strip AsciiDoc cell specs such as ".2+" (row span) and "d" (style) before the first "|".
    const row = raw.replace(/^\s*(?:\.\d+\+)?d?(?=\|)/, '');
    if (!row.startsWith('|')) {
      throw new Error(`${op} (line ${line}): unexpected row "${raw}"`);
    }
    const cells = splitCells(row.slice(1));
    const first = cells[0] ?? '';
    const heading = SECTION_HEADINGS.find(([re]) => re.test(first));
    if (heading !== undefined) {
      current = heading[1];
      // Single-row form: "| Output value sockets | `float value` | 2.718..."
      if (cells.length >= 3 && (cells[1] ?? '').startsWith('`')) {
        const { name, types } = parseSocketCell(cells[1] ?? '', current);
        sections[current].push({ name, types, description: cells.slice(2).join(' | ') });
      }
      continue;
    }
    if (current === undefined) {
      throw new Error(`${op} (line ${line}): socket row before any section heading: "${raw}"`);
    }
    const { name, types } = parseSocketCell(first, current);
    sections[current].push({ name, types, description: cells.slice(1).join(' | ') });
  }
  return { line, ...sections };
}

/** Parses every operation table in the Specification text. */
export function parseOperationTables(adoc: string): Catalogue {
  const lines = adoc.split(/\r?\n/);
  const byOp = new Map<string, { summary: string; signatures: Signature[] }>();
  for (let i = 0; i < lines.length; i++) {
    const match = OPERATION_ROW.exec(lines[i] ?? '');
    if (match === null) {
      continue;
    }
    const op = match[1] ?? '';
    const summary = (match[2] ?? '').trim();
    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && (lines[j] ?? '').trim() !== '|===') {
      if ((lines[j] ?? '').trim() !== '') {
        body.push(lines[j] ?? '');
      }
      j++;
    }
    const signature = parseTable(op, summary, i + 1, body);
    const entry = byOp.get(op);
    if (entry === undefined) {
      byOp.set(op, { summary, signatures: [signature] });
    } else {
      entry.signatures.push(signature);
    }
    i = j;
  }
  const operations = [...byOp.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([op, { summary, signatures }]) => ({
      op,
      category: op.split('/')[0] ?? '',
      summary,
      signatures,
    }));
  return { specRevision: SPEC_REVISION, operations };
}
