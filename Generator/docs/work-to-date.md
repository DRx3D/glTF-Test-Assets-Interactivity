# Supplemental KHR_interactivity test generator: work to date

Status as of 2026-10-19. Branch `generator-m3` in the DRx3D fork of `glTF-Test-Assets-Interactivity`, pushed to `origin`.

**Deliverables.** This work creates only the generator software. The test assets it generates are not stored in the repository; they may be provided collectively as a ZIP file of the output directory. `Generator/out/` is git-ignored, and the only generated files committed are the golden-test fixtures in `test/golden/out/`.

## Summary

The project builds `khr-itest-gen`, a TypeScript generator for supplemental `KHR_interactivity` test assets. The assets fill the coverage gaps in the existing test suite without modifying it.

- **Planning is complete.** The requirements, design spec and build steps are in `Documents/`, on the fork's `main` branch and in GitLab.
- **Milestones M1 and M2 are complete.** M2's gate still waits on two working-group decisions (R1 and R2).
- **Milestone M3, the vertical slice, is complete.** All four gate items are met, including a run through the authoring tool's own sample-asset harness, unmodified, on both its Core and Babylon configurations.
- **The generator runs end to end.** It produces 2 supplemental assets with 54 sub-tests. Every sub-test passes on the Khronos authoring tool's engine, through our adapter and through the tool's own harness.
- **The finished suite is expected to have about 130–150 assets and 1,300–1,600 sub-tests.**
- **About 14 engineer-weeks of planned work remain (M4–M6).** At the pace of M1–M3, that is roughly 4–7 working sessions, plus review that only people and the working group can do. See [Remaining effort](#remaining-effort).

## Planning documents

All are in `Documents/`. They are committed on the fork's `main` and pushed to `origin` (GitHub) and to GitLab `3dformats/interactivity-tsg`, folder `Test-Generator/`.

| Document                                              | Purpose                                                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `KHR_interactivity_test_coverage_report.md`           | Coverage analysis of the existing suite against the Specification at `c5d1e1e8`                                                  |
| `KHR_interactivity_test_generator_spec.md`            | Requirements for the generator: sampling, harness, oracle, validation, reports                                                   |
| `KHR_interactivity_test_generator_typescript_spec.md` | Project spec for the TypeScript implementation: architecture, modules, milestones, risks. Also published as an online Claude Doc |
| `KHR_interactivity_test_generator_build_steps.md`     | Step-by-step build order with milestone gates                                                                                    |
| `KHR_interactivity_authoring_tool_review.md`          | How the Khronos authoring tool relates to the plan                                                                               |

The analysis was rerun after upstream merged `fix/spec-and-json-conform-fixes` (PR #22, suite content at `9ffd30e`), and again on 2026-10-19 for suite content at `70bb145` (re-exported assets, new sub-tests for `flow/for`, `flow/switch` and `math/quatFromAngles`, and the new `pointer/activeCamera` asset). The documents are now at Draft 0.4.

### Issues

Issue drafts live in `Documents/.issues.md`. That file is local only and never committed. Every filed issue carries an AI disclosure.

| #   | Repository                            | Status                                                                                                                  |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1–3 | glTF-InteractivityGraph-AuthoringTool | Filed: #128 (`expectedDuration`), #129 (single-precision matrices), #130 (configuration fallback); all fixed and closed |
| 4–8 | glTF-Test-Assets-Interactivity        | Filed: #25–#29 (description and label defects, README count); all fixed upstream and closed                             |
| 9   | glTF                                  | Filed: #2665 (graph versus extension rejection)                                                                         |
| 10  | AuthoringTool                         | Drafted: scalar `float` missing from `math/dot`, `math/length`, `math/normalize`; still open at `4349755`               |
| 11  | Test-Assets                           | Withdrawn: oracle pass-variable names, fixed upstream by `70bb145` before filing                                        |
| 12  | AuthoringTool (engine 1.0.0)          | Withdrawn: engine throws without `variables` or event `values`; fixed in tool `main` and engine 1.1.0                   |
| 13  | AuthoringTool (engine 1.0.0)          | Withdrawn: engine npm package cannot be imported from Node.js; fixed in engine 1.1.0                                    |
| 14  | Test-Assets                           | Drafted: labels with line breaks run together in description files (145 sub-tests, 12 assets)                           |
| 15  | AuthoringTool                         | Drafted: `schema:generate` never finds `../glTF` on Windows (`URL.pathname` gives `C:\C:\…`)                            |

## Generator milestones

Code is in `Generator/` (Apache-2.0): about 5,200 lines of source, 2,200 of tests and 800 of tools. CI (`npm run ci`) runs the type check, ESLint with banned-API rules, a Prettier check, and Vitest with coverage. All 199 tests pass, with 96.6% line coverage, and `numeric/` and `prng/` at 100%.

### M1 Foundations (complete)

- **Numeric core** (`src/numeric/`):
  - int32 and binary64 operations exactly as the Specification defines them.
  - Shortest round-trip number formatting.
  - A canonical JSON writer that keeps NaN, ±Infinity and −0.
- **Other pieces:**
  - SplitMix64 PRNG with a fixture from an independent Python implementation.
  - GLB writer and reader.
  - CLI skeleton.
  - GitHub Actions workflow.
- **Lint rules** ban APIs that would make output depend on binary32, the clock, the locale or engine accuracy.
- **Corrections found while building M1:** shift counts use the low 5 bits of the count, and there is no `math/lsr`. Both are fixed in the generator-branch documents, but not yet on `main`.

### M2 Data and reference (complete; gate pending R1 and R2)

- **Vendored Specification and data:**
  - `data/spec/`: the Specification at `c5d1e1e8` and its 8 schemas.
  - `data/operations.yaml`: 135 operations and 159 signatures, extracted from the Specification tables.
- **Target registry** (`data/registry/`): 287 targets, checked by `check-registry` with 0 problems. 171 targets are still marked TODO for people to review.
- **Existing suite** (`existing/`):
  - The reader covers 1,136 sub-tests and 179 invalid-graph cases (suite content at `70bb145`).
  - `data/existing-coverage.yaml` holds 98 sub-test credits and 139 invalid-case credits. The 22 added on 2026-10-19 for the new upstream sub-tests are marked for review.
- **Gap baseline** (`gaps`):
  - In scope: 40 covered by the existing suite, 175 gaps (177 before the `70bb145` credits for `math/quatFromAngles` order fallback and the `activeCamera` pointers).
  - Rejection: 56 covered by invalid cases, 10 not covered.
  - 6 impractical.
- **Reference library** (`reference/`):
  - MPFR through `gmp-wasm`, an LGPL-3.0 npm dependency used unmodified and not bundled.
  - Each value is computed at 128 bits, doubling until two results agree, up to 1,024 bits.
  - It reproduces all 414 entries of an independent mpmath golden table bit for bit. The table is generated by a Python tool in `Generator/.venv`.
- **Sampling engine:** value classes, combination rules, packing, scatter draw order, and domain-specific boundary values.
- **`data/interpretations.yaml`** with its schema and checks.
- **Gate summary:** `docs/M2-gate.md`.

### M3 Vertical slice (complete)

**Modules built:**

| Module                        | What it does                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph/builder.ts`            | Typed graph builder checked against the operation catalogue. It orders nodes so value inputs point back and flows point forward (spec lines 5298 and 5387), and gives `flow/sequence` outputs ids in code-unit order |
| `graph/harness.ts`            | `event/onStart` sends `test/onStart`, then runs the sub-tests through `flow/sequence` nodes (nested above 64 outputs); a report node sends `test/onSuccess` or `test/onFailed`                                       |
| `graph/compare.ts`            | Every comparison mode, including the `1 / x` sign-of-zero check. It never uses the operation under test, on the same input types, to check its own result (requirements §7.2)                                        |
| `asset/`                      | GLB with an indicator grid; the oracle in the nested schema existing runners read; a description with a Spec refs column; the supplemental index; naming and splitting                                               |
| `validate/`                   | Self-checks V1–V9 on the in-memory files. Each check has a test with a deliberately broken asset to prove it catches its defect                                                                                      |
| `generate/`                   | Pipeline (plan, split, name, draw, resolve, build, check), plus writing output and the determinism check. Nothing is written unless every check passes                                                               |
| `report/`                     | `supplemental-coverage.json` and `supplemental-coverage.md`                                                                                                                                                          |
| `generators/`                 | `prerequisites` (asset `harness-types`, 41 sub-tests) and `math/div` (asset `div-boundary`, 13 sub-tests, target S-2626)                                                                                             |
| `adapters/authoringEngine.ts` | Runs assets headless on `@khronosgroup/gltf-interactivity-engine` 1.0.0 (an optional dependency)                                                                                                                     |
| CLI `generate`                | Resolves `--spec` against the vendored copy; supports `--only`, `--config` and `--verify-determinism`                                                                                                                |

**M3 gate:**

| Item                                                           | Status                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| V1–V9 pass                                                     | Met                                                                                                                       |
| Golden test in place                                           | Met. 13 targets in `test/golden/`, output compared byte for byte                                                          |
| Slice runs correctly on one engine                             | Met on the authoring tool's engine. One workaround (an empty event `values` object) is applied and reported; see issue 12 |
| Slice runs through the tool's sample-asset harness, unmodified | Met on 2026-10-19 (tool `main` at `4349755`). See [Harness run](#harness-run)                                             |

**Engine verification:**

- Both slice assets pass every sub-test and send `test/onSuccess` exactly once, and every indicator turns green.
- A separate test runs every comparison mode with a right and a wrong expected value. Each passes and fails correctly, including telling −0 from +0, NaN, the tolerance modes and sets.

#### Harness run

The authoring tool was cloned next to this repository (`../glTF-InteractivityGraph-AuthoringTool`, `main` at `4349755`, 2026-10-19) and installed with `npm ci`. Its harness needs a full suite tree, so `tools/make-harness-tree.ts` copies the existing suite and adds the generated assets under `Tests/Interactivity`, as a supplemental run written there would look. The harness finds the unindexed assets through their `test-Json/*.json` files. Nothing in the tool was changed.

```
cd Generator
npx tsx src/cli/index.ts generate --spec c5d1e1e8 --suite ../Tests/Interactivity \
    --registry data/registry --out ./out/slice --copyright-owner "The Khronos Group Inc." \
    --copyright-year 2026 --only "prerequisites,math/div" --verify-determinism
npx tsx tools/make-harness-tree.ts out/slice out/harness

cd ../../glTF-InteractivityGraph-AuthoringTool
KHR_INTERACTIVITY_SAMPLE_ASSETS=<path to Generator/out/harness>
KHR_INTERACTIVITY_ASSET_NAME_FILTER=math/div-boundary     # or prerequisites/harness-types
npm run test:assets:core                                  # and npm run test:assets:e2e
```

| Asset                         | Schema validation | Core engine | Babylon (`NullEngine`) |
| ----------------------------- | ----------------- | ----------- | ---------------------- |
| `prerequisites/harness-types` | Pass              | 41/41       | 41/41                  |
| `math/div-boundary`           | Pass              | 13/13       | 13/13                  |

The harness takes each sub-test's in-graph pass variable as its result and warns when the result disagrees with `expectedResultValue` beyond its own tolerance. A run with `--silent=false` showed no such warnings. The tool now waits for `test/onStart`'s `expectedDuration` and for `test/onSuccess` or `test/onFailed` (AuthoringTool #128, fixed), so async assets in M5 no longer need the 6 s settle limit described in the authoring tool review.

The generated GLBs declare `test/onSuccess` and `test/onFailed` without `values`. They ran in the harness without our adapter's workaround, which confirms that tool `main` fixed the event part of issue 12; the `variables` part was checked in the code only. Engine 1.1.0 (npm, 2026-10-14) has the same fix and imports in Node.js (issue 13); the adapter still pins 1.0.0 and should move to 1.1.0 and drop the workaround.
**Differences from the design:**

- The prerequisites asset is named `harness-types`, because §6.2 has no `prerequisites` facet.
- Each asset has one entry point (its `event/onStart`).
- Only scalar results are compared until R1 is decided. The vector and matrix targets of `math/div` are reported as not coverable for that reason.
- V5 judges duplication through the coverage mapping.
- The determinism check runs twice in one process rather than in separate workers.
- `explain` moves to M4.
- A full run without `--only` fails V4 by design until the remaining generators exist.

## Expected size of the finished suite

From the requirements estimate (§1.9), which carries about ±30% uncertainty:

| Area                      | Assets   | Sub-tests  |
| ------------------------- | -------- | ---------- |
| Math operations           | ~105     | ~1,700     |
| Type conversion           | 4        | ~25        |
| Reference equality        | 1        | ~8         |
| Flow control              | ~8       | ~45        |
| Variables                 | 3        | ~45        |
| Pointers and Object Model | ~8       | ~80        |
| Animation                 | ~2       | ~6         |
| Events                    | ~3       | ~20        |
| Debug log                 | 1–2      | ~12        |
| Concepts and precision    | ~4       | ~35        |
| Configuration fallback    | ~6       | ~30        |
| **Total (full coverage)** | **~145** | **~1,950** |

The table counts full coverage of every remaining in-scope gap. Targets the existing suite already covers are not generated again, so the supplemental output is expected to be **about 130–150 assets with about 1,300–1,600 sub-tests**. Rejection tests are excluded; the existing `invalid/` set covers those.

Math sampling density drives most of the uncertainty. Asset splitting at 100 sub-tests or 2,000 nodes adds `partN` assets. Completing the 171 TODO registry targets may also move the gap list. Today's output is 2 assets and 54 sub-tests, about 1.5% of the expected assets and 4% of the expected sub-tests. The first firm counts will come with the M4 math generators.

## Remaining effort

The project spec plans 27 engineer-weeks for one engineer. M1–M3 account for 13 of them, and M1–M3 took roughly seven working sessions here, including the 2026-10-19 sync with upstream and the harness run that closed M3.

| Remaining work                                                                                                                                                      | Plan (engineer-weeks) | Estimate at the pace so far    | What paces it                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| M4 Math and type: table-driven math generator, special generators (`select`, `switch`, `random`, `matDecompose`, quaternion, colour), packing, expected-value audit | 6                     | 1–2 sessions                   | R1 (vector and matrix comparison); audit mismatches                      |
| M5 Flow, state, events: flow, variable, event, debug, config and concepts generators; async harness; conditional sub-tests                                          | 4                     | 1–2 sessions                   | Async timing on a real engine, which needs simulated time in the adapter |
| M6 Pointers, animation, release: base scenes, pointer and animation generators, cross-OS determinism, documentation                                                 | 4                     | 1–2 sessions                   | Base scenes; working-group review of the coverage report                 |
| **Total**                                                                                                                                                           | **14**                | **about 4–7 working sessions** |                                                                          |

**Work only people can do.** This sets the calendar more than the coding does:

- **Working-group decisions:**
  - R1: add the extract operations to the harness set. This blocks vector and matrix comparisons in M4, which are most of the math sub-tests.
  - R2: confirm that the nested oracle schema is normative.
- **Registry review:** finish the 171 TODO targets and confirm the statement scopes. Each target needs `covers` and an owning generator before a generator can cover it.
- **Mapping review:** confirm the 237 coverage credits, which a script proposed (215 from the coverage report, 22 for the sub-tests added upstream at `70bb145`).
- **Spot checks:** check `operations.yaml` and the interpretations against the Specification.
- **Release acceptance:** working-group review of `supplemental-coverage.md`, and a hand check of 20 assets in the tool's viewer.
- **Filing issues:** issues 10, 12, 13 and 14 are drafted in `Documents/.issues.md` but not yet filed.

With prompt reviews and decisions, a usable suite is about **2–4 weeks of calendar time** away. Without an R1 decision, M4 can still deliver scalar math, type, flow, state and event coverage, but most of the roughly 1,700 math sub-tests depend on comparing vectors and matrices component by component.

## Reproducing the current state

```
cd Generator
npm ci
npm run ci
npx tsx src/cli/index.ts generate --spec c5d1e1e8 --suite ../Tests/Interactivity \
    --registry data/registry --out ./out --copyright-owner "The Khronos Group Inc." \
    --copyright-year 2026 --only "prerequisites,math/div" --verify-determinism
```
