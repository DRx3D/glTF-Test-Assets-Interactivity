// Category generator interface (project spec section 12). A generator receives only the gap
// targets it owns and returns asset plans. It never writes files or draws random numbers:
// scatter inputs are slots that the planner fills after naming (requirements §8.10).

import type { Facet } from '../asset/naming.js';
import type { Category } from '../asset/model.js';
import type { Comparison } from '../graph/compare.js';
import type { Scalar, ScalarType } from '../graph/scalar.js';
import type { GmpReference } from '../reference/reference.js';
import type { OperationCatalogue } from '../registry/catalogue.js';
import type { Interpretation } from '../registry/interpretations.js';
import type { Target } from '../registry/targets.js';
import type { InputValue } from '../sampling/combine.js';

export interface PlannedInput {
  readonly socket: string;
  readonly type: ScalarType;
  readonly value: InputValue;
  readonly literalNegZero?: boolean;
}

export interface SubTestPlan {
  /** The operation under test. */
  readonly op: string;
  readonly inputs: readonly PlannedInput[];
  readonly resultType: ScalarType;
  /** Registry targets this sub-test covers. Empty only for prerequisites. */
  readonly targets: readonly string[];
  readonly valueClasses: readonly string[];
  readonly comparison: Comparison;
  /** Specification references beyond those of the targets, e.g. the operation's table. */
  readonly extraSpecRefs?: readonly { readonly line: number; readonly section: string }[];
  /** Interpretation ids the expected value relies on (requirements §9.5). */
  readonly interpretations?: readonly string[];
  /** The expected value, computed from the resolved inputs. */
  expected(inputs: readonly Scalar[]): Scalar;
  /** The sub-test name, derived from the inputs and expected value (requirements §7.6). */
  name(inputs: readonly Scalar[], expected: Scalar): string;
}

export interface AssetPlan {
  readonly category: Category;
  readonly subject: string;
  readonly facet: Facet;
  readonly description: string;
  readonly subTests: readonly SubTestPlan[];
}

/** A received target the generator cannot cover, with the reason for the coverage report. */
export interface NotCoverable {
  readonly target: string;
  readonly reason: string;
}

export interface PlanResult {
  readonly assets: readonly AssetPlan[];
  readonly notCoverable: readonly NotCoverable[];
}

export interface Limits {
  readonly maxSubTests: number;
  readonly maxNodes: number;
  readonly maxEnumeration: number;
  readonly preferredExpectedDuration: number;
  readonly maxExpectedDuration: number;
  readonly timeTolerance: number;
  readonly referenceBits: number;
}

export interface Tolerances {
  readonly transcendental: { readonly r: number; readonly a: number };
  readonly composite: { readonly r: number; readonly a: number };
}

/** Defaults from requirements §7.7, §7.9, §8.1 and §9.3 (project spec section 14). */
export const DEFAULT_LIMITS: Limits = {
  maxSubTests: 100,
  maxNodes: 2000,
  maxEnumeration: 64,
  preferredExpectedDuration: 5.5,
  maxExpectedDuration: 10,
  timeTolerance: 0.05,
  referenceBits: 128,
};

export const DEFAULT_TOLERANCES: Tolerances = {
  transcendental: { r: 1e-12, a: 1e-300 },
  composite: { r: 1e-12, a: 1e-12 },
};

export interface PlanContext {
  readonly catalogue: OperationCatalogue;
  readonly ref: GmpReference;
  readonly limits: Limits;
  readonly tolerances: Tolerances;
  readonly interpretations: readonly Interpretation[];
}

export interface CategoryGenerator {
  /** Matches the registry's `generator` values, e.g. `math/div`. */
  readonly id: string;
  readonly category: Category;
  /** Runs even with no gap targets (the prerequisites asset, requirements §7.2). */
  readonly alwaysRun?: boolean;
  plan(ctx: PlanContext, gaps: readonly Target[]): PlanResult;
}
