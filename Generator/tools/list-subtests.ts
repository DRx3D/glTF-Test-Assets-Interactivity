// Lists the sub-tests of the named assets (or of every asset matching a prefix), for writing
// existing-coverage.yaml entries by hand (project spec section 9.4).
//
//   npx tsx tools/list-subtests.ts math/round event/
//
// Each line: asset | sub-test name (newlines shown as ⏎) | result type | expected value.

import { DEFAULT_DATA_DIR } from '../src/registry/check.js';
import { defaultSuiteRoot, readSuite } from '../src/existing/reader.js';

const wanted = process.argv.slice(2);
const inventory = readSuite(defaultSuiteRoot(DEFAULT_DATA_DIR));
for (const st of inventory.subTests) {
  if (
    wanted.length > 0 &&
    !wanted.some((w) => st.asset === w || (w.endsWith('/') && st.asset.startsWith(w)))
  ) {
    continue;
  }
  const name = st.name.replace(/\n/g, '⏎');
  process.stdout.write(`${st.asset} | ${name} | ${st.resultVar.type} | ${String(st.expected)}\n`);
}
