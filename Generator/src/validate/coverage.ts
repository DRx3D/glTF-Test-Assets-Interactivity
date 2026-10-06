// Run-level coverage: the status of every target after generation, V4 (every in-scope target
// covered or explained) and V5 (no supplemental sub-test duplicates existing coverage)
// (requirements §11, §12 items 3 and 4; project spec section 13.1).

import type { BuiltAsset } from '../asset/build.js';
import type { GapReport } from '../existing/coverage.js';
import type { NotCoverable } from '../generators/types.js';
import type { Inventory } from '../existing/reader.js';
import type { Target } from '../registry/targets.js';
import type { CheckMessage } from './checks.js';

export type FinalStatus = 'covered-existing' | 'covered-supplemental' | 'not-covered';

export interface TargetOutcome {
  readonly target: Target;
  readonly status: FinalStatus;
  /** `asset / sub-test` (existing or supplemental) or invalid-case ids. */
  readonly coveredBy: readonly string[];
  readonly reason?: string;
}

export interface CoverageInput {
  readonly gaps: GapReport;
  readonly built: readonly BuiltAsset[];
  readonly notCoverable: readonly NotCoverable[];
  /** Generators that exist in this build. */
  readonly implemented: ReadonlySet<string>;
  /** Generators that ran (all implemented ones unless --only). */
  readonly ran: ReadonlySet<string>;
}

export function targetOutcomes(input: CoverageInput): TargetOutcome[] {
  const supplemental = new Map<string, string[]>();
  for (const b of input.built) {
    for (const st of b.asset.subTests) {
      for (const id of st.targets) {
        const list = supplemental.get(id) ?? [];
        list.push(`${b.index.name} / ${st.name}`);
        supplemental.set(id, list);
      }
    }
  }
  const explained = new Map(input.notCoverable.map((n) => [n.target, n.reason]));

  return input.gaps.targets.map(({ target, status, creditedBy }): TargetOutcome => {
    if (status === 'covered-existing') return { target, status: 'covered-existing', coveredBy: creditedBy };
    const by = supplemental.get(target.id);
    if (by !== undefined) return { target, status: 'covered-supplemental', coveredBy: by };
    const reason = ((): string => {
      if (status === 'rejection-covered-invalid')
        return 'rejection target, out of scope (requirements §1.1); covered by invalid-graph cases';
      if (status === 'rejection-not-covered')
        return 'rejection target, out of scope (requirements §1.1); not in the invalid-graph set';
      if (status === 'impractical')
        return `impractical to test${target.notes === undefined ? '' : `: ${target.notes}`}`;
      const why = explained.get(target.id);
      if (why !== undefined) return why;
      if (target.generator === 'TODO') return 'no generator assigned in the registry';
      if (!input.implemented.has(target.generator))
        return `generator ${target.generator} not implemented yet`;
      if (!input.ran.has(target.generator)) return `generator ${target.generator} not run (--only)`;
      return `generator ${target.generator} produced no sub-test for it`;
    })();
    return {
      target,
      status: 'not-covered',
      coveredBy: status === 'rejection-covered-invalid' ? creditedBy : [],
      reason,
    };
  });
}

/** V4: every in-scope target is covered by existing or supplemental sub-tests, or explained. */
export function checkV4(
  outcomes: readonly TargetOutcome[],
  notCoverable: readonly NotCoverable[],
): CheckMessage[] {
  const explained = new Set(notCoverable.map((n) => n.target));
  return outcomes
    .filter((o) => o.target.scope === 'in' && o.status === 'not-covered' && !explained.has(o.target.id))
    .map((o) => ({ check: 'V4', message: `${o.target.id}: not covered (${o.reason ?? 'no reason'})` }));
}

/**
 * V5: supplemental sub-tests only cover gaps (requirements §4.3, §11) and asset names do not
 * collide with the existing suite (§6.2). Existing sub-tests carry no structured inputs, so
 * duplication is judged through the coverage mapping: a target the mapping credits to an
 * existing sub-test is never a supplemental target.
 */
export function checkV5(gaps: GapReport, built: readonly BuiltAsset[], inventory: Inventory): CheckMessage[] {
  const covered = new Set(gaps.targets.filter((t) => t.status !== 'gap').map((t) => t.target.id));
  const out: CheckMessage[] = [];
  for (const b of built) {
    if (inventory.names.has(b.asset.name))
      out.push({
        check: 'V5',
        asset: b.index.name,
        message: `asset name ${b.asset.name} exists in the suite`,
      });
    for (const st of b.asset.subTests) {
      for (const id of st.targets) {
        if (covered.has(id))
          out.push({ check: 'V5', asset: b.index.name, message: `${st.name}: ${id} is not a gap` });
      }
    }
  }
  return out;
}
