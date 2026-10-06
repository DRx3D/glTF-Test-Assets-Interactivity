# M2 gate summary: data and reference

Branch `generator-m2`. Specification revision `c5d1e1e8`; existing suite at `9ffd30e` (upstream PR #22, `fc073cf`).

The gate (build steps, step 6): **`check-registry` is clean, the golden table matches, and R1 and R2 are decided.**

| Criterion                | Status      | Evidence                                                                                    |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------- |
| `check-registry` clean   | Met         | `135 operations; 287 targets (…); 172 still marked TODO; 0 interpretation(s); 0 problem(s)` |
| Golden table matches     | Met         | 414 of 414 mpmath entries reproduced bit for bit (`test/reference/reference.test.ts`)       |
| R1 decided (extraction)  | **Not met** | Working-group decision; the project spec section 18 proposal is unchanged                   |
| R2 decided (oracle form) | **Not met** | Working-group decision; the generator assumes the on-disk nested schema (project spec 11.3) |

**Result: the gate is not yet passed.** Everything the team can do on its own is done. What remains is the two working-group decisions, plus the people-review items below.

## Delivered

| Build step           | Deliverable                                                                                                                            | Result                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 4.1 Operations       | `data/spec/` (vendored Specification and 8 schemas, byte-identical); `data/operations.yaml` extracted by `tools/extract-operations.ts` | 135 operations, 159 type signatures                                           |
| 4.2 Registry         | `data/registry/*.yaml` from `tools/bootstrap-registry.ts`; schema and cross-checks in `src/registry/targets.ts`                        | 287 targets: statement 136, type 115, edge 21, procedure 11, pointer 4        |
| 4.3 Coverage mapping | `data/existing-coverage.yaml` from `tools/bootstrap-coverage.ts`; schema in `src/existing/coverage.ts`                                 | 76 sub-test credits, 139 invalid-case credits, 0 mapping problems             |
| 4.4 Interpretations  | `data/interpretations.yaml` (empty) with schema and cross-checks in `src/registry/interpretations.ts`                                  | Checked by `check-registry`                                                   |
| 4.5 `check-registry` | `src/registry/check.ts`, CLI command                                                                                                   | 0 problems                                                                    |
| 5 Reader and gaps    | `src/existing/reader.ts`, `determineGaps`, CLI command `gaps`                                                                          | 1,073 sub-tests and 179 invalid cases read; gap list below                    |
| 6 Reference library  | `src/reference/reference.ts` on `gmp-wasm` 1.3.2 (npm dependency, LGPL-3.0, not vendored or bundled)                                   | 22 functions; Ziv loop from 128 to 1,024 bits; fails rather than guesses      |
| 6 Golden table       | `tools/make-reference-fixture.py` (mpmath 1.4.1 in `Generator/.venv`) → `test/fixtures/reference.json`                                 | 414 entries at 300 bits, each confirmed at 600 bits; 1 skipped                |
| 7 Sampling (into M3) | `src/sampling/{classes,combine,pack,slots,domains}.ts`                                                                                 | §8.2–§8.5 classes, combination rules, packing, scatter order, §8.3 thresholds |

CI (`npm run ci`): type check, lint, format check and 140 tests in 14 files pass, with 98.5% line coverage and 89.1% branch coverage.

## Gap baseline

From `npm run cli -- gaps`:

| Group       | Covered                   | Not covered       |
| ----------- | ------------------------- | ----------------- |
| In scope    | 38 by existing sub-tests  | **177 gaps**      |
| Rejection   | 56 by invalid-graph cases | 10                |
| Impractical | —                         | 6 (not generated) |

The 177 gaps by kind: 115 type signatures, 27 statements, 20 edge cases, 11 procedures and 4 Object Model pointers.

## Open items

### Working-group decisions (block the gate)

- **R1:** add `math/extract2/3/4` and `math/extract2x2/3x3/4x4` to the harness set. Without them, vector and matrix results cannot be compared component by component. The fallback limits vector sub-tests to finite, non-zero exact values and tests special values in scalar form only.
- **R2:** confirm that the nested on-disk oracle schema (`tests[].subTests[]` with `entryPoints`) is normative, and update Specification §7.4 to match.

### People review (does not block the gate, but is needed before M4 generators)

- **Registry:** 172 targets still have `covers` or `generator` set to `TODO`. The statement scopes from the bootstrap also need confirming.
- **Coverage mapping:** the 76 sub-test credits and 139 invalid-case credits were proposed by `tools/bootstrap-coverage.ts`. Each one needs to be confirmed by hand (build steps 4.3).
- **Gap list:** review it against requirements §1.4–§1.6 (build steps, step 5).

### Differences from the design

- **No separate `RefBackend` interface yet.** The class `GmpReference` exposes the narrow surface (`reference`, `evaluateAt`, `piTimes`). An interface can be extracted if the R3 fallback (`decimal.js`) is ever needed.
- **atan2 and hypot are composed from MPFR primitives.** gmp-wasm has no binding for them. The Ziv check covers any loss in the composition, and the golden table includes both.
- **The golden table has 414 entries rather than about 500.** It covers every function with fixed and seeded-random inputs. More can be added by changing `PER_FUNCTION_RANDOM` and regenerating.

## Can M3 start?

The M3 vertical slice (`math/div` and `type/intToFloat`) uses only scalar results, so R1 does not block it. R2 affects the oracle writer, which M3 builds. It will write the on-disk schema that the existing suite uses, and the reader already accepts both forms. If the decision goes the other way, the change is confined to that writer.

**Recommendation:** start M3 under these documented assumptions while the working group decides. Hold any vector or matrix comparison work in M4 until R1 is settled.
