#!/usr/bin/env node
// khr-itest-gen command-line entry point (project spec section 14).
// Exit codes: 0 success, 1 a requirement failed, 2 a usage error.
// `explain` arrives with the M4 generators.

import { Command, CommanderError } from 'commander';
import { determineGaps, describeGaps, loadCoverageMapping } from '../existing/coverage.js';
import { defaultSuiteRoot, readSuite } from '../existing/reader.js';
import { DEFAULT_DATA_DIR, describeCheck, loadDataSet } from '../registry/check.js';
import { generate } from './generate.js';
import { parseGenerateOptions, UsageError, type RawGenerateOptions } from './options.js';

const EXIT_FAILED = 1;
const EXIT_USAGE = 2;

class NotImplementedError extends Error {}

const notYet = (command: string, milestone: string): never => {
  throw new NotImplementedError(`${command} is not implemented yet (planned for ${milestone})`);
};

const program = new Command()
  .name('khr-itest-gen')
  .description('Generate supplemental KHR_interactivity test assets')
  .version('0.1.0')
  .exitOverride();

program
  .command('generate')
  .description('generate supplemental assets, index and coverage report')
  .option('--spec <path>', 'Specification.adoc path or commit id')
  .option('--suite <path>', 'existing Tests/Interactivity directory')
  .option('--registry <path>', 'target registry directory')
  .option('--out <path>', 'output directory')
  .option('--seed <seed>', 'PRNG seed, decimal or 0x-prefixed hex')
  .option('--copyright-owner <owner>', 'copyright owner for asset metadata')
  .option('--copyright-year <year>', 'copyright year for asset metadata')
  .option('--config <path>', 'configuration file')
  .option('--only <ids>', 'comma-separated generator ids (development)')
  .option('--verify-determinism', 'run twice and compare output')
  .option('--adapter <name>', 'run an engine adapter after generation')
  .action(async (raw: RawGenerateOptions & { config?: string }) => {
    const outcome = await generate({ ...parseGenerateOptions(raw), config: raw.config }, DEFAULT_DATA_DIR);
    for (const m of outcome.messages) process.stderr.write(`${m}\n`);
    if (!outcome.ok) process.exitCode = EXIT_FAILED;
  });

program
  .command('check-registry')
  .description('schema and cross-reference checks on data/; writes no output')
  .action(() => {
    const { text, ok } = describeCheck(loadDataSet());
    process.stdout.write(text);
    if (!ok) process.exitCode = EXIT_FAILED;
  });

program
  .command('gaps')
  .description('print the gap list and existing credits; writes no output')
  .option('--suite <path>', 'existing Tests/Interactivity directory')
  .action((options: { suite?: string }) => {
    const data = loadDataSet();
    const inventory = readSuite(options.suite ?? defaultSuiteRoot(DEFAULT_DATA_DIR));
    const report = determineGaps(
      data.registry,
      inventory,
      loadCoverageMapping(`${DEFAULT_DATA_DIR}/existing-coverage.yaml`),
    );
    process.stdout.write(describeGaps(report, inventory));
    if (data.problems.length > 0 || inventory.problems.length > 0 || report.problems.length > 0) {
      process.exitCode = EXIT_FAILED;
    }
  });

program
  .command('explain <target>')
  .description('show the plan, sub-tests and expected values for one target')
  .action(() => notYet('explain', 'M4'));

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode === 0 ? 0 : EXIT_USAGE;
  } else if (error instanceof UsageError) {
    process.stderr.write(`error: ${error.message}\n`);
    process.exitCode = EXIT_USAGE;
  } else {
    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = EXIT_FAILED;
  }
}
