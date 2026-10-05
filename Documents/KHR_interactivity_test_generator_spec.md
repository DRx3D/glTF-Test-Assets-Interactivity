# KHR_interactivity Supplemental Test Asset Generator Specification

| | |
| --- | --- |
| Document status | Draft 0.3 |
| Date | 2026-10-05 |
| Target specification | `KHR_interactivity`, `Specification.adoc` at `KhronosGroup/glTF` revision `c5d1e1e8` |
| Target test suite | `KhronosGroup/glTF-Test-Assets-Interactivity` `main`; test content as of revision `9ffd30e`, merged by PR #22 (`fc073cf`) |

This document specifies software (the _generator_) that produces supplemental `KHR_interactivity` test assets. The assets fill the coverage gaps identified in Section 1 without modifying the existing test suite.

Section 1 is informative. Section 2 defines how the rest of the document is to be read.

---

## 1. Background (Informative)

### 1.1 Purpose

The `KHR_interactivity` extension is ratified, and its test suite has at least one test for every operation it defines. A requirement-level review of the suite at revision `0f24a49` found that most of the specification's normative statements, many operation type signatures, and a large set of edge cases had no test coverage. The suite has since been extended substantially (revision `9ffd30e`, merged to `main` by PR #22), including a new set of invalid-graph cases. This section records the review repeated against that revision and the estimate of how many assets are needed to close the gaps that remain. The rest of this document specifies a generator that produces those assets.

Two scope decisions made after the original review apply to this version of the generator:

- **Rejection tests are excluded.** Statements whose only observable outcome is that an implementation rejects a graph are not covered by the generator. Most of them are now covered by the existing suite's `invalid/` set; the rest are listed in Section 1.6.1 for that set to cover. Configuration-fallback cases, where an invalid configuration causes a valid graph to use its default configuration, are included.
- **Large value spaces are sampled, not enumerated.** Where a check could involve 2^31 or more indices or values, the generator uses a spread of values across the whole range, concentrated at the boundaries.

### 1.2 Sources and method

The review compared the `KHR_interactivity` specification against the test assets in `glTF-Test-Assets-Interactivity`.

| Source | Revision |
| --- | --- |
| `KhronosGroup/glTF`, `extensions/2.0/Khronos/KHR_interactivity/Specification.adoc` (status: Complete, Ratified) | `c5d1e1e8` (2026-09-28) |
| `KhronosGroup/glTF-Test-Assets-Interactivity`, `main`, `Tests/Interactivity` | `9ffd30e` (2026-10-05), merged to `main` by PR #22 (`fc073cf`) |

Line numbers in this document refer to `Specification.adoc` at the revision above. Revision `c5d1e1e8` differs from `166ed85`, used by the original review, only by four typo fixes, so every line number is unchanged.

The analysis was done in three passes:

1. **Node level.** Every operation defined in the specification (135 in total) was checked against the declarations in every test `.glb`.
2. **Requirement level.** Each MUST/SHALL/REQUIRED statement was compared against the graphs, inline input values, configurations, and oracle files of the relevant tests. Where node-level coverage existed, the test contents were inspected to see which types, configurations, and special values were actually exercised.
3. **Rejection level.** Each case in `invalid/invalid-index.json` was mapped to the statement it violates.

Only the test assets under `Tests/Interactivity` were considered. The showcase models under `Models/` exercise the extension but do not check results, so they do not count as coverage here.

A test that uses an operation only as part of the harness (for example `math/eq`, `flow/branch`, or `variable/set` used to record pass/fail) is not counted as testing that operation. Coverage is credited only where a test asserts the operation's result. An invalid-graph case is credited to the statement it violates.

The full review is maintained separately as `Documents/KHR_interactivity_test_coverage_report.md`. Sections 1.3 to 1.8 reproduce it.

### 1.3 Summary of findings

Node-level coverage is complete. All 135 operations have at least one dedicated test. The suite now has 159 test assets with 1,073 sub-tests, plus 179 invalid-graph cases. The suite README gives 1,071 sub-tests; the count here was taken from the oracle files.

Requirement-level coverage has improved a great deal. Of the 128 normative statements assessed (the BCP 14 terminology statement is excluded), 83 are covered, 17 are partially covered, and 28 have no coverage (6 of them impractical array-size limits). At the previous revision the figures were 14, 18, and 96.

The structural gap identified in the previous report is closed. The new `invalid/` set provides 179 deliberately invalid graphs, each breaking one validation rule, and the new `graph/` tests check valid graphs that look suspicious. Together they cover most of the JSON syntax and validation statements, and the operation-level rejection rules for `variable/*`, `pointer/*`, `event/*`, `math/switch`, `flow/switch` and `debug/log`. The rejection statements that remain uncovered fall into three groups: implementation limits (graph size, socket counts), type-equality rules for `math/select`, `math/dot` and `math/matMul`, and `pointer/set` with an invalid `type`.

The numeric gap has narrowed. The new `Extras/Float_Precision` asset checks double precision directly (for example `16777217 - 16777216 == 1` and `(2^53-1) - (2^53-2) == 1`), and distinguishes `+0` from `-0` by dividing by the result. The rest of the suite still uses single-precision inputs and tolerance comparisons, so double precision and the sign of zero are verified only for the operations in that one asset.

Type breadth is the largest remaining gap. Component-wise arithmetic is still tested with scalars only, the matrix types `float2x2` and `float3x3` are still rare and never used as variable or event types, `math/select` and `math/switch` are each tested with one type, and the scalar forms of `floatN` operations are untested. Special values for transcendental functions are also still missing.

### 1.4 Normative statements and their test coverage

Status values:

- **Covered**: at least one test asserts the required behavior.
- **Partial**: some of the required behavior is asserted, but not all of it. The note says what is missing.
- **None**: no test asserts the behavior.

Invalid-graph cases are cited by their id in `invalid/invalid-index.json` (for example `G1b`).

#### 1.4.1 Concepts

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 184 | Animations MUST NOT play automatically when the asset contains a behavior graph | Covered | `animation/state`: "Not started: translation unchanged" and `isPlaying` false before start. |
| 209 | Output value sockets MUST retain their values until a node with flow sockets executes | Partial | Only `math/random` checks this (now also across `flow/for` iterations). No test checks value stability for a pure node read twice across non-flow evaluations of other kinds. |
| 217 | Each input value socket MUST have an inline value or a connection; runtime MUST guarantee all inputs are defined when execution starts | Covered | Missing inputs are rejected (`F8a`, `F8c`); type-default inputs are asserted in `graph/extra_and_unknown_sockets`. |
| 238 | Socket order procedure MUST be used to compare ids | Covered | `flow/sequence` checks numeric, length-based, and case ordering. |
| 272 | Implementations MUST support all listed type signatures (including double-precision `float`) | Partial | Double precision is now asserted in `Extras/Float_Precision`. `float2x2` and `float3x3` are still used by only a few matrix tests and never as variable or event types. |
| 309 | Configuration on non-configurable operations MUST be ignored | Covered | `graph/ignored_configuration`: `math/add` with a configuration. Only one operation is checked. |
| 311 | Default configuration MUST be used when configuration is missing or invalid; operations without a default MUST cause rejection | Covered | Fallback is asserted for `flow/switch`, `math/switch`, `flow/waitAll`, and `flow/multiGate`. Rejection is asserted for missing configuration on `variable/get`, `variable/set`, `event/receive`, `event/send`, and `pointer/get` (`G1a`, `G2a`, `G8a`, `G9a`, `G4a`). |
| 313 | All defined configuration properties MUST be present and valid, otherwise fall back to default; undefined configuration properties MUST be ignored | Covered | `flow/multiGate` with `isRandom: "yes"`; `flow/switch` with an unknown property. |
| 359 | Variables without an initial value MUST be initialized to the type default | Partial | `float`, `float2`, `float3`, and `float4` variables are now declared without a value in `variable/set_and_get`, but no test asserts the resulting `bool` false, `int` 0, or NaN defaults. |
| 361 | Variables MUST retain their values until execution terminates | Covered | Implicit in every test, since results are stored in variables and read back. |
| 400 | Graph MUST be rejected if it exceeds implementation static limits | None | Limits are implementation-specific; no invalid case exceeds one. |

#### 1.4.2 Math operations

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 568 | `math/round`: half-way cases MUST round away from zero; values in (-0.5, 0) MUST round to -0 | Covered | `math/round` now has ±0.5, 1.5, ±2.5; `Extras/Float_Precision` checks `round(-0.3)` is -0 and `round(0.49999999999999994)` is 0. |
| 966 | `math/select`: `T` MUST be the same for `a`, `b`, and the output | None | No invalid case. `select` is still tested with `float` only (see Section 1.5.1). |
| 1009 | `math/switch`: case values MUST be converted to decimal strings without leading zeros | Partial | Negative cases, `[0.5, 1]` (fallback), duplicates `[1, 2, 2]`, and a selection without a case are covered. The float-literal examples (`-1.0`, `0.1e1`) are not. |
| 1011 | `math/switch`: graph MUST be rejected if generated sockets exceed the input socket limit | None | |
| 1023 | `math/switch`: graph MUST be rejected if any generated socket is missing or has a type different from `default` | Covered | `H1d`, `H1e`. |
| 1035 | `math/switch`: extra sockets MUST still have valid types and sources | Covered | An extra socket `"2"` is ignored (`math/switch`); invalid extra sockets are rejected (`F13a`, `F13b`). |
| 1075 | `math/random`: value MUST be initialized on first access and MUST stay the same between accesses without intervening flow activations | Covered | |
| 1083 | `math/random`: value MUST be updated on access after a new flow activation | Covered | Now also across `flow/for` iterations. |
| 1560 | `math/dot`: both inputs MUST have the same type | None | Rejection test needed. |
| 1813 | `math/matMul`: both inputs MUST have the same type | None | Rejection test needed. |
| 2218 | `math/quatFromAngles`: invalid or missing `order` MUST fall back to the default | None | All six valid orders are tested. No invalid or missing `order`. |
| 2510 | Integer negation of `-2147483648` MUST return `-2147483648` | Covered | `math/neg` and `math/abs`. |
| 2534 | Integer addition overflow MUST wrap | Covered | `2147483647 + 1`. |
| 2563 | Integer subtraction overflow MUST wrap | Covered | `-2147483648 - 1`. |
| 2592 | Integer multiplication overflow MUST wrap | Covered | `46341 * 46341`, `2147483647 * 2147483647`, `-2147483648 * -1`. |
| 2626 | Integer division MUST truncate toward zero | Partial | Only exact quotients, division by zero, and `INT_MIN / -1`. No inexact negative quotient such as `-7 / 2` (expected -3, not -4). |
| 2841 | `math/asr`: result truncated to 32 bits; sign bit MUST be propagated | Covered | Includes shift counts 0, 31, 32, 33, and -1. |
| 2855 | `math/lsl`: result MUST be truncated to 32 bits | Covered | |

#### 1.4.3 Type conversion

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3203 | `type/intToFloat` MUST be lossless | Covered | `Extras/Float_Precision`: `intToFloat(2147483647)` and `intToFloat(-2147483647)` checked by exact subtraction. |
| 3205 | `type/intToFloat` MUST NOT produce negative zero | Covered | `Extras/Float_Precision`: `intToFloat(0) is +0`. |

#### 1.4.4 Control flow

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3281 | `flow/sequence`: graph MUST be rejected if output flow count exceeds the limit | None | |
| 3341 | `flow/switch`: case values MUST be converted to decimal strings without leading zeros | Partial | Negative and empty case arrays, `[0.5, 1]`, `[-2147483649, 0]`, and duplicates `[1, 2, 2]` are covered. The float-literal examples (`-1.0`, `0.1e1`) are not. |
| 3343 | `flow/switch`: graph MUST be rejected if generated flows exceed the limit | None | |
| 3411 | `flow/for`: invalid or missing `initialIndex` MUST fall back to the default | None | Only valid values (0 and 1) are used. |
| 3473 | `flow/multiGate`: graph MUST be rejected if output flow count exceeds the limit | None | |
| 3477 | `flow/multiGate`: if either configuration property is missing or non-boolean, the default MUST be used for both | Partial | A non-boolean `isRandom` is covered. A missing property, a non-boolean `isLoop`, and `isLoop: true` with `isRandom: true` are not. |
| 3538 | `flow/waitAll`: invalid `inputFlows` (missing, non-integer, negative, >64) MUST fall back to the default | Partial | `inputFlows: 65` is covered. Missing, non-integer, and negative values are not. |
| 3628 | `flow/setDelay`: exceeding the maximum supported duration MUST activate `err` | Partial | `err` is now tested for negative, NaN, and +Infinity durations. A very large finite duration is not. |
| 3640 | `flow/setDelay`: `lastDelay` MUST be unique across all `setDelay` nodes | None | `lastDelay` validity and reset to null are checked; uniqueness is not. |
| 3676 | `flow/cancelDelay`: null or invalid delay references MUST NOT cause runtime errors | Covered | Null reference and an already-fired reference. |

#### 1.4.5 State manipulation (variables)

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3705 | `variable/get`: invalid variable index MUST cause rejection | Covered | `G1a`–`G1f`. |
| 3738 | `variable/set`: missing or empty `variables` configuration MUST cause rejection | Partial | Missing configuration is covered (`G2a`); an empty `variables` array is not. |
| 3740 | `variable/set`: invalid index in `variables` MUST cause rejection | Covered | `G2b`, `G2c`, `G2d`. |
| 3741 | `variable/set`: socket ids MUST be decimal without leading zeros | Partial | Multiple variables and a duplicate index are covered (`variable/setMultiple`), but ids are not tested against alternative encodings. |
| 3743 | `variable/set`: graph MUST be rejected if generated sockets exceed the limit | None | |
| 3746 | `variable/set`: missing or mistyped generated sockets MUST cause rejection | Covered | `G2e`, `G2f`. |
| 3748 | `variable/set`: extra sockets MUST still be valid | Partial | Invalid extra sockets are rejected on `math/add` (`F13a`, `F13b`), not on `variable/set`. |
| 3793 | `variable/interpolate`: invalid variable index MUST cause rejection | Covered | `G3f`. |
| 3795 | `variable/interpolate`: `int` or `bool` variables MUST cause rejection | Covered | `G3a`, `G3b`. |
| 3797 | `variable/interpolate`: `useSlerp` MUST be a boolean literal and MUST NOT be true unless `T` is `float4` | Covered | `G3c`, `G3d`, `G3e`; the slerp path is exercised on a `float4` variable. |

#### 1.4.6 Object model access (pointers)

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3881 | Pointer templates MUST be processed per the parsing rules: non-empty parameters, no duplicates, doubled literal brackets, `~0`/`~1` encoding | Partial | All 22 invalid template examples are rejection cases (`G5-01`–`G5-22`), and a doubled-bracket template is checked in `graph/json_syntax`. The valid `~0`/`~1` examples are not. |
| 3891 | Active animation state MUST be applied before a pointer get or set on an animated property | Covered | `animation/start_playback_modes` and `animation/state` read animated translation with `pointer/get` during and after playback. |
| 4060 | `pointer/get`: missing, non-string, or invalid `pointer` MUST cause rejection | Covered | `G4a`, `G4b`, `G5-*`. |
| 4062 | `pointer/get`: invalid `type` MUST cause rejection | Covered | `G4c`–`G4f`. |
| 4064 | `pointer/get`: graph MUST be rejected if template sockets exceed the limit | None | |
| 4129 | `pointer/set`: invalid `pointer`, or one containing `[value]`/`{value}`, MUST cause rejection | Covered | `G6a`, `G6b`; template parsing failures are covered through `pointer/get`. |
| 4131 | `pointer/set`: invalid `type` MUST cause rejection | None | `G6d` covers a mistyped value socket, not an invalid `type` configuration. |
| 4133 | `pointer/set`: graph MUST be rejected if sockets exceed the limit | None | |
| 4201 | `pointer/interpolate`: invalid `pointer`, or one containing reserved parameter names, MUST cause rejection | Covered | `G7a`–`G7d`. |
| 4203 | `pointer/interpolate`: invalid `type`, or a `bool`/`int` type, MUST cause rejection | Covered | `G7e`, `G7f`. |
| 4205 | `pointer/interpolate`: graph MUST be rejected if sockets exceed the limit | None | |
| 4264 | `pointer/interpolate`: quaternion properties MUST use spherical linear interpolation | Covered | "Rotation uses slerp (value at 25%)" on `/nodes/[nodeIndex]/rotation`. |

#### 1.4.7 Animation control

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4352 | Restarting an already playing animation MUST NOT activate the previous `done` flows | Covered | `animation/start_playback_modes`: "Restart: 1st [done] not fired". |
| 4353 | New animation entry: stop time MUST equal end time; stop completion MUST be null | Covered | `animation/stop_and_stopAt_edge_cases`: `stopAt` followed by a new `start`, including `stopTime` equal to and beyond `endTime`. |
| 4423 | `animation/stop`: animated properties MUST keep current values; `done` MUST NOT fire | Covered | Position frozen near 50%, `done` not fired; also `stop` on an animation that is not playing. |

#### 1.4.8 Events

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4475 | `event/onStart`: event reference MUST be set before `out` activates | Covered | `event/Event_Refs`. |
| 4477 | Multiple `event/onStart` nodes MUST activate in JSON order and MUST return the same reference | Covered | Reference in `event/Event_Refs`; order in `event/activation_order_and_onTick`. |
| 4494 | `event/onTick`: time values and reference MUST be set before `out` activates | Covered | First-tick time values in `event/activation_order_and_onTick`. |
| 4496 | First `event/onTick` activation MUST come after all `event/onStart` activations | Covered | "1st tick after onStart". |
| 4498 | First tick: `timeSinceStart` MUST be 0 and `timeSinceLastTick` MUST remain NaN | Covered | |
| 4500 | Multiple `event/onTick` nodes MUST activate in JSON order with identical outputs within a tick | Covered | Order and identical values within a tick. |
| 4581 | `event/receive`: invalid `event` index MUST cause rejection | Covered | `G8a`–`G8c`. |
| 4583 | `event/receive`: values not set by an external sender MUST be reset to defaults on each activation | None | Requires an external event source. |
| 4591 | Multiple `event/receive` nodes for the same event MUST activate in JSON order with identical outputs | Covered | `event/activation_order_and_onTick`. |
| 4626 | `event/send`: invalid `event` index MUST cause rejection | Covered | `G9a`–`G9d`. |

#### 1.4.9 Debug output

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4665 | `debug/log`: literal curly brackets in the template MUST be doubled | None | Templates with doubled brackets now appear, but log output is never checked. |
| 4671 | `debug/log`: invalid `severity` MUST fall back to default | None | Every `severity` in the suite is 0. |
| 4683 | `debug/log`: invalid `message` MUST fall back to default | Partial | `graph/ignored_configuration` asserts that `out` fires with an invalid message; the log text is not checked. |
| 4712 | `debug/log`: missing generated sockets MUST cause rejection | Covered | `H3`. |
| 4714 | `debug/log`: extra sockets MUST still have valid sources | None | |
| 4725 | `debug/log`: curly brackets in substituted values MUST be doubled | None | |

Log output is implementation-facing, so verifying it would need an oracle that captures log text. The requirements are still normative.

#### 1.4.10 Object model extensions

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4738 | `asset/majorVersion`/`minorVersion` MUST be the minimum of the asset version and the maximum supported version | Covered | Only the common case (asset 2.0) can be tested with a normal asset. |
| 4740 | Supported extensions in `extensionsUsed` MUST appear as `asset/extensions/<name>/enabled` | Covered | Includes unknown and declared-but-unused extensions. |
| 4774 | Runtime limit values MUST be at least 1 | Covered | |
| 4801 | Unavailable active camera data MUST be reported as NaN | None | No test reads any `activeCamera` pointer. |
| 4826 | Animation `minTime`/`maxTime` MUST come from sampler input accessor min/max, ignore unused samplers, and be NaN for invalid animations | Partial | `animation/state` covers min/max and an unused sampler. The NaN result for an invalid animation is not tested. |

#### 1.4.11 JSON syntax and validation

The array size limits remain impractical to test directly. Almost every other statement in this group is now covered by an invalid-graph case.

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4894 | `graphs` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 4898 | Empty JSON arrays MUST be omitted | Covered | `A1a`, `B3a`, `C7d`. |
| 4942 | `types` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 4958 | `signature` MUST be a defined type or `"custom"`; custom semantics MUST come from another extension | Covered | `B1a`, `B1b`; two custom types in `graph/json_syntax`. |
| 4962 | Duplicate non-custom signatures MUST cause rejection | Covered | `B2a`, `B2b`. |
| 4975 | `variables` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 4998 | Variable `type` is REQUIRED and MUST be a valid index | Covered | `C1`, `C8a`–`C8c`. |
| 5031 | Variable `value` length MUST match the type | Covered | `C2a`–`C2c`. |
| 5033 | `bool` variable value MUST be a JSON boolean | Covered | `C3a`, `C3b`. |
| 5035 | Float variable values MUST be JSON numbers | Covered | `C4a`–`C4c`. |
| 5037 | `int` variable value MUST be exactly representable as int32 | Covered | `C5a`, `C5b`. |
| 5039 | `ref` variable value MUST be a valid JSON Pointer string | Covered | `C6a`–`C6c`. |
| 5043 | Variable `name`, if present, MUST be a string | Covered | `C7c`. |
| 5050 | `events` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 5076 | Duplicate event ids MUST cause rejection | Covered | `D1`; an event without an id is accepted in `graph/json_syntax`. |
| 5080 | Event `values` MUST NOT contain an `event` property | Covered | `D2`. |
| 5082 | Event value `type` is REQUIRED and MUST be a valid index | Covered | `D3a`, `D3b`. |
| 5086 | Event `name`, if present, MUST be a string | Covered | `D5c`. |
| 5093 | `declarations` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 5108 | Declaration `op` is REQUIRED | Covered | `E1a`, `E1b`. |
| 5112 | Non-core operations MUST specify `extension` | Covered | `E2a`–`E2c`; valid case in `UserInteractions` and `graph/unsupported_operations_and_graphs`. |
| 5116 | Extension operations with inputs MUST define `inputValueSockets` | Partial | Invalid socket definitions are rejected (`E4a`, `E4c`, `E4d`); an extension operation with inputs but no `inputValueSockets` is not tested. |
| 5118 | Extension operations with outputs MUST define `outputValueSockets` | Partial | `E4b` covers an invalid output socket type; a missing `outputValueSockets` is not tested. |
| 5122 | Core operations MUST NOT define `inputValueSockets`/`outputValueSockets` | Covered | `E3a`, `E3b`. |
| 5149 | Declaration socket `type` is REQUIRED and MUST be a valid index | Covered | `E4a`–`E4c`. |
| 5151 | Duplicate declarations MUST cause rejection | Covered | `E5a`–`E5c`. |
| 5221 | `nodes` array MUST NOT exceed 2^31 elements | None (impractical) | |
| 5225 | Node `declaration` is REQUIRED and MUST be a valid index | Covered | `F1a`–`F1d`. |
| 5244 | `values` MUST contain every input socket id; extra properties MUST conform to schema | Covered | `F8a`–`F8c`, `F13a`, `F13b`; an extra input that has no effect in `graph/extra_and_unknown_sockets`. |
| 5248 | Missing value source or mismatched type MUST cause rejection | Covered | `F5`, `F8a`, `F9a`, `F9b`. |
| 5254 | Unsupported input types MUST cause rejection | Covered | `F9c`. |
| 5266 | Inline value `type` MUST be defined and valid | Covered | `F6a`, `F6b`, `F6d`. |
| 5294 | Defining both `node` and `value` MUST cause rejection | Covered | `F2`. |
| 5298 | `node` reference MUST be less than the current node index | Covered | `F3a`–`F3c`. |
| 5306 | `socket` MUST exist on the referenced node; MUST be given if no `value` socket exists | Covered | `F4a`–`F4c`. |
| 5310 | `type` given with `node` MUST match the referenced socket type | Covered | `F5`; the valid case is in `graph/extra_and_unknown_sockets`. |
| 5348 | Type-default sockets MUST define a valid `type` | Covered | `F6c`; a type-default float input asserted as NaN in `graph/extra_and_unknown_sockets`. |
| 5381 | Extra `flows` properties MUST still be validated | Covered | `F13c`. |
| 5383 | Flow `node` is REQUIRED | Covered | `F11a`. |
| 5387 | Flow `node` MUST be greater than the current index and less than the node count | Covered | `F10a`–`F10d`. |
| 5397 | Activating a flow connected to a non-existent input flow socket MUST have no effect | Covered | `graph/extra_and_unknown_sockets`. |

The invalid set also covers rules beyond this table, such as the extension object validation of `graphs` and the default `graph` index (`A1a`–`A4`) and the structural asserts of the Validation section.

### 1.5 Specification content without test coverage

This section covers behavior defined by the specification that is not tied to a single MUST statement: operation type signatures, procedural steps, configuration variants, and object model pointers.

#### 1.5.1 Untested type signatures

Each row lists the types an operation accepts that its dedicated test never uses. Harness usage (for example `math/sub` inside comparison logic) is not counted.

| Operation | Types accepted but untested |
| --- | --- |
| `math/abs` | `float2`, `float3`, `float4`, all matrices |
| `math/add` | `float2`, `float3`, `float4`, all matrices |
| `math/sub` | `float2`, `float3`, `float4`, all matrices |
| `math/mul` (component-wise) | `float2`, `float3`, `float4`, all matrices |
| `math/div` | `float2`, `float3`, `float4`, all matrices |
| `math/rem` | `float2`, `float3`, `float4`, all matrices |
| `math/min`, `math/max` | `float2`, `float3`, `float4`, all matrices |
| `math/clamp` | `float2`, `float3`, `float4`, all matrices |
| `math/sign` | `float2`, `float3`, `float4`, all matrices |
| `math/neg` | `float2x2`, `float3x3` (`int` is now tested) |
| `math/eq` | `float3`, `float4`, `float2x2`, `float3x3` |
| `math/ceil`, `floor`, `fract`, `round`, `trunc`, `saturate`, `mix` | `float2x2`, `float3x3` (only `float4x4` of the matrices is tested) |
| `math/deg` | `float4` |
| `math/dot`, `math/length`, `math/normalize` | scalar `float` (the `floatN` placeholder includes `float`; see edge cases below) |
| `math/transform` | `float2` with `float2x2`, `float3` with `float3x3` |
| `math/select` | every type except `float` (no `int`, `bool`, vectors, matrices, or `ref`) |
| `math/switch` | every type except `int` |
| `variable/interpolate` | `float2`, `float3`, `float4` without slerp, all matrices (`float` and `float4` with slerp are tested) |
| `pointer/interpolate` | `float`, `float2`, all matrices (`float3` translation and `float4` rotation are tested; `float4x4` appears only as an `err` case on a read-only pointer) |

For custom variables, `float2x2` and `float3x3` are still never declared, and `variable/set_and_get` does not cover `ref` or any matrix type. For custom events, only `float`, `int`, `bool`, and `ref` value types appear. `flow/cancelDelay` is now tested with null and already-fired references.

#### 1.5.2 Operation behavior described procedurally

These behaviors are defined in the operation procedures rather than as standalone MUST statements. Each paragraph says what is now covered and what is still missing.

**`flow/for`.** `endIndex` re-evaluation, `startIndex > endIndex`, and negative ranges are now covered. Loop ranges near `INT_MAX` are not.

**`flow/while`.** Covered for the basic case. A condition that changes inside the body, and the interaction between `while` and `setDelay` inside the body, are not tested.

**`flow/doN`.** `n = 0` and `n` changing at runtime are now covered. Negative `n` is not.

**`flow/multiGate`.** The `lastIndex` output (before activation, during, when exhausted, and after reset) and the no-loop exhaustion case are now covered. The configuration with both `isLoop` and `isRandom` true is not tested, and neither is the SHOULD-level reshuffling on each loop.

**`flow/waitAll`.** Repeated activation of the same input is now covered. `inputFlows: 0` and `inputFlows: 64` are not.

**`flow/throttle`.** Covered for durations of -1, NaN, +Infinity, and 0, and for `lastRemainingTime` before the first input and after reset.

**`flow/setDelay` / `flow/cancelDelay`.** The `cancel` input flow, concurrent delays from one node, ordering of concurrent delays, and cancellation of an already-fired delay are now covered. The `maxActiveDelays` limit leading to `err`, and a duration of 0, are not.

**`animation/start`.** Reverse playback, `startTime == endTime`, `endTime` of ±Infinity, requested times outside the animation range, restart, and starting from another animation's `done` are now covered. An animation with a maximum time of 0, and exceeding `maxActiveAnimations`, are not.

**`animation/stopAt`.** Covered: `stopAt` on an animation that is not playing, ±Infinity stop times, a stop time equal to, before, and beyond the end time.

**`pointer/get`.** Negative and out-of-range node indices are now covered (`pointer/set_edge_cases`). Reading a pointer whose type doesn't match `type` (which should return `isValid` false and NaN), and reading nodes outside the current scene, are not tested.

**`pointer/set`.** Covered: negative index, out-of-range index, type mismatch, read-only property, `weights` on a node without morph targets, an out-of-range value that is still written, and cancellation of an active interpolation. A null reference for a `{}` template parameter is not tested.

**`pointer/interpolate`.** The `err` path for `p1`/`p2` x components outside [0, 1] and non-finite control points, zero duration, re-triggering, read-only and mistyped pointers, and slerp on rotation are now covered. The `maxActivePropertyInterpolations` limit is not, and the 50% translation check still uses a tolerance of 0.1, which is too loose to verify the Bézier easing curve. Easing is verified for `variable/interpolate` only.

**`event/stopPropagation`.** Covered for internal events. Transitive propagation (for example through the scene graph) needs an event source that propagates, which none of the core operations provide.

**`math/matDecompose`.** The invalid-scale, zero-scale, and shear cases are covered. Matrices with a negative determinant (mirroring), where step 8 allows four alternative outputs, are not. A test for this case would need to accept any of the four permitted results.

#### 1.5.3 Object model pointers

| Pointer group | Status |
| --- | --- |
| `/extensions/KHR_interactivity/asset/*` | Covered, including an unused extension |
| `/extensions/KHR_interactivity/limits/*` | Covered (≥ 1 only) |
| `/extensions/KHR_interactivity/activeCamera/*` (10 pointers) | None |
| `/animations/{}/extensions/KHR_interactivity/isPlaying`, `minTime`, `maxTime`, `playhead`, `virtualPlayhead` | Covered in the `[]` form; the `{}` form is not tested |
| `/extensions/KHR_interactivity/delays/{}` | Covered (valid reference only) |
| `/extensions/KHR_interactivity/events/{}` | Covered |
| `/nodes/*/rotation` via pointer operations | Covered (`pointer/get` and `pointer/interpolate`) |
| `/nodes/*/globalMatrix`, `/nodes/*/matrix` | Covered (`Extras/Matrix_Updates`) |

### 1.6 Edge and corner cases needing specialized test assets

These are cases where a generic test would not catch a non-conforming implementation. Items now covered by the existing suite are listed as such so the remaining work is clear.

#### 1.6.1 Graph rejection and configuration fallback

_Note: this version of the generator excludes rejection tests (Section 1.1). The rejection items below are listed for completeness; they are covered by the existing `invalid/` set or remain for that set to cover. Only the configuration-fallback items (7 and 8) are in scope for the generator._

The suite now has a rejection category. `invalid/` holds 179 cases with an `expectedOutcome` of `rejectGraph` or `rejectExtension`, and `graph/` holds valid graphs that look suspicious. The priority cases from the previous report are covered as follows:

1. Forward, backward, self, and out-of-range references: covered (`F3a`–`F3c`, `F10a`–`F10d`, `F13b`, `F13c`).
2. Missing and mistyped `values`: covered (`F5`, `F8a`–`F8c`, `F9a`–`F9c`).
3. Duplicate declarations and core operations with socket definitions: covered (`E3a`, `E3b`, `E5a`–`E5c`).
4. `variable/set` and `variable/interpolate` misuse: covered (`G2*`, `G3*`), except an empty `variables` array.
5. `pointer/set` with `{value}` in the template: covered (`G6a`, `G6b`).
6. The specification's invalid pointer template examples: covered (`G5-01`–`G5-22`).
7. Configuration fallback: `flow/waitAll` with `inputFlows: 65` and `flow/multiGate` with a non-boolean `isRandom` are covered. Still missing: `flow/for` with `initialIndex: 1.5`, `math/quatFromAngles` with an invalid `order`, `flow/multiGate` with a missing property, and `debug/log` with an invalid `severity`.
8. Switch case encodings: `[0.5, 1]`, `[-2147483649, 0]` (flow only), and duplicates are covered. Still missing: `[-1.0, 0, 1]`, `[0.1e1, 2, 2]`, and `[-2147483649, 0]` for `math/switch`.

Rejection cases still missing: graphs that exceed static limits (generated socket and flow counts), type-equality violations for `math/select`, `math/dot`, and `math/matMul`, and `pointer/set` with an invalid `type`.

#### 1.6.2 Precision and negative zero

`Extras/Float_Precision` now covers the core of this item: `16777217 - 16777216`, `(2^53-1) - (2^53-2)`, `0.1 + 0.2`, the largest and smallest finite literals, `round(0.49999999999999994)`, `intToFloat` at the int32 limits, and the sign of zero for `neg(0)`, `min(0, -0)`, `max(-0, 0)`, `round(-0.3)`, `abs(-0)`, `intToFloat(0)`, and a literal `-0.0`.

Still missing:

- Negative zero for `math/sign(-0.0)`, `math/trunc(-0.5)`, `math/ceil(-0.5)`, `math/mul`, and `math/fract`.
- Double-precision checks for transcendental functions; their tests still use single-precision expected values with tolerances.
- Exact comparison anywhere outside `Extras/Float_Precision`.

#### 1.6.3 Integer boundaries

Now covered: `math/neg(-2147483648)`, `math/abs(-2147483648)`, `math/mul` overflow, and `type/floatToInt` with ±Infinity, -0, values at and beyond `INT_MAX`, and large values (wrapping per the specification).

Still missing:

- `math/div(-7, 2) = -3` and `math/rem(-7, 2) = -1` for `int`. Only the float `rem(-7, 3)` is tested.
- `math/rem(-2147483648, -1)`.
- `math/clamp` with `b == c`.

#### 1.6.4 Scalar forms of vector operations

Unchanged. Because `floatN` includes `float`, `math/length(-3.0)` should return 3, `math/normalize(-3.0)` should return -1 with `isValid` true, `math/normalize(0.0)` should be invalid, and `math/dot(2.0, 3.0)` should return 6. None is tested.

#### 1.6.5 Special values in untested operations

Now covered: `math/exp` at ±Infinity, `math/fract(Infinity)`, `math/isInf` with NaN and finite input, `math/isNaN(Infinity)`, `math/min`/`max` with NaN, NaN comparisons for `lt`, `le`, `gt`, `ge`, `eq`, four of the `math/pow` special cases, `math/round` and `math/sqrt` at Infinity, `Infinity - Infinity`, `0 × Infinity`, `math/rem` with Infinity, and NaN for `math/clamp` and `math/saturate`.

Still missing:

- `math/sin`, `cos`: ±Infinity (NaN expected).
- `math/sinh`, `cosh`, `tanh`, `asinh`: ±0, ±Infinity, NaN.
- `math/log2`, `log10`: 0, negative, +Infinity.
- `math/cbrt`: ±0, ±Infinity.
- `math/pow`: the remaining cases in the specification's list of changes from IEEE-754 `pow`.
- `math/floor`, `ceil`: ±Infinity and NaN.
- `math/quatSlerp` and `math/slerp`: antipodal and nearly identical inputs.
- `math/quatFromAxisAngle`: zero-length axis.
- `math/rotate2D`: angles outside [-2π, 2π].
- `math/matCompose`: non-unit rotation quaternion.
- `math/rgbToOkLCh` / `rgbFromOkLCh`: out-of-gamut input and hue wrap-around.

#### 1.6.6 Ordering and timing

Now covered in `event/activation_order_and_onTick`: `onStart` order, `receive` order, first-tick values, first tick after all `onStart` handlers, `onTick` order, and identical values within a tick.

Still missing: a `setDelay` with a duration of 0, asserting that `done` never fires before `out`.

#### 1.6.7 Animations and pointers together

All four cases from the previous report are now covered: reading an animated property with `pointer/get` during playback, restart without the first `done`, no autoplay before `animation/start`, and slerp for `pointer/interpolate` on rotation.

#### 1.6.8 Pointer template syntax

All invalid examples from the specification are rejection cases (`G5-01`–`G5-22`), and a doubled-bracket template is checked in `graph/json_syntax`. The valid `~0` and `~1` encoding examples, and a parameter used only once, still need assets.

### 1.7 Test suite issues that affect coverage

These are properties of the current assets that limit what they can verify, independent of which requirements they target.

**Rejection mechanism (resolved).** The `invalid/` set and its README define how a runner checks rejection: each case sends `test/onFailed` if it runs, so the case passes when that event never arrives. An implementation without `KHR_interactivity` support passes every invalid case trivially, so the README requires running the regular tests too.

**Float inputs are single precision.** Outside `Extras/Float_Precision`, inline values such as `345.234436` and expected values such as `62.9999962` are still float32 values printed as decimals. Combined with tolerance-based comparison, this means double precision is verified only for the operations in that one asset.

**Wide tolerances.** Most comparisons use `abs(actual - expected) < tolerance`, with tolerances from 0.0001 to 0.4. Animation checks still use 0.3–0.4, and some interpolation midpoint checks still use 0.1. These confirm that something happened but cannot distinguish easing curves or detect small timing drift.

**Engine-specific expected values.** `UnityGLTF.Interactivity.StaticRefPointer` still appears as an expected value in four description files (`event/Event_Refs`, `pointer/CoreReadOnlyPointers_GetTests`, `UserInteractions/eventOnHover`, `UserInteractions/eventOnSelect`). These are generator artifacts and are not meaningful to other implementations.

**Sub-test labels round their inputs.** Labels such as `[a] 757.00 = 758.00` (`math/ceil`, actual input `757.003`) and `[a] 1.10 = 63.00` (`math/deg`, expected `62.9999962`) still appear wrong to a reviewer.

**Ambiguous sub-test labels.** Several labels state the opposite of the expected value, because the result variable records a failure or a negated condition:

- `event/Event_Refs`: "ref not null" expects `False`, and "onTickt wo nodes" is still misspelled.
- `event/activation_order_and_onTick`: "receive: all get the sent value", "onTick: same values in a tick", and "timeSinceStart non-decreasing" all expect `False`.
- `Extras/Float_Precision`: "0.1 + 0.2 != 0.3", "literal 1.79e308 is finite", and "1e30 * 1e30 is finite" expect `False`.

The results are probably correct, but each label needs reading against the graph to confirm.

**Locale leakage.** Log messages still use a comma as the decimal separator ("Proximity range: 0,0001"), including in the new assets. This only affects log text, not results.

**Out-of-scope operations.** `UserInteractions/eventOnHover` and `eventOnSelect` test `KHR_node_hoverability` and `KHR_node_selectability` operations. `graph/unsupported_operations_and_graphs` declares `test/*` operations on purpose, to check how unsupported extension operations are handled. Neither counts toward core operation coverage.

### 1.8 Specification text issues

All four text issues listed in the previous report were fixed in `c5d1e1e8` ("KHR_interactivity: Fix typos"): `<EXTENSION_MANE>` at line 4761, the mismatched emphasis at line 5244, "less then" at line 5387, and "if it point to" at line 4203.

One open issue comes from the new invalid set. The suite README reports 38 cases (`schemaAssert: true`) where the normative text requires only rejecting the graph, while the Validation section requires rejecting the whole extension. The suite expects extension rejection for these, and either outcome stops the graph from running. The specification should state which one applies.

### 1.9 Asset count estimate

The estimate below assumes full coverage of every in-scope gap that remains at revision `9ffd30e`, configuration-fallback tests included, and the sampling approach made normative in Section 8. Rejection cases are excluded (Section 1.1).

| Area | Assets | Sub-tests | What drives the count |
| --- | --- | --- | --- |
| Math operations (101 op ids) | ~105 | ~1,700 | Each supported type × sampled values; vector and matrix types for component-wise operations are still almost entirely untested |
| Type conversion | 4 | ~25 | Remaining boundary values; the int32 limits, ±0, ±Inf and NaN are now partly covered by `Extras/Float_Precision` |
| Reference equality | 1 | ~8 | Same index with different object type; references from pointers and events |
| Flow control | ~8 | ~45 | `for`/`doN` near the int32 limits, negative `n`, `waitAll` 0 and 64, `setDelay` 0 and limits, `while` with a changing condition |
| Variables | 3 | ~45 | Type defaults, matrix and `ref` variables, interpolation of `float2`, `float3`, `float4` without slerp and matrices |
| Pointers and object model | ~8 | ~80 | `activeCamera`, `{}` forms of animation state, `pointer/get` type mismatch, nodes outside the scene, valid template syntax, interpolation of the remaining types |
| Animation | ~2 | ~6 | Maximum time of 0, `maxActiveAnimations` |
| Events | ~3 | ~20 | `event/send` and `event/receive` for vector, matrix and remaining types |
| Debug log | 1–2 | ~12 | Graph runs correctly with templated messages; checking the log text itself needs the runner to capture it |
| Concepts and precision | ~4 | ~35 | Precision and negative zero for the operations not in `Extras/Float_Precision`, socket value retention |
| Configuration fallback | ~6 | ~30 | `flow/for`, `math/quatFromAngles`, `flow/multiGate`, `flow/waitAll` and `debug/log` cases still missing |
| **Total** | **~145** | **~1,950** | |

The figures carry an uncertainty of roughly ±30%, almost all of it in the math operations, where sampling density drives the count. Packing several sample values into the components of one vector or matrix sub-test is what keeps the math total near 1,700 rather than 5,000.

Some tests must run in an asset of their own because they depend on graph-wide state: anything that exhausts a `maxActive*` limit, and timing checks that other activity would disturb. Pointer tests also need several base scenes (lights, material extensions, cameras, skins, morph targets, and animations). These account for the asset count being above one per operation.

Compared with the original review, the existing suite now covers most of the ordering, timing, animation, interpolation and configuration-fallback targets, so those areas shrink sharply. The math operations shrink little, because the new tests add special values for scalar inputs but not the missing vector and matrix types. Because the generator supplements the existing suite rather than replacing it (Section 4.3), targets already covered by existing sub-tests are not generated again. The supplemental output is expected to be in the range of 130–150 assets and 1,300–1,600 sub-tests. The generator's coverage report (Section 13) gives the actual figures.

### 1.10 Changes since the original review

Draft 0.1 of this document was based on suite revision `0f24a49`. The table compares the two reviews.

| Area | Revision `0f24a49` | Revision `9ffd30e` |
| --- | --- | --- |
| Test assets / sub-tests | 149 / 831 | 159 / 1,073 |
| Invalid-graph cases | 0 | 179 |
| Statements covered / partial / none | 14 / 18 / 96 | 83 / 17 / 28 |

New assets: `animation/start_playback_modes`, `animation/state`, `animation/stop_and_stopAt_edge_cases`, `event/activation_order_and_onTick`, `graph/extra_and_unknown_sockets`, `graph/ignored_configuration`, `graph/json_syntax`, `graph/unsupported_operations_and_graphs`, `pointer/set_edge_cases`, and `Extras/Float_Precision`.

Extended assets, by number of sub-tests added: `pointer/interpolate` (+14), `variable/interpolate` (+14), `flow/setDelay_and_cancelDelay` (+8), `flow/for` (+6), `flow/multiGate` (+6), `math/round` (+6), `variable/set_and_get` (+6), `flow/throttle` (+5), `math/smoothStep` (+5), `flow/waitAll` (+4), `math/pow` (+4), and 24 others with one to three each.

Other changes on the branch: the specification-conformance fixes to existing JSON (variable `id` renamed to `name`, node order), NaN and Infinity no longer written as strings in float values, braces escaped in `debug/log` messages, `mathtests-index.json` moved to `Tests/Interactivity/`, and the `Overview` and `mathtests` aggregates changed to sequence-based execution.

---

## 2. Document Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 (RFC 2119 and RFC 8174) when, and only when, they appear in bold capitals.

Section 1, the notes marked _Informative_, and Appendix A are non-normative. All other sections are normative.

"The Specification" means the `KHR_interactivity` `Specification.adoc` at the revision named in the header table. "Spec line _N_" refers to line _N_ of that file at that revision. Where the generator records references (Section 7.4), it records the section title as well, because line numbers change between revisions.

"The existing suite" means the contents of `Tests/Interactivity` in `glTF-Test-Assets-Interactivity` at the revision named in the header table, or at a later revision supplied to the generator as input. It includes the runnable test assets, the aggregate assets, and the invalid-graph cases under `invalid/`.

## 3. Terms

**Generator.** The software specified by this document.

**Asset.** One test case as the existing suite defines it: a directory containing a binary glTF file, an oracle file, and a description file.

**Supplemental asset.** An asset produced by the generator.

**Sub-test.** One assertion within an asset, with its own result variable and pass/fail variable.

**Oracle file.** The machine-readable JSON file that lists an asset's sub-tests and expected results (`test-Json/<name>.json`).

**Description file.** The human-readable Markdown file for an asset (`<name>.md`).

**Harness.** The part of an asset's behavior graph that starts sub-tests, compares results with expected values, records pass/fail, and reports completion.

**Operation under test.** The operation whose behavior a sub-test asserts. Harness operations used to check the result are not operations under test.

**Target.** A unit of required coverage: a normative statement, an operation type signature, a procedural behavior, an Object Model pointer, or an edge case. Section 10.1 defines target identifiers.

**Gap.** A target not covered by any sub-test in the existing suite.

**Value class.** A named group of input values with shared significance, such as zeros or integer boundaries (Section 8).

**Sample set.** The concrete values the generator draws from a value class.

**Comparison mode.** The rule used to decide whether an actual result matches the expected result (Section 7.3).

## 4. Scope

### 4.1 In scope

The generator **MUST** produce sub-tests for every gap in the following, except those excluded by Section 4.2:

1. Every normative statement listed in Section 1.4 with status None or Partial. For a Partial statement, only the parts the Notes column describes as missing are gaps.
2. Every untested type signature in Section 1.5.1.
3. Every procedural behavior and Object Model pointer group listed as uncovered in Sections 1.5.2 and 1.5.3.
4. Every edge case in Section 1.6, except rejection cases.
5. The coverage requirements in Section 10, which make items 1–4 concrete and add requirements for consistency.

Several statements in Section 1.4.11 have a runnable part as well as a rejection part. The runnable parts are in scope. They are:

- extra `values` properties having no effect (spec line 5244),
- the implicit `value` socket id when `socket` is omitted (spec line 5306),
- type-default input values (spec line 5348),
- extension operation declarations with `inputValueSockets` and `outputValueSockets` (spec lines 5112–5118), and
- flows connected to a non-existent input flow socket having no effect (spec line 5397).

### 4.2 Out of scope

The generator **MUST NOT** produce:

- assets that are expected to be rejected by a conforming implementation;
- sub-tests whose only observable outcome depends on graph rejection;
- assets that enumerate a range of more than 64 values, indices, or iterations for a single check (Section 8.1).

The following are out of scope for assertion. The generator **MAY** produce assets that exercise them, as described in the referenced sections:

- array length limits of 2^31 elements (spec lines 4894–5221), which are not exercised at all;
- implementation-specific static and dynamic limits, except through conditional sub-tests (Section 10.12);
- the text produced by `debug/log` (Section 10.10);
- events that originate from an external environment (spec line 4583);
- operations defined by other extensions, such as `KHR_node_hoverability` and `KHR_node_selectability`.

### 4.3 Relationship to the existing suite

The generator supplements the existing suite.

- The generator **MUST NOT** modify, delete, or regenerate any file in the existing suite, including its index files and aggregate assets (`Overview.glb`, `mathtests.glb`).
- The generator **MUST** read the existing suite (Section 11) and **MUST NOT** emit a sub-test for a target that an existing sub-test already covers.
- Supplemental assets **MUST** use directory and file names that do not collide with any existing name (Section 6.2).
- Supplemental assets **MUST** follow the existing asset layout and harness conventions closely enough that a runner written for the existing suite can run them without modification (Sections 6 and 7).

## 5. Generator Requirements

### 5.1 Implementation language

The generator **MAY** be implemented in any language.

_Informative:_ Requirements that affect cross-implementation agreement, such as the pseudo-random number generator (Section 8.10) and number formatting (Section 5.4), are specified precisely so that two generators written in different languages produce identical output.

### 5.2 Inputs

The generator **MUST** accept the following inputs:

| Input | Description |
| --- | --- |
| Specification revision | A path to, or commit identifier of, `Specification.adoc`. Recorded in every asset (Section 7.1). |
| Existing suite path | The `Tests/Interactivity` directory used for gap determination (Section 11). |
| Target registry | The target data described in Section 10.1. |
| Output path | Root directory for supplemental assets. |
| Seed | A 64-bit unsigned integer for the pseudo-random number generator. The default **MUST** be `0x4B48525F494E5445` (the ASCII bytes of `KHR_INTE`). |
| Copyright owner and year | Used in asset metadata (Section 14). |
| Limits | Asset size limits (Section 7.7), timing limits (Section 7.9), and default tolerances (Section 9.3). Defaults **MUST** be the values stated in this document. |

The generator **MUST NOT** require network access while generating assets.

### 5.3 Determinism

Given identical inputs, the generator **MUST** produce byte-identical output, including assets, oracle files, description files, index files, and reports. Iteration over unordered collections **MUST** use a documented order. Timestamps **MUST NOT** appear in generated files, except the copyright year taken from the inputs.

### 5.4 Arithmetic and number formatting

- All floating-point values, both inputs and expected results, **MUST** be computed and stored as IEEE-754 binary64. The generator **MUST NOT** round any value through binary32.
- Integer computations **MUST** follow the Specification's 32-bit two's complement semantics, including wraparound where the Specification requires it.
- Finite numbers written to JSON **MUST** use the shortest decimal representation that parses back to the identical binary64 value, with `.` as the decimal separator regardless of the system locale.
- Integer-valued floats **MUST** be written in a form that JSON parsers read as a number with the same binary64 value, for example `16777217` or `16777217.0`.

### 5.5 Errors

The generator **MUST** stop with a non-zero exit status and write no partial output if it cannot satisfy a **MUST** requirement of this document, including a name collision with the existing suite, a target it cannot generate, or a failed self-check (Section 12).

## 6. Output Layout

### 6.1 Directory structure

Supplemental assets **MUST** be written under the output path using the existing structure:

```
<output>/
├── supplemental-index.json
├── supplemental-coverage.json
├── supplemental-coverage.md
└── <category>/
    └── <asset-name>/
        ├── <asset-name>.md
        ├── glTF-Binary/
        │   └── <asset-name>.glb
        └── test-Json/
            └── <asset-name>.json
```

`<category>` **MUST** be the operation category of the operation under test (`math`, `type`, `ref`, `flow`, `variable`, `pointer`, `animation`, `event`, `debug`), or one of `concepts`, `config`, or `prerequisites` for assets that are not about a single operation category.

_Informative:_ Writing directly into the existing repository's `Tests/Interactivity` directory is permitted by this layout, because Section 6.2 prevents collisions and Section 4.3 prevents modification of existing files.

### 6.2 Asset names

An asset name **MUST** have the form `<subject>-<facet>` or `<subject>-<facet>-part<N>`, where:

- `<subject>` is the operation name without its category (for example `abs`, `setDelay`) or a topic name from the target registry (for example `socketRetention`);
- `<facet>` is one of: `types`, `special`, `boundary`, `precision`, `negzero`, `config`, `order`, `timing`, `syntax`, `errors`, `state`, `scalar`, `objectModel`;
- `part<N>` is used only when an asset is split under Section 7.7, with `N` starting at 1.

The generator **MUST** check every name against the existing suite and against its own output, and **MUST** fail (Section 5.5) on any collision.

### 6.3 Index file

The generator **MUST** write `supplemental-index.json` using the entry format of the existing `test-index.json` (`label`, `name`, `tags`, `variants`). `tags` **MUST** list every operation declared in the asset. Entries **MUST** be sorted by `name`.

The generator **MUST NOT** add entries to the existing index files. _Informative:_ Merging the supplemental index into the existing indexes is a decision for the repository maintainers (Appendix A).

## 7. Asset Requirements

### 7.1 glTF content

Each supplemental asset **MUST**:

- be a binary glTF 2.0 file (`.glb`) that passes the Khronos glTF Validator with no errors;
- validate against the `KHR_interactivity` JSON schemas at the Specification revision in use;
- list `KHR_interactivity` in `extensionsUsed`, together with every other extension the asset uses;
- contain exactly one behavior graph;
- set `asset.generator` to a string that identifies the generator name and version and the Specification revision;
- set `asset.copyright` as defined in Section 14.

Each asset **SHOULD** include the visual pass/fail indicator grid used by the existing suite, where each sub-test's indicator changes color on pass or fail. Where scene content is part of what a sub-test asserts (for example `/nodes.length`), expected values **MUST** be computed from the final asset content, including indicator nodes.

Inline values in the behavior graph **MUST** be written as described in Section 5.4.

### 7.2 Harness

Each asset **MUST** implement the harness conventions of the existing suite:

1. Each sub-test has a result variable named `TestResult_<asset>_<sub-test>` holding the actual result, and a `bool` variable named `TestResult_HasPassed_<asset>_<sub-test>` initialized to `false`. All variable names within an asset **MUST** be unique.
2. Sub-tests are started from `event/onStart`. The failure of one sub-test **MUST NOT** prevent any other sub-test from running or reporting.
3. At startup, the graph sends the custom event `test/onStart` with an `expectedDuration` value (in seconds). `expectedDuration` **MUST** be an upper bound on the time the runner needs to tick the graph before all results are final. If any result is not final when the `event/onStart` sequence ends, the graph **SHOULD** also contain a `flow/setDelay` node whose `duration` is an inline value no less than `expectedDuration`.

_Informative:_ The sample-asset harness of the Khronos authoring tool (`glTF-InteractivityGraph-AuthoringTool`, `tst/assets/`) does not read `expectedDuration`. It waits for the largest inline `duration` of the `flow/setDelay`, `flow/throttle`, `variable/interpolate` and `pointer/interpolate` nodes, plus 0.35 s, up to 6 s. The `flow/setDelay` rule above keeps supplemental assets runnable there. A request to read `expectedDuration` instead has been raised with the tool maintainers ([AuthoringTool #128](https://github.com/KhronosGroup/glTF-InteractivityGraph-AuthoringTool/issues/128)); once it is resolved, the rule and the 5.5 s limit in Section 7.9 can be relaxed.
4. When all sub-tests have finished, the graph sends exactly one of `test/onSuccess` (all passed) or `test/onFailed` (any failed).

**Harness operation set.** The harness **MUST** use only the following operations, except for operations that set up a sub-test's inputs: `event/onStart`, `event/onTick`, `event/send`, `flow/sequence`, `flow/branch`, `flow/setDelay`, `variable/get`, `variable/set`, `math/eq`, `math/and`, `math/not`, `math/lt`, `math/le`, `math/abs`, `math/sub`, `math/mul`, `math/max`, `math/div`, `math/neg`, `math/isNaN`, `math/Inf`, `math/NaN`, and `pointer/set` (for indicators only).

_Informative:_ This set has no component-extraction operation, so a graph cannot compare vector or matrix results component by component as Section 7.3 requires. The existing suite's own harness already uses `math/extract3` for this in the assets added at revision `9ffd30e` (for example `animation/state` and `pointer/set_edge_cases`). Adding `math/extract2`, `math/extract3`, `math/extract4` and the matrix extraction operations to this set is an open issue (Appendix A, item 8).

**Prerequisites.** The existing `prerequisites/Tests_required_operations` asset verifies part of the harness set. The generator **MUST** produce a supplemental prerequisites asset that verifies every harness operation and type combination the supplemental assets rely on and the existing asset does not verify. At minimum this includes `math/isNaN`, `math/div` producing ±Infinity from ±0 divisors, `math/neg` producing −0 from +0, `math/le`, `math/max`, and `math/not`.

**Operations under test that are also harness operations.** When the operation under test is in the harness set, a sub-test **MUST NOT** use that operation, on the same input types, to verify its own result. For example, a `math/eq` sub-test stores the `bool` result and verifies it with `flow/branch`, and a `flow/branch` sub-test verifies which output flow fired by having each flow set a distinct variable.

### 7.3 Comparison modes

Every sub-test **MUST** use one of the following comparison modes, and the harness **MUST** implement it in the graph:

| Mode | Rule |
| --- | --- |
| `exact` | `int` and `bool`: equal. `float`: equal as binary64 values, with −0 and +0 distinguished; any NaN matches an expected NaN. |
| `relative` | Passes if the absolute difference is at most `max(r × |expected|, a)`, with `r` and `a` recorded in the oracle file. |
| `absolute` | Passes if the absolute difference is at most `a`. Used only for timing-dependent values (Section 7.9). |
| `set` | Passes if the result matches any member of a listed set of expected values, each compared with a stated inner mode. |
| `property` | Passes if a stated relationship holds, computed in the graph, for example that composing a decomposed matrix reproduces the input within a relative tolerance. |

Additional rules:

- Where an expected component is NaN, ±Infinity, or ±0, that component **MUST** be compared in `exact` mode regardless of the sub-test's mode.
- Negative and positive zero **MUST** be distinguished by dividing 1 by the value with `math/div` and comparing the result with −Infinity or +Infinity.
- Vector and matrix results are compared component by component. The sub-test passes only if every component passes.
- A sub-test that asserts a Specification requirement of exact behavior **MUST** use `exact` mode. This includes integer arithmetic, bitwise operations, comparisons, rounding operations, conversions, swizzles, `select`, `switch`, flow outputs, and results defined as special values.

### 7.4 Oracle file

The oracle file **MUST** use the existing schema (`glbFileName`, `name`, `tests`, `usedSchemas`, and for each sub-test `name`, `resultVarName`, `resultVarId`, `resultVarType`, `expectedResultValue`, `successResultVarId`, `successResultVarName`). Existing runners **MUST** be able to read it without changes. Each test **MUST** list its `entryPoints`, and entry points **MUST NOT** set `requiresUserInteraction`, because the authoring tool's harness skips every sub-test of a test with an interaction entry point.

Special values in `expectedResultValue` **MUST** be written as the strings `"NaN"`, `"Infinity"`, and `"-Infinity"`, as in the existing suite. Negative zero **MUST** be written as the string `"-0"`. _Informative:_ Existing runners do not know the `"-0"` string; see Appendix A.

The oracle file **MUST** also contain the following additional properties, which existing runners ignore:

| Property | Level | Content |
| --- | --- | --- |
| `supplemental` | file | `true` |
| `generator` | file | Generator name, version, Specification revision, and seed |
| `comparison` | sub-test | Mode and parameters (Section 7.3) |
| `targets` | sub-test | Target identifiers the sub-test covers (Section 10.1) |
| `specRefs` | sub-test | For each target: Specification revision, line number, and section title |
| `valueClasses` | sub-test | Value classes of the inputs (Section 8) |
| `inputs` | sub-test | Exact input values and types, written as in Section 5.4 |
| `reviewRequired` | sub-test | `true` if the expected value depends on an interpretation listed in the coverage report (Section 9.5); omitted otherwise |
| `conditional` | sub-test | For conditional sub-tests (Section 10.12): the name and id of a `bool` variable that is true if the sub-test was skipped |
| `requiredRunnerCapabilities` | file | Capabilities beyond the standard runner, such as `logCapture`; omitted if none |
| `expectedLogOutput` | sub-test | Expected `debug/log` text, for runners with `logCapture` |

### 7.5 Description file

The description file **MUST** follow the existing format (a sub-test table followed by the list of operations used) and **MUST** add a column with the Specification references for each sub-test.

Values in sub-test names and description tables **MUST** be written exactly as in Section 5.4, without rounding. Descriptions **MUST NOT** contain engine- or implementation-specific type names. Where an expected value is a reference, the description **MUST** state what the reference points to (for example "node 3") rather than a type name.

### 7.6 Sub-test names

Sub-test names **MUST** be unique within an asset and **MUST** be derived deterministically from the operation under test, the input types, and the input values or scenario. A name **MUST** state what is expected, not the opposite. For example, a sub-test that expects a reference to be null is named "... is null", not "... not null".

### 7.7 Asset size

An asset **SHOULD NOT** contain more than 100 sub-tests or more than 2,000 behavior graph nodes. The generator **MUST** split an asset that would exceed either limit into parts named as in Section 6.2. Both limits **MUST** be configurable.

No configuration-derived socket list (for example `switch` cases, `sequence` outputs, `multiGate` outputs) **SHALL** exceed 64 entries.

### 7.8 Isolation

The following **MUST** be placed in an asset that contains no other sub-tests:

- tests of the first `event/onTick` activation and of `onStart`/`onTick` ordering;
- tests of `event/onStart` activation order;
- the animation autoplay test (spec line 184);
- conditional tests that exhaust a `maxActive*` limit;
- tests whose expected values depend on scene contents that other sub-tests would change.

Timing-dependent sub-tests (Section 7.9) **MUST NOT** share an asset with sub-tests that perform more than 100 node activations in a single tick.

### 7.9 Timing

- A timing-dependent sub-test **MUST** measure elapsed time using `event/onTick` time values or the Specification's own timing semantics. It **MUST NOT** assume a frame rate.
- The default tolerance for `absolute` comparisons on time values **MUST** be 0.05 seconds, and for positions derived from animation or interpolation at a given time **MUST** be the change in the value over 0.05 seconds, computed by the generator from the known curve.
- The `expectedDuration` of any asset **SHOULD NOT** exceed 5.5 seconds, and **MUST NOT** exceed 10 seconds. The lower bound keeps assets within the authoring tool harness's default wait limit of 6 seconds (Section 7.2).

_Informative:_ The existing suite uses tolerances of up to 0.4 for animation positions and 0.1 for interpolation midpoints. These are too loose to distinguish easing curves (Section 1.7). A tolerance defined in time rather than value keeps the check meaningful for any curve.

## 8. Value Sampling

### 8.1 General rule

For any input whose domain has more than 64 values, the generator **MUST** use sampled values rather than enumerating the domain. No single sub-test **SHALL** iterate, loop, or index more than 64 times. Loop and repetition tests **MUST** place short ranges at the boundaries of the domain instead of covering the full range (for example, `startIndex` = 2147483644, `endIndex` = 2147483647).

Each sampled domain **MUST** include every boundary value in its value classes, plus scattered values drawn with the generator's pseudo-random number generator (Section 8.10) to cover the interior.

### 8.2 Float value classes

| Class | Values |
| --- | --- |
| `zero` | +0, −0 |
| `subnormal` | ±4.9406564584124654e-324 (smallest), ±2.2250738585072009e-308 (largest) |
| `minNormal` | ±2.2250738585072014e-308 |
| `unit` | ±0.5, ±1, ±2 |
| `halfway` | ±0.49999999999999994, ±1.5, ±2.5, ±0.5 |
| `intBoundary` | ±(2^24 − 1), ±2^24, ±(2^24 + 1), ±(2^31 − 1), ±2^31, ±(2^31 + 1), ±2^32, ±(2^53 − 1), ±2^53, ±(2^53 + 2) |
| `decade` | ±10^k for k ∈ {−300, −100, −30, −10, −3, 3, 10, 30, 100, 300} |
| `max` | ±1.7976931348623157e308 |
| `infinity` | +Infinity, −Infinity |
| `nan` | NaN |
| `scatter` | Pseudo-random finite binary64 values (Section 8.10) |

NaN and ±Infinity **MUST** be produced in the graph with `math/NaN`, `math/Inf`, and `math/neg`, because JSON cannot represent them. Negative zero **MUST** be produced with `math/neg` applied to +0. The generator **MAY** additionally produce a sub-test that supplies −0 as a JSON literal; such a sub-test **MUST** be tagged with the value class `literalNegZero`, since it also tests the implementation's JSON parser.

### 8.3 Domain-specific values

In addition to Section 8.2, the generator **MUST** include the domain values that apply to each operation:

| Operations | Additional values |
| --- | --- |
| `asin`, `acos` | ±1, the next representable values beyond ±1 |
| `acosh` | 1, the largest value below 1 |
| `atanh` | ±1, the next representable values beyond ±1 |
| `log`, `log2`, `log10` | 1, the smallest subnormal, negative values |
| `sqrt`, `cbrt` | −0, negative subnormal |
| `exp` | Values either side of the overflow threshold (about 709.7827) and of the point where the result underflows to zero (about −745.1332) |
| `sinh`, `cosh` | Values either side of the overflow threshold (about ±710.4759) |
| `sin`, `cos`, `tan` | Multiples of π/2 up to 2^20 · π, and 1e22 (argument reduction) |
| `atan2` | Every combination of ±0 and ±Infinity with each other and with ±1 |
| `pow` | Every case in the Specification's `pow` definition, including its stated differences from IEEE-754 |
| `round`, `trunc`, `floor`, `ceil`, `fract` | Values one representable step either side of each integer in `halfway` and `intBoundary` |
| `deg` | Values whose conversion overflows to Infinity |

### 8.4 Integer value classes

| Class | Values |
| --- | --- |
| `zero` | 0 |
| `unit` | 1, −1, 2, −2 |
| `byte` | 127, 128, 255, 256, −128, −129 |
| `halfWord` | 32767, 32768, 65535, 65536, −32768, −32769 |
| `float32Exact` | 16777215, 16777216, 16777217, −16777216, −16777217 |
| `high` | 1073741823, 1073741824, −1073741824 |
| `limit` | 2147483646, 2147483647, −2147483647, −2147483648 |
| `scatter` | At least four pseudo-random int32 values per operation |

For shift operations, the shift count **MUST** include 0, 1, 15, 16, 30, 31, 32, 33, 63, −1, −2147483648, and 2147483647.

### 8.5 Values outside the int32 range

Where an input is a float that is converted to, or checked for representability as, a 32-bit integer (`type/floatToInt`, integer configuration properties, `switch` cases), the generator **MUST** include ±2^31, 2^31 − 1, −2^31 − 1, ±2^32, ±2^53, 0.5, −0.5, 1.5, and 1e300. Values that must be JSON literals (configuration properties) are limited to finite numbers.

### 8.6 Booleans

Every combination of boolean inputs **MUST** be tested.

### 8.7 Combining inputs

For operations with more than one input, the generator **MUST** produce:

1. every special-case combination defined in the operation's definition table in the Specification;
2. for each input position, every sampled value at least once, paired with ordinary values in the other positions;
3. for integer binary operations, at least the pairs (−2147483648, −1), (2147483647, 1), (−2147483648, −2147483648), (−2147483648, 2147483647), and, for `div` and `rem`, every sampled dividend with divisor 0.

The generator **MUST NOT** be required to produce full Cartesian products.

### 8.8 Types

For every operation, the generator **MUST** produce at least one sub-test for every type signature the operation accepts that the existing suite does not cover (Section 1.5.1 lists the gaps at the review revision).

For every vector and matrix type, at least one sub-test **MUST** use a different value in every component, so that component-order and matrix-layout errors (such as row-major versus column-major storage) change the result.

Operations defined on `floatN` **MUST** be tested with scalar `float` inputs, since the Specification includes `float` in `floatN` (spec line 418).

### 8.9 Packing

The generator **MAY** place several sample values in the components of one vector or matrix sub-test for component-wise operations. When it does:

- each component **MUST** have its own expected value in the oracle file;
- every value in the classes `zero`, `halfway`, `infinity`, and `nan` **MUST** also appear in at least one scalar `float` sub-test, so that a failure can be traced to a single value.

### 8.10 Pseudo-random number generator

All pseudo-random choices **MUST** use SplitMix64, seeded with the input seed:

```
state = state + 0x9E3779B97F4A7C15   (mod 2^64)
z = state
z = (z XOR (z >> 30)) × 0xBF58476D1CE4E5B9   (mod 2^64)
z = (z XOR (z >> 27)) × 0x94D049BB133111EB   (mod 2^64)
return z XOR (z >> 31)
```

A `scatter` float **MUST** be formed by taking one 64-bit output, using bit 63 as the sign, bits 52–62 as the biased exponent, and bits 0–51 as the mantissa. Outputs whose exponent bits are all ones (Infinity or NaN) **MUST** be discarded and redrawn. A `scatter` int32 **MUST** be the low 32 bits of one output, interpreted as two's complement.

The generator **MUST** draw values in a documented order: by asset name, then by sub-test order within the asset.

## 9. Expected Values

### 9.1 Exactly specified results

For operations whose results the Specification defines exactly, the generator **MUST** compute the expected value exactly in binary64 or int32 arithmetic following the Specification's definition. This includes arithmetic, rounding, comparison, integer, bitwise, boolean, conversion, swizzle, `select`, `switch`, constants, and all flow, state, and event behavior.

### 9.2 Special-value results

Where the Specification's definition table for an operation gives a special-value result (NaN, ±Infinity, ±0) for an input, the expected value **MUST** be that result, compared in `exact` mode.

### 9.3 Approximate results

For transcendental functions and composite operations (vector, matrix, quaternion, and color-model operations), the generator:

- **MUST** compute a reference result with at least 128 bits of precision and round it to the nearest binary64 value;
- **MUST** use `relative` comparison with default `r` = 1e-12 and `a` = 1e-300 for transcendental functions, and default `r` = 1e-12 and `a` = 1e-12 for composite operations.

_Informative:_ The Specification requires double-precision values but does not state accuracy requirements for transcendental functions. The default tolerances reject single-precision implementations while allowing ordinary double-precision library error. See Appendix A.

### 9.4 Multiple permitted results

Where the Specification permits more than one result (for example the four alternatives for negative-determinant matrices in `math/matDecompose`, or the sign of `w` in an identity quaternion), the generator **MUST** use `set` or `property` comparison so that every permitted result passes.

Where the Specification states that a result is undefined or implementation-defined, the generator **MUST NOT** assert the value. It **MAY** assert properties that the Specification does define, such as the result type or that execution continues.

### 9.5 Interpretations

Where computing an expected value requires an interpretation of the Specification that it does not state directly, the generator **MUST** set `reviewRequired` on the sub-test and **MUST** list the sub-test and the interpretation in the coverage report.

## 10. Coverage Requirements

_Informative:_ Sections 10.2 to 10.12 list everything the generator must be able to cover. At suite revision `9ffd30e`, many of these targets are already covered by existing sub-tests, for example the flow procedures in Section 10.6, ordering and first-tick values in Section 10.10, and most of the animation targets in Section 10.9. Gap determination (Section 11) removes covered targets, so the generator emits sub-tests only for what remains. The requirements are kept complete so the generator stays correct against later suite revisions.

### 10.1 Target registry

The generator **MUST** use a machine-readable target registry. Each target has an identifier, a kind, a Specification reference, and the requirements for covering it:

| Kind | Identifier form | Example |
| --- | --- | --- |
| Normative statement | `S-<line>[-<part>]` | `S-568-negzero` |
| Type signature | `T-<op>-<type>` | `T-math/clamp-float3` |
| Procedural behavior | `P-<op>-<name>` | `P-flow/for-endIndexReevaluated` |
| Object Model pointer | `O-<pointer template>` | `O-/extensions/KHR_interactivity/activeCamera/position` |
| Edge case | `E-<area>-<name>` | `E-precision-intToFloat16777217` |

The registry **MUST** contain every in-scope target from Section 1 and every target implied by Sections 10.2–10.12. A normative statement containing several requirements **MUST** be split into parts so each can be covered separately. Line numbers **MUST** refer to the Specification revision in use, and the registry **MUST** record that revision.

_Informative:_ The registry is data, not code. It is expected to be reviewed by the working group alongside the generated assets.

### 10.2 Math operations

For each math operation, the generator **MUST** produce sub-tests that together cover:

1. every accepted type signature (Section 8.8);
2. every applicable value class from Sections 8.2–8.5, with the combination rules of Section 8.7;
3. every case in the operation's definition table in the Specification, each in its own sub-test or packed component;
4. for `floatN` operations, the scalar form (Section 8.8);
5. the specific cases in Sections 1.6.2–1.6.5.

In addition:

- `math/round` **MUST** cover half-way inputs of both signs and inputs in (−0.5, 0) producing −0 (spec line 568).
- `math/neg` and `math/abs` on `int` **MUST** cover −2147483648 (spec line 2510).
- `math/div` and `math/rem` on `int` **MUST** cover inexact negative quotients such as −7 / 2 (spec line 2626).
- `math/select` **MUST** cover every value type, including `ref` and the matrix types.
- `math/switch` **MUST** cover every value type for `default` and cases, and every case-encoding example in the Specification (spec lines 1009–1057) that produces a valid graph.
- `math/random` **MUST** cover the retention and update rules (spec lines 1075–1083) across `flow/sequence` outputs, loop bodies, and delayed activations.
- `math/matDecompose` **MUST** cover negative-determinant matrices using `set` or `property` comparison.

### 10.3 Precision and negative zero

The generator **MUST** produce sub-tests that distinguish double from single precision, including:

- `type/intToFloat(16777217)` compared exactly with 16777217.0;
- `math/add` and `math/sub` results that are exact in binary64 and inexact in binary32, such as (2^53 − 1) − (2^53 − 2) and 16777217.0 + 1.0;
- one sub-test per component-wise float operation class (arithmetic, rounding, transcendental) with an input that loses information when rounded to binary32.

The generator **MUST** produce negative-zero sub-tests for `math/round`, `math/trunc`, `math/ceil`, `math/neg`, `math/abs`, `math/sign`, `math/mul`, `math/fract`, `type/intToFloat` (spec line 3205), and `type/floatToInt`, using the method in Section 7.3.

### 10.4 Type conversion

Each conversion operation **MUST** be tested with every value class applicable to its input type. `type/floatToInt` **MUST** cover every value in Section 8.5, ±Infinity, NaN, and −0. `type/intToFloat` **MUST** cover every value in Section 8.4.

### 10.5 Configuration fallback

For each operation with a default configuration (`math/switch`, `math/quatFromAngles`, `flow/switch`, `flow/for`, `flow/multiGate`, `flow/waitAll`, `debug/log`), the generator **MUST** produce sub-tests in which:

1. each configuration property is missing;
2. each configuration property has the wrong JSON type;
3. each configuration property has each kind of invalid value the Specification lists for it (for example non-integer, out of range, greater than 64, or an unrecognized `order` string);
4. a valid configuration is accompanied by a property the operation does not define (spec line 313).

Each case **MUST** produce a valid graph whose observable behavior differs between the default configuration and the configuration as written, so that the sub-test fails if the implementation does not fall back. For `flow/multiGate`, where one invalid property causes both to use the default (spec line 3477), the valid property **MUST** be set to its non-default value. For `debug/log`, where the only observable difference is the log text, the sub-tests **MUST** follow Section 10.10.

The generator **MUST** also produce sub-tests in which a non-configurable operation carries a configuration property (spec line 309), for at least one non-configurable operation from each of the `math`, `flow`, `event`, `type`, and `animation` categories.

### 10.6 Flow control

The generator **MUST** cover every uncovered behavior in Section 1.5.2 for flow operations and every flow statement in Section 1.4.4 within scope, including:

- `flow/for` re-evaluation of `endIndex` on each iteration, empty and negative ranges, and ranges at the int32 limits;
- `flow/doN` with `n` equal to 0, negative, and changed between activations;
- `flow/waitAll` with repeated activation of one input, `inputFlows` 0 and 64, and reset partway through;
- `flow/multiGate` with every configuration combination, the `lastIndex` output, and reset partway through;
- `flow/throttle` with NaN, Infinity, and 0 durations;
- `flow/setDelay` with NaN, Infinity, and large finite durations, the node's `cancel` input, uniqueness of `lastDelay` across nodes (spec line 3640), and ordering of `out` and `done` for a zero duration;
- `flow/cancelDelay` with a null reference, a non-delay reference, and a delay that has already fired (spec line 3676);
- flow connections to non-existent input flow sockets (spec line 5397).

### 10.7 Variables

The generator **MUST** cover:

- type-default initialization for every variable type (spec line 359), including NaN defaults for every float type;
- `variable/set` and `variable/get` for every value type, including `float2x2`, `float3x3`, and `ref`;
- `variable/set` with several variables, including variable indices at least 10 so that the ids are multi-digit;
- `variable/interpolate` for `float`, `float2`, `float3`, `float4`, and every matrix type, with `useSlerp` true for `float4`;
- `variable/interpolate` easing, with Bézier control points chosen so that the midpoint value differs measurably from a linear interpolation.

### 10.8 Pointers and the Object Model

The generator **MUST** cover:

- every pointer defined in the Specification's "Extending glTF Object Model" section, in both `[]` and `{}` forms where both are defined;
- `activeCamera` values, checking that each value group (position, rotation, perspective, orthographic) is either entirely finite or entirely NaN (spec line 4801);
- animation state pointers before, during, and after playback, and for an animation with an unused sampler (spec line 4826);
- `pointer/get` failure cases: negative index, out-of-range index, null reference, and type mismatch, each checking `isValid` false and the type-default value;
- `pointer/set` failure cases: negative index, null reference, type mismatch, and a read-only property, each checking that only `err` fires;
- `pointer/set` cancelling an active `pointer/interpolate` on the same pointer;
- `pointer/interpolate` on a rotation quaternion, verifying spherical interpolation at the midpoint (spec line 4264);
- `pointer/interpolate` replacement by a second interpolation on the same pointer, zero duration, `p1`/`p2` first components outside [0, 1], and the easing requirement stated for variables in Section 10.7;
- reading and writing properties of nodes outside the current scene;
- every valid pointer template syntax example in the Specification. Where a valid example refers to a property the asset cannot contain (such as `extras` properties), the sub-test asserts only that the graph runs and that `isValid` is a `bool`;
- at least one read and one write for each core glTF Object Model property group not covered by the existing suite: node rotation, node scale, camera perspective and orthographic properties, and mesh and node morph weights.

### 10.9 Animation

The generator **MUST** cover:

- no automatic playback before `animation/start` (spec line 184), in an isolated asset;
- reverse playback, `startTime` equal to `endTime`, `endTime` of ±Infinity, negative requested timestamps, and an animation whose maximum input time is 0;
- restart of a playing animation, verifying that the first `done` never fires (spec line 4352);
- `animation/stopAt` with a stop time outside the playback range, on a stopped animation, and followed by a new `animation/start` (spec line 4353);
- `pointer/get` of an animated property during playback (spec line 3891).

### 10.10 Events and debug output

The generator **MUST** cover:

- `event/onStart` activation order and identical references across several nodes (spec line 4477);
- first-tick values, ordering after `onStart`, and identical outputs across several `event/onTick` nodes (spec lines 4494–4500);
- `event/send` and `event/receive` for every value type, including vectors, matrices, and `ref`, and for initial values and type-default values;
- ordering and identical outputs across several `event/receive` nodes for the same event (spec line 4591).

For `debug/log`, the generator **MUST** produce sub-tests covering doubled braces in templates, substituted values containing braces, every parameter type, and each invalid-configuration case (Section 10.5). These sub-tests **MUST** assert that the `out` flow fires. Each **MUST** also record the expected log text in `expectedLogOutput` and declare `logCapture` in `requiredRunnerCapabilities`.

### 10.11 Concepts

The generator **MUST** cover:

- output value retention until a node with flow sockets executes (spec line 209), using a pure node whose inputs change between reads;
- type-default input value sockets for every type (spec line 5348);
- extra `values` properties having no effect (spec line 5244);
- the implicit `value` socket id (spec line 5306);
- extension operation declarations with input and output socket objects (spec lines 5112–5118), using an operation from a Khronos extension and marking any sub-test that needs that extension as conditional on `asset/extensions/<name>/enabled`.

### 10.12 Conditional sub-tests

For the dynamic limits `maxActiveAnimations`, `maxActiveDelays`, `maxActivePropertyInterpolations`, and `maxActiveVariableInterpolations`, the generator **MUST** produce conditional sub-tests that read the limit at runtime. If the limit is at most 64, the sub-test starts one more operation than the limit allows and asserts that the extra operation activates `err`. Otherwise the sub-test sets its skip variable (Section 7.4) and does not assert. A skipped sub-test **MUST** set its pass variable to `true`, so that runners using `test/onSuccess` are not affected, and **MUST** be reported as skipped by runners that read the `conditional` property.

## 11. Gap Determination

The generator **MUST** read every oracle file and binary glTF file in the existing suite and record, for each existing sub-test, the operation under test, input types, input values, comparison behavior, and expected value.

An existing sub-test covers a target if, and only if:

- it asserts the behavior the target describes, with the same operation, input types, and scenario; and
- its comparison could detect a violation. A sub-test that compares with a tolerance does not cover precision or negative-zero targets. A sub-test whose expected value is an engine-specific type name does not cover the value of a reference.

The mapping from existing sub-tests to targets **MUST** be stored in the target registry or in a separate data file, not derived solely by heuristics at generation time. The coverage report **MUST** list every existing sub-test that the mapping credits.

The generator **MUST** also read `invalid/invalid-index.json` and the invalid-graph cases it lists, if present. Invalid-graph cases **MAY** be credited only to rejection targets, which are out of scope for generation (Section 4.2). The credit is used for reporting: the coverage report **MUST** show each rejection target as covered by an existing invalid-graph case or not covered. Apart from this credit and the name-collision check of Section 6.2, the generator **MUST NOT** treat an invalid-graph file as a test asset.

## 12. Validation

Before completing, the generator **MUST** check that:

1. every asset passes the glTF Validator with no errors and validates against the `KHR_interactivity` schemas (Section 7.1);
2. every `resultVarId` and `successResultVarId` in each oracle file refers to a variable with the stated name and type in the asset;
3. every in-scope target in the registry is covered by an existing or supplemental sub-test, or is listed in the coverage report with a reason it could not be covered;
4. no supplemental sub-test duplicates an existing one (Section 11);
5. a second run with the same inputs produces identical output (Section 5.3), when invoked with a verification option.

The generator **SHOULD** provide adapters to run the supplemental assets on one or more existing `KHR_interactivity` implementations. The first adapter **SHOULD** use the engine of the Khronos authoring tool (`@khronosgroup/gltf-interactivity-engine`), which runs headless. Where an implementation's result differs from the expected value, the generator **MUST** record the difference in the coverage report and **MUST NOT** change the expected value because of it. Each confirmed disagreement is reported as an issue in that implementation's repository.

## 13. Reports

The generator **MUST** write `supplemental-coverage.json` and `supplemental-coverage.md` containing:

- the generation inputs (Section 5.2), excluding file system paths;
- counts of assets and sub-tests, by category;
- for every target: status (covered by existing, covered by supplemental, or not covered with a reason) and the covering sub-tests;
- for every operation: a matrix of type signatures by value class, showing existing and supplemental coverage;
- every sub-test with `reviewRequired`, with its interpretation;
- every implementation disagreement found by adapters (Section 12).

## 14. Metadata and Licensing

- `asset.copyright` and the description file **MUST** use the format `Copyright (c) YYYY, Copyright Owner`, with the year and owner taken from the inputs.
- Supplemental assets **MUST** be licensed under the license used by the existing suite (CC BY 4.0 International at the review revision), and the description file **MUST** state it.
- The generator's name and version **MUST** appear in `asset.generator` and in the oracle file's `generator` property.

---

## Appendix A. Open Issues (Informative)

These points need a decision by the working group or the test-asset maintainers. The generator can be built before they are resolved, but the affected sub-tests carry `reviewRequired`.

1. **Transcendental accuracy.** The Specification does not state accuracy requirements for transcendental functions. The default tolerance in Section 9.3 is a proposal.
2. **Precision in existing implementations.** Implementations that use binary32 internally will fail the precision sub-tests (Section 10.3). This is correct under spec line 278, but maintainers may want those sub-tests in a separately tagged asset so their results can be reported apart from the rest.
3. **`"-0"` in oracle files.** Existing runners that compare `expectedResultValue` directly will not recognize `"-0"`. Runners that use the in-graph pass/fail variables are unaffected. The existing suite avoids the problem in `Extras/Float_Precision` by storing `1 / x` in the result variable and expecting `"Infinity"` or `"-Infinity"`. Adopting that convention instead of `"-0"` would keep every oracle readable by existing runners. The authoring tool's harness is not affected either way: it takes the in-graph pass variable as the result and only logs a warning when `expectedResultValue` disagrees.
4. **Index merging.** Whether `supplemental-index.json` is merged into `test-index.json` and `mathtests-index.json`, or kept separate, is for the maintainers to decide. The authoring tool's harness also runs any `test-Json/*.json` file that no index lists, so supplemental assets written under `Tests/Interactivity` run there whether or not the indexes are merged.
5. **Conditional sub-tests.** Reporting a skipped sub-test as passed keeps existing runners working but hides skips from them. The alternative is a third result state, which existing runners do not support.
6. **Extension-dependent sub-tests.** Section 10.11 uses an operation from another Khronos extension to test declaration handling. The maintainers may prefer that these sub-tests live with that extension's tests.
7. **Existing suite issues.** Section 1.7 lists issues in the existing assets, such as engine-specific expected values and sub-test labels that state the opposite of the expected value. This generator does not correct them (Section 4.3); they need to be fixed in the existing generator.
8. **Component extraction in the harness.** The harness operation set in Section 7.2 has no `math/extract*` operations, which component-by-component comparison of vector and matrix results needs (Section 7.3). The existing suite's harness already uses `math/extract3`. The working group needs to decide whether the extract operations join the harness set, verified by the supplemental prerequisites asset.
9. **Oracle file shape.** Section 7.4 lists the oracle properties as a flat set, but the existing oracle files, which existing runners read, nest sub-tests under `tests[].subTests[]` and add `description` and `entryPoints`. The nested shape is unchanged at revision `9ffd30e`. Section 7.4 should be updated to describe the nested shape.
10. **Remaining rejection gaps.** Rejection tests are out of scope for this generator (Section 1.1). Section 1.6.1 lists the rejection cases the existing `invalid/` set does not yet include; they need to be added there.
11. **Graph versus extension rejection.** For 38 invalid-graph cases the Specification's normative text requires rejecting the graph while its Validation section requires rejecting the extension (Section 1.8). This does not affect the generator, but the Specification should resolve it.
12. **Defect reporting.** Defects found while building or running the generator are filed as issues in the repository that owns them: test-asset defects (Section 1.7) in `glTF-Test-Assets-Interactivity`, engine and harness defects in `glTF-InteractivityGraph-AuthoringTool` or the relevant implementation, and Specification text issues (Section 1.8) in `glTF`.
