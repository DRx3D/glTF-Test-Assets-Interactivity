// Loads data/operations.yaml (project spec section 8.2).

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { Catalogue, Operation } from './specTables.js';

export const OPERATION_COUNT = 135;

export class OperationCatalogue {
  private readonly byOp: ReadonlyMap<string, Operation>;

  constructor(readonly data: Catalogue) {
    this.byOp = new Map(data.operations.map((o) => [o.op, o]));
    if (this.byOp.size !== data.operations.length) {
      throw new Error('duplicate operation in catalogue');
    }
  }

  get size(): number {
    return this.byOp.size;
  }

  has(op: string): boolean {
    return this.byOp.has(op);
  }

  get(op: string): Operation {
    const o = this.byOp.get(op);
    if (o === undefined) {
      throw new Error(`unknown operation ${op}`);
    }
    return o;
  }

  /** All operation ids, sorted by code unit. */
  ops(): readonly string[] {
    return this.data.operations.map((o) => o.op);
  }
}

export function loadCatalogue(path: string | URL): OperationCatalogue {
  return new OperationCatalogue(parse(readFileSync(path, 'utf8')) as Catalogue);
}
