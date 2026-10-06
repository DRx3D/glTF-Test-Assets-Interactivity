// Helpers shared by generators.

import { scalarText, type Scalar, type ScalarType } from '../graph/scalar.js';
import type { OperationCatalogue } from '../registry/catalogue.js';
import type { InputValue } from '../sampling/combine.js';

/** `div(-7, 2) is -3`: the operation without its category, the inputs, and the expectation. */
export const callName = (op: string, inputs: readonly Scalar[], expected: Scalar): string =>
  `${op.slice(op.indexOf('/') + 1)}(${inputs.map(scalarText).join(', ')}) is ${scalarText(expected)}`;

/** The Specification table line of the signature of `op` whose inputs accept `types`. */
export function signatureLine(
  catalogue: OperationCatalogue,
  op: string,
  types: readonly ScalarType[],
): number {
  const generic: Readonly<Record<string, readonly string[]>> = {
    floatN: ['float'],
    T: ['bool', 'int', 'float'],
  };
  const sig = catalogue
    .get(op)
    .signatures.find(
      (s) =>
        s.inputValues.length === types.length &&
        s.inputValues.every((e, k) =>
          e.types.some((t) => t === types[k] || (generic[t] ?? []).includes(types[k] as string)),
        ),
    );
  if (sig === undefined) throw new Error(`${op} has no signature for (${types.join(', ')})`);
  return sig.line;
}

export const f = (value: number): InputValue => ({ kind: 'float', value });
export const b = (value: boolean): InputValue => ({ kind: 'bool', value });
