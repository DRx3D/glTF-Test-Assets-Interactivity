// V2: the KHR_interactivity extension object against the vendored JSON schemas
// (requirements §7.1; project spec section 13.1).
//
// The vendored schemas reference three core glTF schemas that are not part of the extension
// (glTFProperty, glTFid, glTFChildOfRootProperty). They are supplied here in the minimal
// form the extension needs: an object that may carry extensions and extras, a non-negative
// integer id, and a property that may carry a name.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';

const CORE_STUBS: readonly Record<string, unknown>[] = [
  {
    $id: 'glTFProperty.schema.json',
    type: 'object',
    properties: { extensions: { type: 'object' }, extras: {} },
  },
  { $id: 'glTFid.schema.json', type: 'integer', minimum: 0 },
  {
    $id: 'glTFChildOfRootProperty.schema.json',
    allOf: [{ $ref: 'glTFProperty.schema.json' }],
    properties: { name: { type: 'string' } },
  },
];

/** Compiles the extension schema once; `schemaDir` is data/spec/schema. */
export function compileInteractivitySchema(schemaDir: string): ValidateFunction {
  // strict: false because the glTF schemas use annotation keywords such as
  // gltf_detailedDescription that Ajv does not know.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const stub of CORE_STUBS) ajv.addSchema(stub);
  const files = readdirSync(schemaDir)
    .filter((f) => f.endsWith('.schema.json'))
    .sort();
  for (const file of files) {
    ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, file), 'utf8')) as Record<string, unknown>);
  }
  const validate = ajv.getSchema('glTF.KHR_interactivity.schema.json');
  if (validate === undefined) throw new Error(`glTF.KHR_interactivity.schema.json not found in ${schemaDir}`);
  return validate;
}
