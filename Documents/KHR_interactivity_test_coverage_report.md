# KHR_interactivity Test Asset Coverage Report

## Scope and method

This report compares the `KHR_interactivity` specification against the test assets in `glTF-Test-Assets-Interactivity`.

| Source | Revision |
| --- | --- |
| `KhronosGroup/glTF`, `extensions/2.0/Khronos/KHR_interactivity/Specification.adoc` (status: Complete, Ratified) | `166ed85` (2026-09-28) |
| `KhronosGroup/glTF-Test-Assets-Interactivity`, `Tests/Interactivity` | `0f24a49` (2026-07-31) |

Line numbers in this report refer to `Specification.adoc` at the revision above.

The analysis was done in two passes:

1. **Node level.** Every operation defined in the specification (135 in total) was checked against the declarations in every test `.glb`.
2. **Requirement level.** Each MUST/SHALL/REQUIRED statement was compared against the graphs, inline input values, configurations, and oracle files of the relevant tests. Where node-level coverage existed, the test contents were inspected to see which types, configurations, and special values were actually exercised.

Only the test assets under `Tests/Interactivity` were considered. The showcase models under `Models/` exercise the extension but do not check results, so they do not count as coverage here.

A test that uses an operation only as part of the harness (for example `math/eq`, `flow/branch`, or `variable/set` used to record pass/fail) is not counted as testing that operation. Coverage is credited only where a test asserts the operation's result.

## Summary of findings

Node-level coverage is complete. All 135 operations have at least one dedicated test, and the suite reports 149 test cases with 831 sub-tests.

Requirement-level coverage is much thinner. Of the 128 normative statements assessed (the BCP 14 terminology statement is excluded), 14 are covered, 18 are partially covered, and 96 have no coverage.

The largest gap is structural. About 75 of the 96 uncovered statements require an implementation to reject an invalid graph, fall back to a default configuration, or ignore something. The test harness has no way to express these checks. Every test is a self-checking graph that must load and run in order to report a result, so no asset can verify that a graph is rejected. Closing this gap needs a second category of asset: deliberately invalid graphs with an oracle that expects rejection, and valid graphs with invalid configurations whose observable behavior shows that the default was used.

The second gap is numeric. The specification requires `float` to be IEEE-754 double precision (line 278), but the test inputs are single-precision values written out as JSON (for example `345.234436` and `-32434.9688`), and float results are compared with tolerances from 0.0001 to 0.4. An implementation using 32-bit floats would pass the entire suite. The same tolerance-based comparison means no test can distinguish `+0` from `-0`, which two MUST statements depend on.

The third gap is type breadth. Many component-wise operations are tested with scalars only, and `float2x2`/`float3x3` appear in only a few tests. Section 2 lists the untested type signatures per operation.

---

## 1. Normative statements without corresponding test assets

Status values:

- **Covered**: at least one test asserts the required behavior.
- **Partial**: some of the required behavior is asserted, but not all of it. The note says what is missing.
- **None**: no test asserts the behavior.

### 1.1 Concepts

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 184 | Animations MUST NOT play automatically when the asset contains a behavior graph | None | No test checks an animated property before `animation/start` is called. |
| 209 | Output value sockets MUST retain their values until a node with flow sockets executes | Partial | Only `math/random` ("same number in current flow") checks this. No test checks value stability for a pure node read twice across non-flow evaluations of other kinds. |
| 217 | Each input value socket MUST have an inline value or a connection; runtime MUST guarantee all inputs are defined when execution starts | None | The first half is a validation rule and needs a rejection test. The second is exercised implicitly by every test but never asserted. |
| 238 | Socket order procedure MUST be used to compare ids | Covered | `flow/sequence` checks numeric, length-based, and case ordering. |
| 272 | Implementations MUST support all listed type signatures (including double-precision `float`) | Partial | `float2x2` and `float3x3` are used by only a handful of matrix tests and never as variable or event types. Double precision is not verifiable with the current inputs and tolerances. |
| 309 | Configuration on non-configurable operations MUST be ignored | None | No test adds configuration to a non-configurable node. |
| 311 | Default configuration MUST be used when configuration is missing or invalid; operations without a default MUST cause rejection | None | Every configuration in the suite is valid. |
| 313 | All defined configuration properties MUST be present and valid, otherwise fall back to default; undefined configuration properties MUST be ignored | None | |
| 359 | Variables without an initial value MUST be initialized to the type default | Partial | Only `ref` variables are declared without a value (12 instances). No test verifies the `bool` false, `int` 0, or NaN defaults for float types. |
| 361 | Variables MUST retain their values until execution terminates | Covered | Implicit in every test, since results are stored in variables and read back. |
| 400 | Graph MUST be rejected if it exceeds implementation static limits | None | Requires rejection testing. |

### 1.2 Math operations

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 568 | `math/round`: half-way cases MUST round away from zero; values in (-0.5, 0) MUST round to -0 | None | Inputs are only 2.7 and -3.4. No half-way input and no negative-zero check. |
| 966 | `math/select`: `T` MUST be the same for `a`, `b`, and the output | None | Only a rejection test would exercise this. Separately, `select` is tested with `float` only (see Section 2). |
| 1009 | `math/switch`: case values MUST be converted to decimal strings without leading zeros | Partial | Negative cases (`[-2,-1,0]`) are covered. The non-integer, out-of-range, float-literal (`-1.0`, `0.1e1`), and duplicate-entry examples in the specification are not. |
| 1011 | `math/switch`: graph MUST be rejected if generated sockets exceed the input socket limit | None | |
| 1023 | `math/switch`: graph MUST be rejected if any generated socket is missing or has a type different from `default` | None | |
| 1035 | `math/switch`: extra sockets MUST still have valid types and sources | None | |
| 1075 | `math/random`: value MUST be initialized on first access and MUST stay the same between accesses without intervening flow activations | Covered | |
| 1083 | `math/random`: value MUST be updated on access after a new flow activation | Covered | |
| 1560 | `math/dot`: both inputs MUST have the same type | None | Rejection test. |
| 1813 | `math/matMul`: both inputs MUST have the same type | None | Rejection test. |
| 2218 | `math/quatFromAngles`: invalid or missing `order` MUST fall back to the default | None | All six valid orders are tested. No invalid or missing `order`. |
| 2510 | Integer negation of `-2147483648` MUST return `-2147483648` | None | The `math/neg` test covers floats only. No integer negation is tested at all. |
| 2534 | Integer addition overflow MUST wrap | Covered | `2147483647 + 1`. |
| 2563 | Integer subtraction overflow MUST wrap | Covered | `-2147483648 - 1`. |
| 2592 | Integer multiplication overflow MUST wrap | Covered | `46341 * 46341`. |
| 2626 | Integer division MUST truncate toward zero | Partial | Only exact quotients (`10/2`) and `INT_MIN / -1`. No inexact negative quotient such as `-7 / 2` (expected -3, not -4). |
| 2841 | `math/asr`: result truncated to 32 bits; sign bit MUST be propagated | Covered | Includes shift counts 0, 31, 32, 33, and -1. |
| 2855 | `math/lsl`: result MUST be truncated to 32 bits | Covered | |

### 1.3 Type conversion

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3203 | `type/intToFloat` MUST be lossless | Partial | Only `intToFloat(7)`. No value above 2^24, where single precision would lose information (for example 16777217 or 2147483647). |
| 3205 | `type/intToFloat` MUST NOT produce negative zero | None | Also not detectable with the current comparison method. |

### 1.4 Control flow

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3281 | `flow/sequence`: graph MUST be rejected if output flow count exceeds the limit | None | |
| 3341 | `flow/switch`: case values MUST be converted to decimal strings without leading zeros | Partial | Negative and empty case arrays are covered. The same non-integer and duplicate cases missing for `math/switch` are missing here. |
| 3343 | `flow/switch`: graph MUST be rejected if generated flows exceed the limit | None | |
| 3411 | `flow/for`: invalid or missing `initialIndex` MUST fall back to the default | None | Only valid values (0 and 1) are used. |
| 3473 | `flow/multiGate`: graph MUST be rejected if output flow count exceeds the limit | None | |
| 3477 | `flow/multiGate`: if either configuration property is missing or non-boolean, the default MUST be used for both | None | Three valid combinations are tested; `isLoop: true` with `isRandom: true` is not. |
| 3538 | `flow/waitAll`: invalid `inputFlows` (missing, non-integer, negative, >64) MUST fall back to the default | None | Only `inputFlows: 3`. |
| 3628 | `flow/setDelay`: exceeding the maximum supported duration MUST activate `err` | Partial | `err` is tested with a negative duration only. No NaN, infinite, or very large finite duration. |
| 3640 | `flow/setDelay`: `lastDelay` MUST be unique across all `setDelay` nodes | None | `lastDelay` validity is checked, uniqueness is not. |
| 3676 | `flow/cancelDelay`: null or invalid delay references MUST NOT cause runtime errors | None | `cancelDelay` is only called with a valid reference. |

### 1.5 State manipulation (variables)

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3705 | `variable/get`: invalid variable index MUST cause rejection | None | |
| 3738 | `variable/set`: missing or empty `variables` configuration MUST cause rejection | None | |
| 3740 | `variable/set`: invalid index in `variables` MUST cause rejection | None | |
| 3741 | `variable/set`: socket ids MUST be decimal without leading zeros | Partial | Multi-variable set works (`variable/setMultiple`), but ids are not tested against alternative encodings. |
| 3743 | `variable/set`: graph MUST be rejected if generated sockets exceed the limit | None | |
| 3746 | `variable/set`: missing or mistyped generated sockets MUST cause rejection | None | |
| 3748 | `variable/set`: extra sockets MUST still be valid | None | |
| 3793 | `variable/interpolate`: invalid variable index MUST cause rejection | None | |
| 3795 | `variable/interpolate`: `int` or `bool` variables MUST cause rejection | None | |
| 3797 | `variable/interpolate`: `useSlerp` MUST be a boolean literal and MUST NOT be true unless `T` is `float4` | None | `useSlerp` is always false in the suite, so the slerp path is also never exercised. |

### 1.6 Object model access (pointers)

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3881 | Pointer templates MUST be processed per the parsing rules: non-empty parameters, no duplicates, doubled literal brackets, `~0`/`~1` encoding | Partial | Only simple `[name]` and `{name}` parameters are used. None of the specification's valid or invalid syntax examples appear in the suite. |
| 3891 | Active animation state MUST be applied before a pointer get or set on an animated property | None | |
| 4060 | `pointer/get`: missing, non-string, or invalid `pointer` MUST cause rejection | None | |
| 4062 | `pointer/get`: invalid `type` MUST cause rejection | None | |
| 4064 | `pointer/get`: graph MUST be rejected if template sockets exceed the limit | None | |
| 4129 | `pointer/set`: invalid `pointer`, or one containing `[value]`/`{value}`, MUST cause rejection | None | |
| 4131 | `pointer/set`: invalid `type` MUST cause rejection | None | |
| 4133 | `pointer/set`: graph MUST be rejected if sockets exceed the limit | None | |
| 4201 | `pointer/interpolate`: invalid `pointer`, or one containing reserved parameter names, MUST cause rejection | None | |
| 4203 | `pointer/interpolate`: invalid `type`, or a `bool`/`int` type, MUST cause rejection | None | |
| 4205 | `pointer/interpolate`: graph MUST be rejected if sockets exceed the limit | None | |
| 4264 | `pointer/interpolate`: quaternion properties MUST use spherical linear interpolation | None | Only `/nodes/[nodeIndex]/translation` is interpolated. |

### 1.7 Animation control

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4352 | Restarting an already playing animation MUST NOT activate the previous `done` flows | None | |
| 4353 | New animation entry: stop time MUST equal end time; stop completion MUST be null | Partial | Indirectly exercised by `animation/start` completing at end time. The interaction with a prior `stopAt` followed by a new `start` is not tested. |
| 4423 | `animation/stop`: animated properties MUST keep current values; `done` MUST NOT fire | Covered | Position frozen near 50%, `done` not fired. |

### 1.8 Events

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4475 | `event/onStart`: event reference MUST be set before `out` activates | Covered | `event/Event_Refs`. |
| 4477 | Multiple `event/onStart` nodes MUST activate in JSON order and MUST return the same reference | Partial | Same reference is covered; activation order is not. |
| 4494 | `event/onTick`: time values and reference MUST be set before `out` activates | Partial | Reference is checked; time values are not. |
| 4496 | First `event/onTick` activation MUST come after all `event/onStart` activations | None | |
| 4498 | First tick: `timeSinceStart` MUST be 0 and `timeSinceLastTick` MUST remain NaN | None | |
| 4500 | Multiple `event/onTick` nodes MUST activate in JSON order with identical outputs within a tick | Partial | Same reference is covered; order and identical time values are not. |
| 4581 | `event/receive`: invalid `event` index MUST cause rejection | None | |
| 4583 | `event/receive`: values not set by an external sender MUST be reset to defaults on each activation | None | Requires an external event source. |
| 4591 | Multiple `event/receive` nodes for the same event MUST activate in JSON order with identical outputs | Partial | `event/stopPropagation` exercises two receivers, but neither order nor output identity is asserted directly. |
| 4626 | `event/send`: invalid `event` index MUST cause rejection | None | |

### 1.9 Debug output

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4665 | `debug/log`: literal curly brackets in the template MUST be doubled | None | `debug/log` is used in every test, but its output is never checked. |
| 4671 | `debug/log`: invalid `severity` MUST fall back to default | None | |
| 4683 | `debug/log`: invalid `message` MUST fall back to default | None | |
| 4712 | `debug/log`: missing generated sockets MUST cause rejection | None | |
| 4714 | `debug/log`: extra sockets MUST still have valid sources | None | |
| 4725 | `debug/log`: curly brackets in substituted values MUST be doubled | None | |

Log output is implementation-facing, so verifying it would need an oracle that captures log text. The requirements are still normative and currently have no asset.

### 1.10 Object model extensions

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4738 | `asset/majorVersion`/`minorVersion` MUST be the minimum of the asset version and the maximum supported version | Covered | Only the common case (asset 2.0) can be tested with a normal asset. |
| 4740 | Supported extensions in `extensionsUsed` MUST appear as `asset/extensions/<name>/enabled` | Covered | Includes a negative case for an unknown extension. |
| 4774 | Runtime limit values MUST be at least 1 | Covered | |
| 4801 | Unavailable active camera data MUST be reported as NaN | None | No test reads any `activeCamera` pointer. |
| 4826 | Animation `minTime`/`maxTime` MUST come from sampler input accessor min/max, ignore unused samplers, and be NaN for invalid animations | None | No test reads any animation state pointer. |

### 1.11 JSON syntax and validation

All statements in this group require either a rejection test or, for the array size limits, are impractical to test directly.

| Line | Requirement (paraphrased) | Status |
| --- | --- | --- |
| 4894 | `graphs` array MUST NOT exceed 2^31 elements | None (impractical) |
| 4898 | Empty JSON arrays MUST be omitted | None |
| 4942 | `types` array MUST NOT exceed 2^31 elements | None (impractical) |
| 4958 | `signature` MUST be a defined type or `"custom"`; custom semantics MUST come from another extension | None |
| 4962 | Duplicate non-custom signatures MUST cause rejection | None |
| 4975 | `variables` array MUST NOT exceed 2^31 elements | None (impractical) |
| 4998 | Variable `type` is REQUIRED and MUST be a valid index | None |
| 5031 | Variable `value` length MUST match the type | None |
| 5033 | `bool` variable value MUST be a JSON boolean | None |
| 5035 | Float variable values MUST be JSON numbers | None |
| 5037 | `int` variable value MUST be exactly representable as int32 | None |
| 5039 | `ref` variable value MUST be a valid JSON Pointer string | None |
| 5043 | Variable `name`, if present, MUST be a string | None |
| 5050 | `events` array MUST NOT exceed 2^31 elements | None (impractical) |
| 5076 | Duplicate event ids MUST cause rejection | None |
| 5080 | Event `values` MUST NOT contain an `event` property | None |
| 5082 | Event value `type` is REQUIRED and MUST be a valid index | None |
| 5086 | Event `name`, if present, MUST be a string | None |
| 5093 | `declarations` array MUST NOT exceed 2^31 elements | None (impractical) |
| 5108 | Declaration `op` is REQUIRED | None |
| 5112 | Non-core operations MUST specify `extension` | Partial (valid case only, in `UserInteractions`) |
| 5116 | Extension operations with inputs MUST define `inputValueSockets` | Partial (valid case only) |
| 5118 | Extension operations with outputs MUST define `outputValueSockets` | Partial (valid case only) |
| 5122 | Core operations MUST NOT define `inputValueSockets`/`outputValueSockets` | None |
| 5149 | Declaration socket `type` is REQUIRED and MUST be a valid index | None |
| 5151 | Duplicate declarations MUST cause rejection | None |
| 5221 | `nodes` array MUST NOT exceed 2^31 elements | None (impractical) |
| 5225 | Node `declaration` is REQUIRED and MUST be a valid index | None |
| 5244 | `values` MUST contain every input socket id; extra properties MUST conform to schema | None |
| 5248 | Missing value source or mismatched type MUST cause rejection | None |
| 5254 | Unsupported input types MUST cause rejection | None |
| 5266 | Inline value `type` MUST be defined and valid | None |
| 5294 | Defining both `node` and `value` MUST cause rejection | None |
| 5298 | `node` reference MUST be less than the current node index | None |
| 5306 | `socket` MUST exist on the referenced node; MUST be given if no `value` socket exists | None |
| 5310 | `type` given with `node` MUST match the referenced socket type | None |
| 5348 | Type-default sockets MUST define a valid `type` | None (the valid case is exercised by `ref` defaults) |
| 5381 | Extra `flows` properties MUST still be validated | None |
| 5383 | Flow `node` is REQUIRED | None |
| 5387 | Flow `node` MUST be greater than the current index and less than the node count | None |
| 5397 | Activating a flow connected to a non-existent input flow socket MUST have no effect | None |

The flow and value ordering rules at lines 5298 and 5387 are worth highlighting. They make every valid graph a forward-only structure, and an implementation that does not enforce them may accept cyclic graphs that other implementations reject.

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
| `math/neg` | `int`, `float2x2`, `float3x3` |
| `math/eq` | `float3`, `float4`, `float2x2`, `float3x3` |
| `math/ceil`, `floor`, `fract`, `round`, `trunc`, `saturate`, `mix` | `float2x2`, `float3x3` (only `float4x4` of the matrices is tested) |
| `math/deg` | `float4` |
| `math/dot`, `math/length`, `math/normalize` | scalar `float` (the `floatN` placeholder includes `float`; see edge cases below) |
| `math/transform` | `float2` with `float2x2`, `float3` with `float3x3` |
| `math/select` | every type except `float` (no `int`, `bool`, vectors, matrices, or `ref`) |
| `math/switch` | every type except `int` |
| `variable/interpolate` | `float2`, `float3`, `float4` (with and without slerp), matrices |
| `pointer/interpolate` | everything except `float3` |
| `flow/cancelDelay` | null and non-delay `ref` values |

For custom variables, `float2x2` and `float3x3` are never declared, and `set_and_get` does not cover `ref` or any matrix type. For custom events, only `float`, `int`, `bool`, and `ref` value types appear.

### 2.2 Operation behavior described procedurally

These behaviors are defined in the operation procedures rather than as standalone MUST statements.

**`flow/for`.** Step 3 re-evaluates `endIndex` on every iteration, so an `endIndex` connected to a changing value alters the loop count. No test does this. There are also no tests with `startIndex >= endIndex` (the body should never run), negative ranges, or loop ranges near `INT_MAX`.

**`flow/while`.** Covered for the basic case. A condition that changes inside the body, and the interaction between `while` and `setDelay` inside the body, are not tested.

**`flow/doN`.** `n = 0`, negative `n`, and `n` changing between activations are not tested.

**`flow/multiGate`.** No node reads the `lastIndex` output, so it is never asserted. The configuration with both `isLoop` and `isRandom` true is not tested, and neither is the SHOULD-level reshuffling on each loop.

**`flow/waitAll`.** Activating the same input twice before completion (which must not decrement twice), `inputFlows: 0`, and `inputFlows: 64` are not tested.

**`flow/throttle`.** Covered for `duration` -1, but not for NaN, +Inf, or 0.

**`flow/setDelay` / `flow/cancelDelay`.** The `cancel` input flow of `setDelay` (cancel all delays from this node) versus `cancelDelay` for a single reference, cancellation of a delay that has already fired, and the `maxActiveDelays` limit leading to `err` are not tested.

**`animation/start`.** No tests for reverse playback (`startTime > endTime`), `startTime == endTime` (immediate `done`), `endTime` of ±Infinity (looping), negative requested timestamps (the wrap-around formula), animations with a maximum time of 0, or exceeding `maxActiveAnimations`.

**`animation/stopAt`.** `stopTime` outside the playback range (where the stop is ignored) and `stopAt` on an animation that isn't playing are not tested.

**`pointer/get`.** Out-of-range and negative indices are only tested through `weights`. Reading a pointer whose type doesn't match `type` (which should return `isValid` false and NaN), and reading nodes outside the current scene, are not tested.

**`pointer/set`.** No `err` path is tested: negative index, null reference, type mismatch, and read-only property should each activate `err`. The rule that `pointer/set` cancels an active interpolation on the same pointer (step 5) is also not tested.

**`pointer/interpolate`.** The `err` path for a `p1`/`p2` first component outside [0, 1], zero duration, a second interpolation on the same pointer replacing the first, and the `maxActivePropertyInterpolations` limit are not tested. The 50% check uses a tolerance of 0.1, which is too loose to verify the Bézier easing curve.

**`event/stopPropagation`.** Covered for internal events. Transitive propagation (for example through the scene graph) needs an event source that propagates, which none of the core operations provide.

**`math/matDecompose`.** The invalid-scale, zero-scale, and shear cases are covered. Matrices with a negative determinant (mirroring), where step 8 allows four alternative outputs, are not. A test for this case would need to accept any of the four permitted results.

### 2.3 Object model pointers

| Pointer group | Status |
| --- | --- |
| `/extensions/KHR_interactivity/asset/*` | Covered |
| `/extensions/KHR_interactivity/limits/*` | Covered (≥ 1 only) |
| `/extensions/KHR_interactivity/activeCamera/*` (10 pointers) | None |
| `/animations/{}/extensions/KHR_interactivity/isPlaying`, `minTime`, `maxTime`, `playhead`, `virtualPlayhead` (both `[]` and `{}` forms) | None |
| `/extensions/KHR_interactivity/delays/{}` | Covered (valid reference only) |
| `/extensions/KHR_interactivity/events/{}` | Covered |
| `/nodes/*/rotation` via any pointer operation | None |
| `/nodes/*/globalMatrix`, `/nodes/*/matrix` | Covered (`Extras/Matrix_Updates`) |

---

## 3. Edge and corner cases needing specialized test assets

These are cases where a generic test would not catch a non-conforming implementation. Each needs an asset designed for it.

### 3.1 Graph rejection and configuration fallback

This is the largest area and needs a new asset category with a new oracle format. A minimal approach: one `.glb` per invalid condition, with an oracle field such as `"expect": "reject"`. The runner then checks that loading fails. For fallback cases, the graph should be valid and observably behave as if the default configuration were used.

Priority cases, in rough order of implementation risk:

1. Forward and backward references that violate lines 5298 and 5387, including a self-reference and a cycle.
2. Node `values` missing a required socket, or with a type that doesn't match the declaration.
3. Duplicate declarations, and core operations with `inputValueSockets` defined.
4. `variable/set` with an empty `variables` array, and `variable/interpolate` targeting an `int` variable or using `useSlerp: true` on a `float3`.
5. `pointer/set` with a template that contains `{value}`.
6. Each invalid pointer template example from the specification (starting at line 3949), since these are already written and just need assets.
7. Configuration fallback: `flow/for` with `initialIndex: 1.5`, `flow/waitAll` with `inputFlows: 65`, `math/quatFromAngles` with `order: "XYZ"`, `flow/multiGate` with `isLoop: "true"` (a string).
8. `math/switch` and `flow/switch` using each of the specification's examples: `[0.5, 1]`, `[-2147483649, 0]`, `[-1.0, 0, 1]`, `[0.1e1, 2, 2]`.

### 3.2 Precision and negative zero

The current harness compares floats with a tolerance, which cannot see the sign of zero or precision loss. These cases need assertions built from exact operations:

- **Double precision.** `intToFloat(16777217)` compared with `math/eq` against an inline `16777217.0` (fails in float32). `(0.1 + 0.2) - 0.3` compared exactly to the double-precision result. Inputs must be written as exact double values, not float32 values.
- **Negative zero.** Use `math/div(1, x)` and check for `-Infinity`. Apply this to `math/round(-0.4)` (must be -0), `type/intToFloat(0)` (must not be -0), `math/neg(0.0)`, `math/abs(-0.0)`, `math/sign(-0.0)`, and `math/trunc(-0.5)`.
- **Round half-way cases.** `round(0.5) = 1`, `round(-0.5) = -1`, `round(2.5) = 3`, `round(-2.5) = -3`.

### 3.3 Integer boundaries

- `math/neg(-2147483648)` must return `-2147483648`.
- `math/abs(-2147483648)` must return `-2147483648`, since the specification defines integer absolute value in terms of negation.
- `math/div(-7, 2) = -3` and `math/rem(-7, 2) = -1` for truncation toward zero.
- `math/rem(-2147483648, -1)`.
- `type/floatToInt` with ±Infinity, values above `INT_MAX`, and -0.
- `math/clamp` with `b == c` (the `b > c` case is already tested for both `float` and `int`).

### 3.4 Scalar forms of vector operations

Because `floatN` includes `float`, `math/length(-3.0)` should return 3, `math/normalize(-3.0)` should return -1 with `isValid` true, `math/normalize(0.0)` should be invalid, and `math/dot(2.0, 3.0)` should return 6. These scalar forms are easy for an implementation to omit, and none is tested.

### 3.5 Special values in untested operations

Several operations have NaN or infinity behavior stated in their tables, but their tests use ordinary inputs only:

- `math/sin`, `cos`: ±Infinity (NaN expected).
- `math/sinh`, `cosh`, `tanh`, `asinh`: ±0, ±Infinity, NaN.
- `math/exp`: -Infinity (0 expected), +Infinity.
- `math/log2`, `log10`: 0, negative, +Infinity.
- `math/cbrt`: ±0, ±Infinity.
- `math/pow`: the specification lists changes from IEEE-754 `pow`. Each listed change needs its own sub-test.
- `math/min`, `max`: NaN arguments and -0 versus +0.
- `math/floor`, `ceil`, `fract`: ±Infinity and NaN.
- `math/isInf`: finite and NaN inputs (only ±Infinity are tested). `math/isNaN`: infinity inputs.
- `math/quatSlerp` and `math/slerp`: antipodal and nearly identical inputs.
- `math/quatFromAxisAngle`: zero-length axis.
- `math/rotate2D`: angles outside [-2π, 2π].
- `math/matCompose`: non-unit rotation quaternion.
- `math/rgbToOkLCh` / `rgbFromOkLCh`: out-of-gamut input and hue wrap-around.

### 3.6 Ordering and timing

- Multiple `event/onStart` nodes: each appends its JSON index to a variable, and the test checks the resulting order.
- `event/onTick` on the first tick: assert `timeSinceStart == 0` and `isNaN(timeSinceLastTick)`, and assert that all `onStart` handlers have already run.
- Two `event/onTick` nodes reading `timeSinceStart` in the same tick must see identical values.
- A `setDelay` with a duration of 0: the procedure activates `out` before `done` can be scheduled to run, so the test should assert that `done` never fires before `out`.

### 3.7 Animations and pointers together

- Read an animated property with `pointer/get` during playback, and compare it to the value implied by `playhead` (line 3891).
- Start an animation, then start it again before it finishes, and confirm the first `done` never fires.
- Check that an animation in the asset does not move anything before `animation/start` (line 184).
- `pointer/interpolate` on `/nodes/0/rotation` with a large rotation, checking the midpoint against slerp rather than component-wise lerp.

### 3.8 Pointer template syntax

The specification includes a full set of valid syntax examples: doubled brackets as literals, `~0` and `~1` encoding in parameter names, and a parameter used only once. Each valid example needs an asset with a matching `extras` property or a supported object, and each invalid example needs a rejection asset.

---

## 4. Test suite issues that affect coverage

These are properties of the current assets that limit what they can verify, independent of which requirements they target.

**No rejection mechanism.** Covered in the summary. This accounts for most of the uncovered statements.

**Float inputs are single precision.** Inline values such as `345.234436`, `757.003235`, and `-32434.9688` are float32 values printed as decimals. Combined with tolerance-based comparison, this makes the double-precision requirement unverifiable.

**Wide tolerances on timing tests.** Animation checks use tolerances of 0.3–0.4, and interpolation midpoint checks use 0.1. These confirm that something happened but cannot distinguish easing curves or detect small timing drift.

**Engine-specific expected values.** Several `.md` files list `UnityGLTF.Interactivity.StaticRefPointer` as an expected value (for example in `ref` results in `UserInteractions` and `pointer/CoreReadOnlyPointers_GetTests`). These are generator artifacts and are not meaningful to other implementations.

**Sub-test labels round their inputs.** Labels such as `[a] 345.23 [b] 0.00 = 1.00` (`math/mul`) and `[a] 757.00 = 758.00` (`math/ceil`) appear wrong, but the actual inputs are `0.0029` and `757.003`. The results are correct, but anyone reviewing the `.md` files would reasonably flag them as bugs.

**Ambiguous sub-test labels.** In `event/Event_Refs`, the sub-tests labeled "ref not null" expect `False`. The variable apparently stores whether the reference is null, which is the opposite of the label. There is also a typo: "onTickt wo nodes" should be "onTick two nodes".

**Locale leakage.** Log messages use a comma as the decimal separator ("Proximity range: 0,0001"), which suggests the generator ran under a non-English locale. This only affects log text, not results.

**Out-of-scope operations.** `UserInteractions/eventOnHover` and `eventOnSelect` test `KHR_node_hoverability` and `KHR_node_selectability` operations. They are useful but do not count toward `KHR_interactivity` coverage.

---

## 5. Incidental specification text issues

Found during this review, not related to test coverage:

- Line 4761 (Asset Capabilities pointer table): `<EXTENSION_MANE>` should be `<EXTENSION_NAME>`.
- Line 5244: `*MUST**` has mismatched emphasis markup.
- Line 5387: "less then" should be "less than".
- Line 4203: "if it point to" should be "if it points to".
