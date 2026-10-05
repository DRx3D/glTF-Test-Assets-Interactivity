# KHR_interactivity Test Asset Coverage Report

## Scope and method

This report compares the `KHR_interactivity` specification against the test assets in `glTF-Test-Assets-Interactivity`. It replaces the report made against suite revision `0f24a49`; Section 6 lists what changed.

| Source | Revision |
| --- | --- |
| `KhronosGroup/glTF`, `extensions/2.0/Khronos/KHR_interactivity/Specification.adoc` (status: Complete, Ratified) | `c5d1e1e8` (2026-09-28) |
| `KhronosGroup/glTF-Test-Assets-Interactivity`, `main`, `Tests/Interactivity` | `9ffd30e` (2026-10-05), merged to `main` by PR #22 (`fc073cf`) |

The tests were analysed on branch `fix/spec-and-json-conform-fixes` before it was merged. Later commits on `main` add only showcase models under `Models/`, so the `Tests/Interactivity` content is unchanged.

Line numbers in this report refer to `Specification.adoc` at the revision above. Revision `c5d1e1e8` differs from the previously used `166ed85` only by four typo fixes, so every line number is unchanged.

The analysis was done in three passes:

1. **Node level.** Every operation defined in the specification (135 in total) was checked against the declarations in every test `.glb`.
2. **Requirement level.** Each MUST/SHALL/REQUIRED statement was compared against the graphs, inline input values, configurations, and oracle files of the relevant tests. Where node-level coverage existed, the test contents were inspected to see which types, configurations, and special values were actually exercised.
3. **Rejection level.** Each case in `invalid/invalid-index.json` was mapped to the statement it violates.

Only the test assets under `Tests/Interactivity` were considered. The showcase models under `Models/` exercise the extension but do not check results, so they do not count as coverage here.

A test that uses an operation only as part of the harness (for example `math/eq`, `flow/branch`, or `variable/set` used to record pass/fail) is not counted as testing that operation. Coverage is credited only where a test asserts the operation's result. An invalid-graph case is credited to the statement it violates. It passes when the graph is rejected, which a runner detects because the graph's `test/onFailed` event never arrives.

## Summary of findings

Node-level coverage is complete. All 135 operations have at least one dedicated test. The suite now has 159 test assets with 1,073 sub-tests, plus 179 invalid-graph cases. The suite README gives 1,071 sub-tests; the count here was taken from the oracle files.

Requirement-level coverage has improved a great deal. Of the 128 normative statements assessed (the BCP 14 terminology statement is excluded), 83 are covered, 17 are partially covered, and 28 have no coverage (6 of them impractical array-size limits). At the previous revision the figures were 14, 18, and 96.

The structural gap identified in the previous report is closed. The new `invalid/` set provides 179 deliberately invalid graphs, each breaking one validation rule, and the new `graph/` tests check valid graphs that look suspicious. Together they cover most of the JSON syntax and validation statements, and the operation-level rejection rules for `variable/*`, `pointer/*`, `event/*`, `math/switch`, `flow/switch` and `debug/log`. The rejection statements that remain uncovered fall into three groups: implementation limits (graph size, socket counts), type-equality rules for `math/select`, `math/dot` and `math/matMul`, and `pointer/set` with an invalid `type`.

The numeric gap has narrowed. The new `Extras/Float_Precision` asset checks double precision directly (for example `16777217 - 16777216 == 1` and `(2^53-1) - (2^53-2) == 1`), and distinguishes `+0` from `-0` by dividing by the result. The rest of the suite still uses single-precision inputs and tolerance comparisons, so double precision and the sign of zero are verified only for the operations in that one asset.

Type breadth is the largest remaining gap. Component-wise arithmetic is still tested with scalars only, the matrix types `float2x2` and `float3x3` are still rare and never used as variable or event types, `math/select` and `math/switch` are each tested with one type, and the scalar forms of `floatN` operations are untested. Special values for transcendental functions are also still missing.

---

## 1. Normative statements and their test coverage

Status values:

- **Covered**: at least one test asserts the required behavior.
- **Partial**: some of the required behavior is asserted, but not all of it. The note says what is missing.
- **None**: no test asserts the behavior.

Invalid-graph cases are cited by their id in `invalid/invalid-index.json` (for example `G1b`).

### 1.1 Concepts

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

### 1.2 Math operations

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 568 | `math/round`: half-way cases MUST round away from zero; values in (-0.5, 0) MUST round to -0 | Covered | `math/round` now has ±0.5, 1.5, ±2.5; `Extras/Float_Precision` checks `round(-0.3)` is -0 and `round(0.49999999999999994)` is 0. |
| 966 | `math/select`: `T` MUST be the same for `a`, `b`, and the output | None | No invalid case. `select` is still tested with `float` only (see Section 2). |
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

### 1.3 Type conversion

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3203 | `type/intToFloat` MUST be lossless | Covered | `Extras/Float_Precision`: `intToFloat(2147483647)` and `intToFloat(-2147483647)` checked by exact subtraction. |
| 3205 | `type/intToFloat` MUST NOT produce negative zero | Covered | `Extras/Float_Precision`: `intToFloat(0) is +0`. |

### 1.4 Control flow

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

### 1.5 State manipulation (variables)

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

### 1.6 Object model access (pointers)

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

### 1.7 Animation control

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4352 | Restarting an already playing animation MUST NOT activate the previous `done` flows | Covered | `animation/start_playback_modes`: "Restart: 1st [done] not fired". |
| 4353 | New animation entry: stop time MUST equal end time; stop completion MUST be null | Covered | `animation/stop_and_stopAt_edge_cases`: `stopAt` followed by a new `start`, including `stopTime` equal to and beyond `endTime`. |
| 4423 | `animation/stop`: animated properties MUST keep current values; `done` MUST NOT fire | Covered | Position frozen near 50%, `done` not fired; also `stop` on an animation that is not playing. |

### 1.8 Events

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

### 1.9 Debug output

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4665 | `debug/log`: literal curly brackets in the template MUST be doubled | None | Templates with doubled brackets now appear, but log output is never checked. |
| 4671 | `debug/log`: invalid `severity` MUST fall back to default | None | Every `severity` in the suite is 0. |
| 4683 | `debug/log`: invalid `message` MUST fall back to default | Partial | `graph/ignored_configuration` asserts that `out` fires with an invalid message; the log text is not checked. |
| 4712 | `debug/log`: missing generated sockets MUST cause rejection | Covered | `H3`. |
| 4714 | `debug/log`: extra sockets MUST still have valid sources | None | |
| 4725 | `debug/log`: curly brackets in substituted values MUST be doubled | None | |

Log output is implementation-facing, so verifying it would need an oracle that captures log text. The requirements are still normative.

### 1.10 Object model extensions

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4738 | `asset/majorVersion`/`minorVersion` MUST be the minimum of the asset version and the maximum supported version | Covered | Only the common case (asset 2.0) can be tested with a normal asset. |
| 4740 | Supported extensions in `extensionsUsed` MUST appear as `asset/extensions/<name>/enabled` | Covered | Includes unknown and declared-but-unused extensions. |
| 4774 | Runtime limit values MUST be at least 1 | Covered | |
| 4801 | Unavailable active camera data MUST be reported as NaN | None | No test reads any `activeCamera` pointer. |
| 4826 | Animation `minTime`/`maxTime` MUST come from sampler input accessor min/max, ignore unused samplers, and be NaN for invalid animations | Partial | `animation/state` covers min/max and an unused sampler. The NaN result for an invalid animation is not tested. |

### 1.11 JSON syntax and validation

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

---

## 2. Specification content without test coverage

This section covers behavior defined by the specification that is not tied to a single MUST statement: operation type signatures, procedural steps, configuration variants, and object model pointers.

### 2.1 Untested type signatures

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

### 2.2 Operation behavior described procedurally

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

### 2.3 Object model pointers

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

---

## 3. Edge and corner cases needing specialized test assets

These are cases where a generic test would not catch a non-conforming implementation. Items now covered by the suite are listed as such so the remaining work is clear.

### 3.1 Graph rejection and configuration fallback

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

### 3.2 Precision and negative zero

`Extras/Float_Precision` now covers the core of this item: `16777217 - 16777216`, `(2^53-1) - (2^53-2)`, `0.1 + 0.2`, the largest and smallest finite literals, `round(0.49999999999999994)`, `intToFloat` at the int32 limits, and the sign of zero for `neg(0)`, `min(0, -0)`, `max(-0, 0)`, `round(-0.3)`, `abs(-0)`, `intToFloat(0)`, and a literal `-0.0`.

Still missing:

- Negative zero for `math/sign(-0.0)`, `math/trunc(-0.5)`, `math/ceil(-0.5)`, `math/mul`, and `math/fract`.
- Double-precision checks for transcendental functions; their tests still use single-precision expected values with tolerances.
- Exact comparison anywhere outside `Extras/Float_Precision`.

### 3.3 Integer boundaries

Now covered: `math/neg(-2147483648)`, `math/abs(-2147483648)`, `math/mul` overflow, and `type/floatToInt` with ±Infinity, -0, values at and beyond `INT_MAX`, and large values (wrapping per the specification).

Still missing:

- `math/div(-7, 2) = -3` and `math/rem(-7, 2) = -1` for `int`. Only the float `rem(-7, 3)` is tested.
- `math/rem(-2147483648, -1)`.
- `math/clamp` with `b == c`.

### 3.4 Scalar forms of vector operations

Unchanged. Because `floatN` includes `float`, `math/length(-3.0)` should return 3, `math/normalize(-3.0)` should return -1 with `isValid` true, `math/normalize(0.0)` should be invalid, and `math/dot(2.0, 3.0)` should return 6. None is tested.

### 3.5 Special values in untested operations

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

### 3.6 Ordering and timing

Now covered in `event/activation_order_and_onTick`: `onStart` order, `receive` order, first-tick values, first tick after all `onStart` handlers, `onTick` order, and identical values within a tick.

Still missing: a `setDelay` with a duration of 0, asserting that `done` never fires before `out`.

### 3.7 Animations and pointers together

All four cases from the previous report are now covered: reading an animated property with `pointer/get` during playback, restart without the first `done`, no autoplay before `animation/start`, and slerp for `pointer/interpolate` on rotation.

### 3.8 Pointer template syntax

All invalid examples from the specification are rejection cases (`G5-01`–`G5-22`), and a doubled-bracket template is checked in `graph/json_syntax`. The valid `~0` and `~1` encoding examples, and a parameter used only once, still need assets.

---

## 4. Test suite issues that affect coverage

These are properties of the current assets that limit what they can verify, independent of which requirements they target.

**Rejection mechanism (resolved).** The `invalid/` set and its README define how a runner checks rejection: each case sends `test/onFailed` if it runs, so the case passes when that event never arrives. An implementation without `KHR_interactivity` support passes every invalid case trivially, so the README requires running the regular tests too.

**Float inputs are single precision.** Outside `Extras/Float_Precision`, inline values such as `345.234436` and expected values such as `62.9999962` are still float32 values printed as decimals. Combined with tolerance-based comparison, this means double precision is verified only for the operations in that one asset.

**Wide tolerances.** Most comparisons use `abs(actual - expected) < tolerance`, with tolerances from 0.0001 to 0.4. Animation checks still use 0.3–0.4, and some interpolation midpoint checks still use 0.1. These confirm that something happened but cannot distinguish easing curves or detect small timing drift. The authoring tool's sample-asset harness does not loosen this further: it takes the in-graph pass variable as the result and uses its own 0.05 / 3% tolerance only for a warning.

**Engine-specific expected values.** `UnityGLTF.Interactivity.StaticRefPointer` still appears as an expected value in four description files (`event/Event_Refs`, `pointer/CoreReadOnlyPointers_GetTests`, `UserInteractions/eventOnHover`, `UserInteractions/eventOnSelect`). These are generator artifacts and are not meaningful to other implementations.

**Sub-test labels round their inputs.** Labels such as `[a] 757.00 = 758.00` (`math/ceil`, actual input `757.003`) and `[a] 1.10 = 63.00` (`math/deg`, expected `62.9999962`) still appear wrong to a reviewer.

**Ambiguous sub-test labels.** Several labels state the opposite of the expected value, because the result variable records a failure or a negated condition:

- `event/Event_Refs`: "ref not null" expects `False`, and "onTickt wo nodes" is still misspelled.
- `event/activation_order_and_onTick`: "receive: all get the sent value", "onTick: same values in a tick", and "timeSinceStart non-decreasing" all expect `False`.
- `Extras/Float_Precision`: "0.1 + 0.2 != 0.3", "literal 1.79e308 is finite", and "1e30 * 1e30 is finite" expect `False`.

The results are probably correct, but each label needs reading against the graph to confirm.

**Locale leakage.** Log messages still use a comma as the decimal separator ("Proximity range: 0,0001"), including in the new assets. This only affects log text, not results.

**Out-of-scope operations.** `UserInteractions/eventOnHover` and `eventOnSelect` test `KHR_node_hoverability` and `KHR_node_selectability` operations. `graph/unsupported_operations_and_graphs` declares `test/*` operations on purpose, to check how unsupported extension operations are handled. Neither counts toward core operation coverage.

---

## 5. Specification text issues

All four text issues listed in the previous report were fixed in `c5d1e1e8` ("KHR_interactivity: Fix typos"): `<EXTENSION_MANE>` at line 4761, the mismatched emphasis at line 5244, "less then" at line 5387, and "if it point to" at line 4203.

One open issue comes from the new invalid set. The suite README reports 38 cases (`schemaAssert: true`) where the normative text requires only rejecting the graph, while the Validation section requires rejecting the whole extension. The suite expects extension rejection for these, and either outcome stops the graph from running. The specification should state which one applies; this is reported as [glTF #2665](https://github.com/KhronosGroup/glTF/issues/2665).

---

## 6. Changes since the previous report

| Area | Revision `0f24a49` | Revision `9ffd30e` |
| --- | --- | --- |
| Test assets / sub-tests | 149 / 831 | 159 / 1,073 |
| Invalid-graph cases | 0 | 179 |
| Statements covered / partial / none | 14 / 18 / 96 | 83 / 17 / 28 |

New assets: `animation/start_playback_modes`, `animation/state`, `animation/stop_and_stopAt_edge_cases`, `event/activation_order_and_onTick`, `graph/extra_and_unknown_sockets`, `graph/ignored_configuration`, `graph/json_syntax`, `graph/unsupported_operations_and_graphs`, `pointer/set_edge_cases`, and `Extras/Float_Precision`.

Extended assets, by number of sub-tests added: `pointer/interpolate` (+14), `variable/interpolate` (+14), `flow/setDelay_and_cancelDelay` (+8), `flow/for` (+6), `flow/multiGate` (+6), `math/round` (+6), `variable/set_and_get` (+6), `flow/throttle` (+5), `math/smoothStep` (+5), `flow/waitAll` (+4), `math/pow` (+4), and 24 others with one to three each.

Other changes on the branch: the specification-conformance fixes to existing JSON (variable `id` renamed to `name`, node order), NaN and Infinity no longer written as strings in float values, braces escaped in `debug/log` messages, `mathtests-index.json` moved to `Tests/Interactivity/`, and the `Overview` and `mathtests` aggregates changed to sequence-based execution.
