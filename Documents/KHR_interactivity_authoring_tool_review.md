# Review of the Generator Documents Against the Interactivity Authoring Tool

| | |
| --- | --- |
| Document status | Draft 0.2 |
| Date | 2026-10-05 |
| Tool reviewed | `KhronosGroup/glTF-InteractivityGraph-AuthoringTool`, `main` at `3771735` (2026-09-29) |
| Documents reviewed | `KHR_interactivity_test_coverage_report.md`, `KHR_interactivity_test_generator_spec.md` (Draft 0.2), `KHR_interactivity_test_generator_typescript_spec.md` (Draft 0.2), `KHR_interactivity_test_generator_build_steps.md` (Draft 0.2); Section 3 changes applied in Draft 0.3 of each |

**Verdict.** The authoring tool is of little use for *creating* the supplemental assets, but it is very useful for *testing* them. It already contains a headless TypeScript engine and a Jest harness that runs every asset in the test suite on two engine configurations. It also holds two data sets the generator can cross-check against. None of this changes the generator's architecture, but it changes the adapter plan, adds three compatibility constraints, and gives concrete tools for two of the project's risks.

---

## 1. What the tool contains

| Part | Location | What it does | Relevance |
| --- | --- | --- | --- |
| Graph editor (React, React Flow) | `src/authoring/`, `src/components/` | Interactive authoring of `KHR_interactivity` graphs; import and export of glTF | Low. Manual authoring does not scale to ~1,500 sub-tests and cannot meet the determinism requirements (§5.3). |
| Execution engine | `src/BasicBehaveEngine/` (145 node classes), published as npm package `@khronosgroup/gltf-interactivity-engine` 0.1.0 (Apache-2.0) | Runs a graph from its JSON. Decorators connect it to a pure glTF object model (`GlTFObjectModelDecorator`) or to Babylon.js (`BabylonDecorator`) | High: the natural first adapter target. |
| Sample-asset harness | `tst/assets/` (`npm run test:assets`, `test:assets:core`, `test:assets:e2e`) | Loads every asset from `test-index.json`, `mathtests-index.json` and any unindexed `test-Json/*.json`, runs it headless, and reports one Jest test per sub-test | High: an existing, unmodified runner to check runner compatibility against. |
| Operation specs | `src/authoring/spec/nodes.ts` | 143 operation entries (135 core plus extension operations) with socket names, `typeOptions` and `typeGroup` per socket | Medium: a cross-check for `operations.yaml`. |
| Object Model metadata | `src/objectModel/generated/glTFSchemaMetadata.ts`, built by `scripts/generate-object-model-schema.mjs` from the glTF repository | Object Model pointers with type and `readOnly` flag; drives a "Spec pointer coverage" report (`KHR_INTERACTIVITY_SPEC_COVERAGE=1`) | Medium: seeds `O-` targets and read-only `pointer/set` cases. |

The existing test assets were produced by a Unity sample project (`invalid/README.md` names "Sample Scenes/Export Khronos Invalid Graph Tests"), not by this tool.

## 2. Findings that affect the documents

### 2.1 An existing headless runner already exists

The tool's harness is an "existing runner" in the sense of requirements §4.3: it reads the oracle files unchanged, and it runs both the Core engine (no rendering) and a browserless Babylon world (`NullEngine`). The TypeScript spec lists this engine as a candidate adapter with "Likely" headless support. That is now confirmed: it runs headless today.

Acceptance criterion "An unmodified existing runner loads and runs a sample of 20 supplemental assets" (TypeScript spec section 17) can name this harness and become a CI step. Point `KHR_INTERACTIVITY_SAMPLE_ASSETS` at a tree that contains the supplemental output.

### 2.2 The runner discovers unindexed assets

`loadAssetEntries` reads both index files and then adds every `test-Json/*.json` file not already listed. Supplemental assets written under `Tests/Interactivity` will therefore run in this harness without any index merge. This bears on requirements Appendix A item 4 (index merging). Merging is not needed for this runner to execute them, but it also means maintainers cannot keep supplemental assets out of a run just by leaving them unindexed.

### 2.3 Pass/fail comes from the graph, not the oracle values

`getSubTestFailure` takes the in-graph `TestResult_HasPassed_*` variable as ground truth. It compares `expectedResultValue` only as a sanity check that logs a warning, with an absolute tolerance of 0.05 and a relative tolerance of 3%. Consequences:

- The `"-0"` string (requirements §7.4, Appendix A item 3; TypeScript spec R7) does not affect this runner, because `Number("-0")` parses and the comparison only warns. The risk applies to other runners only.
- A supplemental sub-test whose in-graph comparison is wrong will pass silently here. The generator's own expected-value audit (TypeScript spec section 15) is the only protection, which the documents already require.

### 2.4 The runner ignores `expectedDuration`

This is the most important compatibility issue. `runGraphAndWait` does not listen for `test/onStart`. It estimates the wait from the inline `duration` values of `flow/setDelay`, `flow/throttle`, `variable/interpolate` and `pointer/interpolate` nodes, adds 0.35 s, and caps the result at 6 s (`KHR_INTERACTIVITY_ASSET_MAX_WAIT_SECONDS`). It does not account for animation lengths or for durations supplied by a connected node, and it waits in real time.

A supplemental asset whose results become final through an animation, through a computed duration, or after 6 s would read unfinished variables in this runner and fail. The requirements spec allows an `expectedDuration` of up to 10 s (§7.9) and does not require an inline duration anywhere.

### 2.5 The engine runs on the wall clock

`flow/setDelay` uses `setTimeout`, and the tick loop uses `performance.now()`. The TypeScript spec's adapter design (section 16) assumes a virtual clock with `tick(dt)`, including a jittered-tick run to catch frame-rate assumptions. With this engine, that needs fake timers (for example `@sinonjs/fake-timers`, which replaces `setTimeout` and `performance.now`) or a change to the engine.

### 2.6 Known engine gaps will show up as disagreements

These are expected, and the documents already say disagreements never change expected values (requirements §12):

- **Single precision in matrix operations.** `math/matInverse`, `math/matCompose` and parts of `math/matDecompose` go through gl-matrix on `Float32Array`. The precision sub-tests (requirements §10.3) for these operations will fail on this engine, which is the correct outcome under spec line 278. Reported as [AuthoringTool #129](https://github.com/KhronosGroup/glTF-InteractivityGraph-AuthoringTool/issues/129).
- **Configuration fallback is not implemented.** The tool's README lists "configuration default values and validation" and "declaration validation" as TODO, and `BehaveEngineNode` has a "todo: if one is missing or invalid" comment. The configuration-fallback sub-tests (requirements §10.5) will likely fail. Reported as [AuthoringTool #130](https://github.com/KhronosGroup/glTF-InteractivityGraph-AuthoringTool/issues/130).
- **Limited rejection.** `validateGraph` enforces the forward-reference rule, and nodes check for required values and configurations, but most rules in the `invalid/` set are not enforced. The harness does not run `invalid/` cases at all.

### 2.7 Two data sets support the riskiest manual work

- **`operations.yaml` (TypeScript spec R4).** Comparing the transcribed catalogue with `nodes.ts` (socket names, allowed types, type groups) catches transcription errors mechanically. It is an implementation's reading of the Specification, so a mismatch means "check the Specification", never "copy the tool". It has no special-case tables, so it does not help with those.
- **Object Model pointers (requirements §10.8).** `glTFSchemaMetadata.ts` lists the pointers derived from the glTF schemas, with types and read-only flags. It can seed the `O-` targets and the read-only `pointer/set` cases. The tool's "Spec pointer coverage" report is a ready-made second opinion on requirements Section 1.5.3.

### 2.8 Licensing

The engine is Apache-2.0. Using it as an optional or development dependency of the generator is compatible with the generator's own licensing and with the CC BY 4.0 assets, because the assets do not contain any of its code.

---

## 3. Changes by document (applied)

### 3.1 Coverage report

| Section | Change |
| --- | --- |
| Section 4, "Wide tolerances" | Add that the authoring tool's runner uses the in-graph pass variable, so its own 0.05 / 3% tolerance never decides a result. |
| Section 2.3 (Object model pointers) | Optional: cross-check against the tool's "Spec pointer coverage" output and note any differences. |

### 3.2 Requirements spec

| Section | Change |
| --- | --- |
| §7.2 item 3, §7.9 | Add: an asset whose results are not final when its `event/onStart` sequence ends **SHOULD** contain a `flow/setDelay` with an inline `duration` no less than `expectedDuration`, and `expectedDuration` **SHOULD NOT** exceed 5.5 s. This keeps assets runnable in the authoring tool's harness, which ignores `expectedDuration` (Section 2.4). A harness change has also been requested from the tool maintainers ([AuthoringTool #128](https://github.com/KhronosGroup/glTF-InteractivityGraph-AuthoringTool/issues/128), Section 5); 10 s remains the hard limit. |
| §7.4 | Add that `entryPoints` is populated and `requiresUserInteraction` is never set, because the harness skips any test with an interaction entry point. |
| §12 | Name the authoring tool engine (Core and Babylon decorators) as the first adapter. |
| Appendix A, item 3 | Note that the authoring tool's runner is unaffected by `"-0"`. |
| Appendix A, item 4 | Note that the authoring tool's runner discovers unindexed assets, so index merging affects discovery for other runners only. |

### 3.3 TypeScript spec

| Section | Change |
| --- | --- |
| 2 (Technology stack) | Add `@khronosgroup/gltf-interactivity-engine` as an `optionalDependency` for adapters, pinned like the others. Confirm it is published to npm; if it is not, depend on a pinned git revision of the tool. |
| 8.2 (Operation catalogue) | Add a unit test that compares `operations.yaml` with the tool's `nodes.ts` (socket names and type options) and lists differences for review. Record this under R4. |
| 8.1 (Target registry) | Seed `O-` targets from `glTFSchemaMetadata.ts` in `tools/bootstrap-registry.ts`. |
| 16 (Adapters) | Make the authoring tool engine the first adapter: Core decorator first, Babylon decorator second. Replace "Likely; TS code base" with "Yes; its Jest harness already runs the suite headless". Drive time through fake timers (Section 2.5). List the known gaps from Section 2.6 so their disagreements are expected. |
| 15 (Testing and CI) | Add a scheduled CI job that runs the tool's `npm run test:assets:core` with `KHR_INTERACTIVITY_SAMPLE_ASSETS` pointing at a tree containing the supplemental output. Use it as the "unmodified existing runner" acceptance check. |
| 17 (Acceptance) | Name the authoring tool harness as the runner for the 20-asset compatibility check. |
| 18 (Risks) | Add a risk: supplemental async assets time out in the authoring tool's harness (Section 2.4); mitigation per Section 3.2. Lower R7 for this runner (Section 2.3). |

### 3.4 Build steps

| Step | Change |
| --- | --- |
| Step 4 | Run the `nodes.ts` comparison while transcribing `operations.yaml`. |
| Step 8 (M3 gate) | Change the first engine from Babylon.js `NullEngine` to the authoring tool's Core engine, and run the slice through the tool's own harness as well as through our adapter. |
| Step 12 | Name the authoring tool harness for the unmodified-runner check. |

---

## 4. What the tool does not change

- The generator is still needed. The tool authors graphs by hand and cannot produce deterministic, sampled, self-checking assets at the required scale.
- Expected values still come from the generator's numeric core and MPFR reference, never from running this or any engine (requirements §12).
- The open decisions R1 (component extraction) and R2 (oracle shape) are unaffected. The tool's harness reads the nested oracle shape, which supports the R2 recommendation.

## 5. Open questions and follow-up

1. Is `@khronosgroup/gltf-interactivity-engine` published to npm, or only prepared for publication (PR #125 renamed it on 2026-09-29)?
2. [AuthoringTool #128](https://github.com/KhronosGroup/glTF-InteractivityGraph-AuthoringTool/issues/128) asks the tool maintainers to make the harness read `expectedDuration` from `test/onStart`. If they do, the constraint in Section 3.2 can be relaxed.
3. Defects are filed as issues in the repository that owns them: engine and harness defects (Section 2.6) in `glTF-InteractivityGraph-AuthoringTool`, test-asset defects in `glTF-Test-Assets-Interactivity`, and Specification text issues in `glTF`.
