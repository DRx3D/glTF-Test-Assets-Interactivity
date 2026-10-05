# KHR_interactivity Test Generator: Build Steps

| | |
| --- | --- |
| Document status | Draft 0.2 |
| Date | 2026-10-05 |
| Project specification | `Documents/KHR_interactivity_test_generator_typescript_spec.md` |
| Requirements document | `Documents/KHR_interactivity_test_generator_spec.md` |

This is the build order for the supplemental test generator, updated for test suite revision `9ffd30e` (branch `fix/spec-and-json-conform-fixes`). That revision already covers most flow, event, animation, interpolation and rejection targets, so Steps 10 and 11 are smaller than in Draft 0.1. It follows the module dependency order (project spec section 4) and the milestones M1–M6 (project spec section 17). Each step says what to build and how you know it is done.

"Section N" refers to the TypeScript project specification. "§N" refers to the requirements document.

---

## Step 0: Settle the two blocking decisions

Both need the working group before M3 starts. Steps 1–3 can proceed while they are pending.

- **R1, component extraction.** Ask the working group to add `math/extract2`, `extract3`, `extract4`, `extract2x2`, `extract3x3` and `extract4x4` to the harness operation set (§7.2). Without them, vector and matrix results cannot be compared component by component, which §7.3 requires. The existing suite's own harness already uses `math/extract3`, which supports the request.
- **R2, oracle schema.** Confirm that the oracle shape on disk (`tests[].subTests[]` with `entryPoints`) is normative, and update the flat field list in §7.4 to match. The shape is unchanged at revision `9ffd30e`.

---

## Step 1: Scaffold the project (M1, part 1)

```
Generator/
  package.json  package-lock.json  tsconfig.json  vitest.config.ts
  .gitattributes          # * text eol=lf
  data/  src/  test/  tools/
```

- Node.js LTS 22 or later, TypeScript 5.x, with `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Runtime dependencies, pinned to exact versions: `gmp-wasm`, `gltf-validator`, `ajv`, `yaml`, `commander`.
- Development dependencies: `vitest`, `fast-check`, `eslint`, `@typescript-eslint/*`, `prettier`, `tsx`.
- Set up ESLint first, with the banned-API rules from section 5.6:
  - `Math.fround`, `Float32Array`, `Math.round`
  - `Math.random`, `Date`, `toLocaleString`, `localeCompare`, `Intl`
  - `JSON.stringify` outside `test/`
  - transcendental `Math.*` functions
  - shift operators outside `src/numeric/int32.ts` and `src/prng/`
- CI on GitHub Actions, on `windows-latest` and `ubuntu-latest`: `npm ci`, `tsc --noEmit`, `eslint`, `prettier --check`, `vitest`.

**Done when:** CI is green on the empty project.

---

## Step 2: Numeric core and PRNG (M1, part 2)

Build these in `src/numeric/` and `src/prng/`, in this order.

1. **`int32.ts`**
   - `add`, `sub`: `(a ± b) | 0`
   - `mul`: `Math.imul(a, b)`
   - `neg`, `abs`: `(-a) | 0`, so that −2147483648 maps to itself (spec line 2510)
   - `div`, `rem`: truncate toward zero; handle INT_MIN / −1, divisor 0 as the Specification defines, and normalise the `-0` that JavaScript's `%` produces
   - `asr`, `lsl`, `lsr`: per the Specification for shift counts outside 0–31; never rely on JavaScript's 5-bit masking
2. **`f64.ts`**
   - `round`: away from zero at half-way; −0 for inputs in (−0.5, 0) (spec line 568)
   - `min`, `max`, `sign`, `fract`, `clamp`, `saturate`, `mix` from the Specification's definition tables, including the NaN and ±0 rows
   - `isNegZero`, `nextUp`, `nextDown`
3. **`format.ts`**
   - `formatF64` uses `String(x)` (shortest round-trip, locale-independent) and adds `.0` to integer values to match the existing oracle style
   - Oracle contexts write `"-0"`, `"NaN"`, `"Infinity"` and `"-Infinity"`; graph-JSON contexts throw on these values
4. **`json.ts`**: a canonical JSON writer over a tagged tree with explicit key order. Never `JSON.stringify`.
5. **`prng/splitmix64.ts`**: SplitMix64 on BigInt, with `scatterF64` (redraws Inf/NaN bit patterns) and `scatterInt32` (§8.10).

Tests:

- fast-check properties comparing every int32 operation with a BigInt model
- `formatF64` round-trip property
- a fixture of the first 16 SplitMix64 outputs for seed 0 and for the default seed, recorded once from the reference C implementation

**Done when:** `numeric/` and `prng/` have 100% branch coverage and the fixtures match (M1 gate, part 1).

---

## Step 3: GLB writer and CLI skeleton (finishes M1)

- **`asset/glb.ts`**: 12-byte header, JSON chunk padded with `0x20`, BIN chunk padded with `0x00`, 4-byte alignment. Test it by validating output with `gltf-validator`.
- **`cli/`**: `commander` with the subcommands `generate`, `check-registry`, `gaps` and `explain`. `--copyright-owner` and `--copyright-year` are required, so the clock is never read.

**Done when:** a hand-built minimal GLB passes the validator, and the CLI parses every option in section 14.

---

## Step 4: Data files (M2, the longest manual step)

This step carries the most schedule risk (R4 and R5 in section 18).

1. **`data/operations.yaml`**: transcribe all 135 operations from the Specification. For each: input and output sockets with types, flow sockets, configuration properties with defaults and validity rules, and the special-case rows of its definition table. Have a second person review each category, and cross-check against the KHR_interactivity JSON schemas and the socket names used in existing GLBs.
2. **`tools/bootstrap-registry.ts`**: parse the tables in §1.4–§1.6 into a first draft of `data/registry/*.yaml`, then finish each target's `covers` block by hand.
3. **`data/existing-coverage.yaml`**: map existing sub-tests to the targets they credit. Build `tools/suggest-coverage.ts` first to propose candidates, then confirm each one by hand. A sub-test compared with a tolerance never earns precision or negative-zero credit.
4. **`data/interpretations.yaml`**: starts empty; add an entry whenever a generator needs a judgment the Specification does not state directly (§9.5).
5. **JSON Schemas** for all four files, and a working `khr-itest-gen check-registry`.

**Done when:** `check-registry` reports no errors.

---

## Step 5: Existing-suite reader and gap determination (M2)

- **`existing/`**: walk `Tests/Interactivity` with sorted directory listings; parse every GLB and oracle (accepting both oracle shapes); skip the `Overview.glb` and `mathtests.glb` aggregates; build the sub-test inventory and the name set used for collision checks. Both index files, `test-index.json` and `mathtests-index.json`, are at the top of `Tests/Interactivity`.
- **Invalid-graph cases**: read `invalid/invalid-index.json` (179 cases). They are never generated against, but the mapping can credit rejection targets to them so the coverage report shows which rejection rules are covered.
- **Gap determination**: a target counts as covered only if `existing-coverage.yaml` credits it. A mapping entry that names a sub-test missing from the inventory is a fatal error.
- **`khr-itest-gen gaps`** prints the result. This is the first useful output: the real gap list.

**Done when:** the gap list is produced and reviewed against §1.4–§1.6.

---

## Step 6: Reference library (M2)

- **`reference/`**: a `RefBackend` interface with a `gmp-wasm` implementation.
- **`toF64`**: round to nearest binary64 using Ziv's check. Compute at 128 bits, recompute at twice the precision, and keep doubling up to 1,024 bits until two consecutive results agree. If they never agree, fail generation for that value.
- **Golden table**: about 500 (function, input, expected bits) entries computed independently with MPFR's C API or `mpmath` at 300 bits. The backend must match every entry bit for bit.

**M2 gate:** `check-registry` is clean, the golden table matches, and R1 and R2 are decided.

---

## Step 7: Sampling engine (M2 into M3)

- **`sampling/classes.ts`**: every value class in §8.2–§8.5. Each float constant is written as a decimal literal and as its hex bit pattern, with a test that they agree.
- **`sampling/domains.ts`**: the operation-specific values from §8.3, computed (for example `nextUp(1)`) rather than typed where possible.
- **`sampling/combine.ts`**: special-case rows first, then each sampled value with ordinary values in the other positions, the mandatory int32 pairs, divisor-0 cases for `div`/`rem`, all boolean combinations and the shift-count set.
- **`sampling/pack.ts`**: packs values into `float4` and `float4x4` sub-tests. It first reserves scalar sub-tests for every value in the zero, halfway, infinity and NaN classes, and it ensures at least one vector sub-test per type has all-distinct components.
- **Planner**: generators emit placeholder scatter slots; the planner fills them after planning, in asset-name order, then sub-test order.

**Done when:** unit tests cover every class and combination rule, and the 64-value limit check rejects oversized plans.

---

## Step 8: Graph builder, harness and writers (M3, the vertical slice)

Build the whole pipeline end to end for just two targets before writing any more generators.

1. **`graph/`**: typed builder; topological sort over value and flow edges (forward-only rule, spec lines 5298 and 5387); socket ids in Specification socket order; types array.
2. **`graph/harness.ts`**: `event/onStart` sends `test/onStart`, then a `flow/sequence` runs each sub-test (setup, operation, set result variable, compare, branch, set pass variable, indicator) and finally the report. Asynchronous sub-tests use a `Harness_Completed` counter.
3. **`graph/compare.ts`**: every comparison mode, including the `1 / x` sign-of-zero check. An operation is never used to verify its own result.
4. **`asset/oracle.ts`, `description.ts`, `index.ts`, `naming.ts`**: split assets at 100 sub-tests or 2,000 nodes.
5. **`validate/`**: self-checks V1–V9 and the in-memory staging tree, so nothing is written unless every check passes.
6. **Two generators**: `prerequisites/` (verifies the harness operations) and `math/div` (`div-boundary`, for example `div(-7, 2) = -3`, spec line 2626). The earlier example, `math/round` negative zero, is now covered by the existing suite.
7. **Golden test**: a reduced registry of about 15 targets, with the generated output committed and compared byte for byte.

**M3 gate:** V1–V9 pass, the golden test is in place, and the slice runs correctly on one engine. Babylon.js with `NullEngine` is the first adapter target.

---

## Step 9: Math and type generators (M4)

- One table-driven generator for every component-wise math operation, driven by `operations.yaml` and the sampling engine.
- Hand-written generators for `select`, `switch`, `random`, `matDecompose` (with `set` comparison for negative determinants), and the quaternion and colour operations.
- `type/` generators for conversion boundaries and negative zero.
- **Expected-value audit**: recompute every exact-mode expected value with an independent implementation (BigInt for int32, a separate model for rounding and conversions).

**M4 gate:** every math and type target is covered, and the audit reports zero mismatches.

---

## Step 10: Flow, state and event generators (M5)

M5 depends only on M3, so it can run in parallel with M4.

- **`flow/`**: what the existing suite still lacks: loop ranges at the int32 limits (64 iterations or fewer each), negative `n` for `doN`, `waitAll` with 0 and 64 inputs, `multiGate` with both options true, `setDelay` with a duration of 0, and `while` with a condition that changes in the body.
- **`variable/`**: type defaults, matrix and `ref` variables, and interpolation of `float2`, `float3`, `float4` without slerp, and matrices.
- **`event/`**: `send` and `receive` for vector, matrix and the remaining value types. Activation order and first-tick values are already covered.
- **`debug/`**: asserts that `out` fires; records `expectedLogOutput` and declares `logCapture`.
- **`config/`**: the fallback cases still missing (`flow/for` `initialIndex`, `math/quatFromAngles` `order`, `flow/multiGate` missing properties, `flow/waitAll` missing, non-integer and negative values, `debug/log` `severity`). Each invalid configuration must behave observably differently from the default, or generation fails.
- **`concepts/`**: socket retention, type defaults, and the runnable edge cases using `g.raw()`.
- Conditional sub-tests for the `maxActive*` limits.
- First engine adapter, run with a fixed 1/60 s tick and with a deterministic jittered tick.

**M5 gate:** asynchronous tests are stable under both fixed and jittered ticks.

---

## Step 11: Pointer and animation generators, reports and release (M6)

- **Base scenes**: cameras, lights, morph targets, skins and animations.
- **`pointer/`**: `activeCamera`, the `{}` form of the animation state pointers, `pointer/get` type mismatch, nodes outside the scene, valid template syntax (`~0`, `~1`), and interpolation of the remaining types. Error paths and rotation slerp are already covered.
- **`animation/`**: an animation with a maximum time of 0, and the `maxActiveAnimations` limit. Reverse playback, looping, restart, `stopAt` and autoplay are already covered.
- **`report/`**: `supplemental-coverage.json` as the source of truth, with `supplemental-coverage.md` rendered from it.
- **Determinism**: `--verify-determinism`, and a CI job that compares output hashes from Windows and Linux.

**M6 gate:** every in-scope target is covered or explained (V4), and the working group has reviewed the coverage report.

---

## Step 12: Acceptance and handoff

- [ ] `khr-itest-gen generate` with default inputs exits with code 0 and produces byte-identical output on Windows and Linux.
- [ ] Every in-scope target is covered by an existing or supplemental sub-test, or is listed with a reason the working group accepts.
- [ ] Every asset passes the glTF Validator and the KHR_interactivity schemas, and every self-check passes.
- [ ] The expected-value audit and the MPFR golden table both match exactly.
- [ ] At least one engine adapter has run the full output, and every disagreement is in the report.
- [ ] An unmodified existing runner loads and runs a sample of 20 supplemental assets.
- [ ] The working group has reviewed the registry, the coverage mapping and the interpretations, using `supplemental-coverage.md` as the review artifact.

After acceptance, the maintainers decide whether to merge `supplemental-index.json` into the existing index files (Appendix A item 4 of the requirements document).

---

## Effort

The project spec estimates about 27 engineer-weeks:

| Milestone | Steps | Estimate (engineer-weeks) |
| --- | --- | --- |
| M1 Foundations | 1–3 | 3 |
| M2 Data and reference | 4–7 | 5 |
| M3 Vertical slice | 8 | 5 |
| M4 Math and type | 9 | 6 |
| M5 Flow, state, events | 10 | 4 |
| M6 Pointers, animation, release | 11–12 | 4 |

With two engineers running M4 and M5 in parallel, calendar time drops by about four weeks.

## Where to start

Steps 1 and 2 have no dependencies, and everything else relies on the determinism and numeric guarantees they establish.
