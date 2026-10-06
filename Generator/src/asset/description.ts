// Description file (requirements §7.5, §14; project spec section 11.4): the existing layout
// with a Spec refs column, values written without rounding, and the licence footer.

import { resultVariableName, type HarnessResult } from '../graph/harness.js';
import { scalarText } from '../graph/scalar.js';
import { testName, type ResolvedAsset } from './model.js';
import { usedSchemas } from './oracle.js';

export const LICENCE = 'CC BY 4.0 International';

/** Table cells cannot contain a bare `|`. */
const cell = (s: string): string => s.replace(/\|/g, '\\|');

export function descriptionMarkdown(asset: ResolvedAsset, harness: HarnessResult, copyright: string): string {
  const name = testName(asset);
  const lines = [
    `### **Test Sample:** ${name}`,
    `### **Description:** ${asset.description}`,
    '',
    '### Tests:',
    '| Sub Test | Result Var.Name | Result Var.Id | Expected Value | Spec refs |',
    '| ----------- | ----------- | ----------- | ----------- | ----------- |',
    ...asset.subTests.map((st, k) => {
      const refs = st.specRefs.map((r) => `${r.section} (line ${r.line})`).join(', ');
      const expected =
        st.comparison.mode === 'set'
          ? st.comparison.values.map(scalarText).join(' or ')
          : scalarText(st.expected);
      return `| ${cell(st.name)} | ${cell(resultVariableName(name, st.name))} | ${harness.variables[k]?.result ?? ''} | ${cell(expected)} | ${cell(refs)} |`;
    }),
    '',
    'Schemas used in this test case:',
    ...usedSchemas(harness).map((op) => `- ${op}`),
    '',
    '---',
    '',
    copyright,
    '',
    `Licensed under ${LICENCE}.`,
    '',
  ];
  return lines.join('\n');
}
