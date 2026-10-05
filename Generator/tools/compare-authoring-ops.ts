// Compares data/operations.yaml with the operation specs of the Khronos authoring tool
// (project spec section 8.2, risk R4). A difference means "check the Specification", never
// "copy the tool": the tool is one implementation's reading of the Specification.
//
//   KHR_AUTHORING_TOOL=/path/to/glTF-InteractivityGraph-AuthoringTool npx tsx tools/compare-authoring-ops.ts
//
// Prints one line per difference and exits 0; this is a review aid, not a gate.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import type { Catalogue, SocketEntry } from '../src/registry/specTables.js';

const toolRoot = process.env.KHR_AUTHORING_TOOL;
if (toolRoot === undefined) {
  process.stderr.write('Set KHR_AUTHORING_TOOL to a glTF-InteractivityGraph-AuthoringTool checkout.\n');
  process.exit(2);
}

interface ToolSocket {
  readonly typeOptions?: readonly number[];
  readonly type?: number;
}
interface ToolSpec {
  readonly op?: string;
  readonly extension?: string;
  readonly values?: {
    readonly input?: Record<string, ToolSocket>;
    readonly output?: Record<string, ToolSocket>;
  };
  readonly configuration?: Record<string, unknown>;
}

const nodesModule = (await import(pathToFileURL(join(toolRoot, 'src/authoring/spec/nodes.ts')).href)) as {
  interactivityNodeSpecs: readonly ToolSpec[];
  standardTypes: readonly { readonly name?: string; readonly signature: string }[];
};
const typeName = (index: number): string => nodesModule.standardTypes[index]?.signature ?? `#${index}`;

const catalogue = parse(
  readFileSync(new URL('../data/operations.yaml', import.meta.url), 'utf8'),
) as Catalogue;

const EXPAND: Readonly<Record<string, readonly string[]>> = {
  floatN: ['float', 'float2', 'float3', 'float4'],
  floatNxN: ['float2x2', 'float3x3', 'float4x4'],
};
const expand = (types: readonly string[]): string[] => types.flatMap((t) => EXPAND[t] ?? [t]);
// Placeholder sockets (<case>, <index>, ...) and generic types (T, Ti) are configuration-driven.
const concrete = (e: SocketEntry): boolean => !e.name.startsWith('<');

const specByOp = new Map(catalogue.operations.map((o) => [o.op, o]));
const toolByOp = new Map(
  nodesModule.interactivityNodeSpecs.filter((s) => s.op !== undefined).map((s) => [s.op ?? '', s]),
);

let differences = 0;
const report = (op: string, message: string): void => {
  differences++;
  process.stdout.write(`${op}: ${message}\n`);
};

for (const [op, spec] of specByOp) {
  const tool = toolByOp.get(op);
  if (tool === undefined) {
    report(op, 'in the Specification, missing from the tool');
    continue;
  }
  for (const [side, toolSockets] of [
    ['inputValues', tool.values?.input ?? {}],
    ['outputValues', tool.values?.output ?? {}],
  ] as const) {
    const specSockets = new Map<string, Set<string>>();
    for (const sig of spec.signatures) {
      for (const e of sig[side].filter(concrete)) {
        const set = specSockets.get(e.name) ?? new Set<string>();
        expand(e.types).forEach((t) => set.add(t));
        specSockets.set(e.name, set);
      }
    }
    for (const name of specSockets.keys()) {
      if (!(name in toolSockets)) report(op, `${side} socket "${name}" missing from the tool`);
    }
    for (const [name, socket] of Object.entries(toolSockets)) {
      const specTypes = specSockets.get(name);
      if (specTypes === undefined) {
        report(op, `${side} socket "${name}" in the tool, not in the Specification`);
        continue;
      }
      if ([...specTypes].some((t) => /^T/.test(t))) continue; // generic type
      const toolTypes = new Set(
        (socket.typeOptions ?? (socket.type === undefined ? [] : [socket.type])).map(typeName),
      );
      const missing = [...specTypes].filter((t) => !toolTypes.has(t));
      const extra = [...toolTypes].filter((t) => !specTypes.has(t));
      if (missing.length > 0)
        report(op, `${side} "${name}" types missing from the tool: ${missing.join(', ')}`);
      if (extra.length > 0)
        report(op, `${side} "${name}" types in the tool, not in the Specification: ${extra.join(', ')}`);
    }
  }
}
for (const [op, tool] of toolByOp) {
  if (!specByOp.has(op) && tool.extension === undefined) {
    report(op, 'in the tool as a core operation, not in the Specification');
  }
}
process.stdout.write(`${differences} difference(s)\n`);
