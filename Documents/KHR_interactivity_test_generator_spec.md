# KHR_interactivity Supplemental Test Asset Generator Specification

| | |
| --- | --- |
| Document status | Draft 0.1 |
| Date | 2026-09-28 |
| Target specification | `KHR_interactivity`, `Specification.adoc` at `KhronosGroup/glTF` revision `166ed85` |
| Target test suite | `KhronosGroup/glTF-Test-Assets-Interactivity` revision `0f24a49` |

This document specifies software (the _generator_) that produces supplemental `KHR_interactivity` test assets. The assets fill the coverage gaps identified in Section 1 without modifying the existing test suite.

Section 1 is informative. Section 2 defines how the rest of the document is to be read.

---

## 1. Background (Informative)

### 1.1 Purpose

The `KHR_interactivity` extension is ratified, and its test suite has at least one test for every operation it defines. A requirement-level review found that most of the specification's normative statements, many operation type signatures, and a large set of edge cases have no test coverage. This section records that review and the estimate of how many assets are needed to close the gaps. The rest of this document specifies a generator that produces those assets.

Two scope decisions made after the review apply to this version of the generator:

- **Rejection tests are excluded.** Statements whose only observable outcome is that an implementation rejects a graph are not covered. Configuration-fallback cases, where an invalid configuration causes a valid graph to use its default configuration, are included.
- **Large value spaces are sampled, not enumerated.** Where a check could involve 2^31 or more indices or values, the generator uses a spread of values across the whole range, concentrated at the boundaries.


### 1.2 Sources and method

The review compared the `KHR_interactivity` specification against the test assets in `glTF-Test-Assets-Interactivity`.

| Source | Revision |
| --- | --- |
| `KhronosGroup/glTF`, `extensions/2.0/Khronos/KHR_interactivity/Specification.adoc` (status: Complete, Ratified) | `166ed85` (2026-09-28) |
| `KhronosGroup/glTF-Test-Assets-Interactivity`, `Tests/Interactivity` | `0f24a49` (2026-07-31) |

Line numbers in this document refer to `Specification.adoc` at the revision above.

The analysis was done in two passes:

1. **Node level.** Every operation defined in the specification (135 in total) was checked against the declarations in every test `.glb`.
2. **Requirement level.** Each MUST/SHALL/REQUIRED statement was compared against the graphs, inline input values, configurations, and oracle files of the relevant tests. Where node-level coverage existed, the test contents were inspected to see which types, configurations, and special values were actually exercised.

Only the test assets under `Tests/Interactivity` were considered. The showcase models under `Models/` exercise the extension but do not check results, so they do not count as coverage here.

A test that uses an operation only as part of the harness (for example `math/eq`, `flow/branch`, or `variable/set` used to record pass/fail) is not counted as testing that operation. Coverage is credited only where a test asserts the operation's result.

### 1.3 Summary of findings

Node-level coverage is complete. All 135 operations have at least one dedicated test, and the suite reports 149 test cases with 831 sub-tests.

Requirement-level coverage is much thinner. Of the 128 normative statements assessed (the BCP 14 terminology statement is excluded), 14 are covered, 18 are partially covered, and 96 have no coverage.

The largest gap is structural. About 75 of the 96 uncovered statements require an implementation to reject an invalid graph, fall back to a default configuration, or ignore something. The test harness has no way to express these checks. Every test is a self-checking graph that must load and run in order to report a result, so no asset can verify that a graph is rejected. Closing this gap needs a second category of asset: deliberately invalid graphs with an oracle that expects rejection, and valid graphs with invalid configurations whose observable behavior shows that the default was used.

The second gap is numeric. The specification requires `float` to be IEEE-754 double precision (line 278), but the test inputs are single-precision values written out as JSON (for example `345.234436` and `-32434.9688`), and float results are compared with tolerances from 0.0001 to 0.4. An implementation using 32-bit floats would pass the entire suite. The same tolerance-based comparison means no test can distinguish `+0` from `-0`, which two MUST statements depend on.

The third gap is type breadth. Many component-wise operations are tested with scalars only, and `float2x2`/`float3x3` appear in only a few tests. Section 1.5.1 lists the untested type signatures per operation.


### 1.4 Normative statements without corresponding test assets

Status values:

- **Covered**: at least one test asserts the required behavior.
- **Partial**: some of the required behavior is asserted, but not all of it. The note says what is missing.
- **None**: no test asserts the behavior.

#### 1.4.1 Concepts

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

#### 1.4.2 Math operations

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 568 | `math/round`: half-way cases MUST round away from zero; values in (-0.5, 0) MUST round to -0 | None | Inputs are only 2.7 and -3.4. No half-way input and no negative-zero check. |
| 966 | `math/select`: `T` MUST be the same for `a`, `b`, and the output | None | Only a rejection test would exercise this. Separately, `select` is tested with `float` only (see Section 1.5.1). |
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

#### 1.4.3 Type conversion

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 3203 | `type/intToFloat` MUST be lossless | Partial | Only `intToFloat(7)`. No value above 2^24, where single precision would lose information (for example 16777217 or 2147483647). |
| 3205 | `type/intToFloat` MUST NOT produce negative zero | None | Also not detectable with the current comparison method. |

#### 1.4.4 Control flow

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

#### 1.4.5 State manipulation (variables)

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

#### 1.4.6 Object model access (pointers)

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

#### 1.4.7 Animation control

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4352 | Restarting an already playing animation MUST NOT activate the previous `done` flows | None | |
| 4353 | New animation entry: stop time MUST equal end time; stop completion MUST be null | Partial | Indirectly exercised by `animation/start` completing at end time. The interaction with a prior `stopAt` followed by a new `start` is not tested. |
| 4423 | `animation/stop`: animated properties MUST keep current values; `done` MUST NOT fire | Covered | Position frozen near 50%, `done` not fired. |

#### 1.4.8 Events

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

#### 1.4.9 Debug output

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4665 | `debug/log`: literal curly brackets in the template MUST be doubled | None | `debug/log` is used in every test, but its output is never checked. |
| 4671 | `debug/log`: invalid `severity` MUST fall back to default | None | |
| 4683 | `debug/log`: invalid `message` MUST fall back to default | None | |
| 4712 | `debug/log`: missing generated sockets MUST cause rejection | None | |
| 4714 | `debug/log`: extra sockets MUST still have valid sources | None | |
| 4725 | `debug/log`: curly brackets in substituted values MUST be doubled | None | |

Log output is implementation-facing, so verifying it would need an oracle that captures log text. The requirements are still normative and currently have no asset.

#### 1.4.10 Object model extensions

| Line | Requirement (paraphrased) | Status | Notes |
| --- | --- | --- | --- |
| 4738 | `asset/majorVersion`/`minorVersion` MUST be the minimum of the asset version and the maximum supported version | Covered | Only the common case (asset 2.0) can be tested with a normal asset. |
| 4740 | Supported extensions in `extensionsUsed` MUST appear as `asset/extensions/<name>/enabled` | Covered | Includes a negative case for an unknown extension. |
| 4774 | Runtime limit values MUST be at least 1 | Covered | |
| 4801 | Unavailable active camera data MUST be reported as NaN | None | No test reads any `activeCamera` pointer. |
| 4826 | Animation `minTime`/`maxTime` MUST come from sampler input accessor min/max, ignore unused samplers, and be NaN for invalid animations | None | No test reads any animation state pointer. |

#### 1.4.11 JSON syntax and validation

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


### 1.5 Specification content without test coverage

This part covers behavior defined by the specification that is not tied to a single MUST statement: operation type signatures, procedural steps, configuration variants, and object model pointers.

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

#### 1.5.2 Operation behavior described procedurally

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

#### 1.5.3 Object model pointers

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


### 1.6 Edge and corner cases needing specialized test assets

These are cases where a generic test would not catch a non-conforming implementation. Each needs an asset designed for it.

#### 1.6.1 Graph rejection and configuration fallback

_Note: this version of the generator excludes rejection tests. Items 1 through 6 below are therefore out of scope; items 7 and 8 are configuration-fallback cases and are in scope._

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

#### 1.6.2 Precision and negative zero

The current harness compares floats with a tolerance, which cannot see the sign of zero or precision loss. These cases need assertions built from exact operations:

- **Double precision.** `intToFloat(16777217)` compared with `math/eq` against an inline `16777217.0` (fails in float32). `(0.1 + 0.2) - 0.3` compared exactly to the double-precision result. Inputs must be written as exact double values, not float32 values.
- **Negative zero.** Use `math/div(1, x)` and check for `-Infinity`. Apply this to `math/round(-0.4)` (must be -0), `type/intToFloat(0)` (must not be -0), `math/neg(0.0)`, `math/abs(-0.0)`, `math/sign(-0.0)`, and `math/trunc(-0.5)`.
- **Round half-way cases.** `round(0.5) = 1`, `round(-0.5) = -1`, `round(2.5) = 3`, `round(-2.5) = -3`.

#### 1.6.3 Integer boundaries

- `math/neg(-2147483648)` must return `-2147483648`.
- `math/abs(-2147483648)` must return `-2147483648`, since the specification defines integer absolute value in terms of negation.
- `math/div(-7, 2) = -3` and `math/rem(-7, 2) = -1` for truncation toward zero.
- `math/rem(-2147483648, -1)`.
- `type/floatToInt` with ±Infinity, values above `INT_MAX`, and -0.
- `math/clamp` with `b == c` (the `b > c` case is already tested for both `float` and `int`).

#### 1.6.4 Scalar forms of vector operations

Because `floatN` includes `float`, `math/length(-3.0)` should return 3, `math/normalize(-3.0)` should return -1 with `isValid` true, `math/normalize(0.0)` should be invalid, and `math/dot(2.0, 3.0)` should return 6. These scalar forms are easy for an implementation to omit, and none is tested.

#### 1.6.5 Special values in untested operations

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

#### 1.6.6 Ordering and timing

- Multiple `event/onStart` nodes: each appends its JSON index to a variable, and the test checks the resulting order.
- `event/onTick` on the first tick: assert `timeSinceStart == 0` and `isNaN(timeSinceLastTick)`, and assert that all `onStart` handlers have already run.
- Two `event/onTick` nodes reading `timeSinceStart` in the same tick must see identical values.
- A `setDelay` with a duration of 0: the procedure activates `out` before `done` can be scheduled to run, so the test should assert that `done` never fires before `out`.

#### 1.6.7 Animations and pointers together

- Read an animated property with `pointer/get` during playback, and compare it to the value implied by `playhead` (line 3891).
- Start an animation, then start it again before it finishes, and confirm the first `done` never fires.
- Check that an animation in the asset does not move anything before `animation/start` (line 184).
- `pointer/interpolate` on `/nodes/0/rotation` with a large rotation, checking the midpoint against slerp rather than component-wise lerp.

#### 1.6.8 Pointer template syntax

The specification includes a full set of valid syntax examples: doubled brackets as literals, `~0` and `~1` encoding in parameter names, and a parameter used only once. Each valid example needs an asset with a matching `extras` property or a supported object, and each invalid example needs a rejection asset.


### 1.7 Test suite issues that affect coverage

These are properties of the current assets that limit what they can verify, independent of which requirements they target.

**No rejection mechanism.** Covered in Section 1.3. This accounts for most of the uncovered statements.

**Float inputs are single precision.** Inline values such as `345.234436`, `757.003235`, and `-32434.9688` are float32 values printed as decimals. Combined with tolerance-based comparison, this makes the double-precision requirement unverifiable.

**Wide tolerances on timing tests.** Animation checks use tolerances of 0.3–0.4, and interpolation midpoint checks use 0.1. These confirm that something happened but cannot distinguish easing curves or detect small timing drift.

**Engine-specific expected values.** Several `.md` files list `UnityGLTF.Interactivity.StaticRefPointer` as an expected value (for example in `ref` results in `UserInteractions` and `pointer/CoreReadOnlyPointers_GetTests`). These are generator artifacts and are not meaningful to other implementations.

**Sub-test labels round their inputs.** Labels such as `[a] 345.23 [b] 0.00 = 1.00` (`math/mul`) and `[a] 757.00 = 758.00` (`math/ceil`) appear wrong, but the actual inputs are `0.0029` and `757.003`. The results are correct, but anyone reviewing the `.md` files would reasonably flag them as bugs.

**Ambiguous sub-test labels.** In `event/Event_Refs`, the sub-tests labeled "ref not null" expect `False`. The variable apparently stores whether the reference is null, which is the opposite of the label. There is also a typo: "onTickt wo nodes" should be "onTick two nodes".

**Locale leakage.** Log messages use a comma as the decimal separator ("Proximity range: 0,0001"), which suggests the generator ran under a non-English locale. This only affects log text, not results.

**Out-of-scope operations.** `UserInteractions/eventOnHover` and `eventOnSelect` test `KHR_node_hoverability` and `KHR_node_selectability` operations. They are useful but do not count toward `KHR_interactivity` coverage.


### 1.8 Specification text issues

Found during this review, not related to test coverage:

- Line 4761 (Asset Capabilities pointer table): `<EXTENSION_MANE>` should be `<EXTENSION_NAME>`.
- Line 5244: `*MUST**` has mismatched emphasis markup.
- Line 5387: "less then" should be "less than".
- Line 4203: "if it point to" should be "if it points to".

### 1.9 Asset count estimate

The estimate below was made before the scope decisions in Section 1.1 were final. It assumes full coverage of every in-scope gap, configuration-fallback tests included, and the sampling approach later made normative in Section 8.

| Area | Assets | Sub-tests | What drives the count |
| --- | --- | --- | --- |
| Math operations (101 op ids) | ~105 | ~1,750 | Each supported type × sampled values; a few split by matrix size |
| Type conversion | 6 | ~40 | Boundary values around 2^24, 2^31, 2^53, ±0, ±Inf, NaN |
| Reference equality | 1 | ~10 | Null, same object, same index with different object type |
| Flow control | ~14 | ~110 | Configurations, `switch` case encodings, loop ranges near integer limits |
| Variables | 4 | ~60 | All 11 types, defaults, interpolation per type including slerp |
| Pointers and object model | ~12 | ~130 | Template syntax, failure paths, remaining Object Model pointers, camera and animation-state pointers |
| Animation | ~8 | ~25 | Reverse, looping, wrap-around, restart, `stopAt` ranges |
| Events | ~8 | ~30 | Activation order, first-tick values, all event value types |
| Debug log | 1–2 | ~12 | Graph runs correctly with templated messages; checking the log text itself needs the runner to capture it |
| Concepts and precision | ~5 | ~40 | Double precision, negative zero, socket value retention, type defaults |
| Configuration fallback | ~10 | ~45 | Valid graphs whose behavior shows the default configuration was used |
| **Total** | **~175** | **~2,250** | |

The figures carry an uncertainty of roughly ±30%, almost all of it in the math operations, where sampling density drives the count. Packing several sample values into the components of one vector or matrix sub-test is what keeps the math total near 2,000 rather than 5,000.

Some tests must run in an asset of their own because they depend on graph-wide state: first-tick `onTick` values, anything that exhausts a `maxActive*` limit, animation autoplay, and timing checks that other activity would disturb. Pointer tests also need several base scenes (lights, material extensions, cameras, skins, morph targets, and animations). These account for the asset count being above one per operation.

Because the generator supplements the existing suite rather than replacing it (Section 4.3), targets already covered by existing sub-tests are not generated again. Few existing sub-tests use the exact values the sampling rules call for, so the reduction comes mostly from targets rather than individual values. The supplemental output is expected to be in the range of 150–170 assets and 1,500–1,800 sub-tests. The generator's coverage report (Section 13) gives the actual figures.

---

## 2. Document Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 (RFC 2119 and RFC 8174) when, and only when, they appear in bold capitals.

Section 1, the notes marked _Informative_, and Appendix A are non-normative. All other sections are normative.

"The Specification" means the `KHR_interactivity` `Specification.adoc` at the revision named in the header table. "Spec line _N_" refers to line _N_ of that file at that revision. Where the generator records references (Section 7.4), it records the section title as well, because line numbers change between revisions.

"The existing suite" means the contents of `Tests/Interactivity` in `glTF-Test-Assets-Interactivity` at the revision named in the header table, or at a later revision supplied to the generator as input.

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
3. At startup, the graph sends the custom event `test/onStart` with an `expectedDuration` value (in seconds). `expectedDuration` **MUST** be an upper bound on the time the runner needs to tick the graph before all results are final.
4. When all sub-tests have finished, the graph sends exactly one of `test/onSuccess` (all passed) or `test/onFailed` (any failed).

**Harness operation set.** The harness **MUST** use only the following operations, except for operations that set up a sub-test's inputs: `event/onStart`, `event/onTick`, `event/send`, `flow/sequence`, `flow/branch`, `flow/setDelay`, `variable/get`, `variable/set`, `math/eq`, `math/and`, `math/not`, `math/lt`, `math/le`, `math/abs`, `math/sub`, `math/mul`, `math/max`, `math/div`, `math/neg`, `math/isNaN`, `math/Inf`, `math/NaN`, and `pointer/set` (for indicators only).

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

The oracle file **MUST** use the existing schema (`glbFileName`, `name`, `tests`, `usedSchemas`, and for each sub-test `name`, `resultVarName`, `resultVarId`, `resultVarType`, `expectedResultValue`, `successResultVarId`, `successResultVarName`). Existing runners **MUST** be able to read it without changes.

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
- The `expectedDuration` of any asset **SHOULD NOT** exceed 10 seconds.

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

## 12. Validation

Before completing, the generator **MUST** check that:

1. every asset passes the glTF Validator with no errors and validates against the `KHR_interactivity` schemas (Section 7.1);
2. every `resultVarId` and `successResultVarId` in each oracle file refers to a variable with the stated name and type in the asset;
3. every in-scope target in the registry is covered by an existing or supplemental sub-test, or is listed in the coverage report with a reason it could not be covered;
4. no supplemental sub-test duplicates an existing one (Section 11);
5. a second run with the same inputs produces identical output (Section 5.3), when invoked with a verification option.

The generator **SHOULD** provide adapters to run the supplemental assets on one or more existing `KHR_interactivity` implementations. Where an implementation's result differs from the expected value, the generator **MUST** record the difference in the coverage report and **MUST NOT** change the expected value because of it.

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
3. **`"-0"` in oracle files.** Existing runners that compare `expectedResultValue` directly will not recognize `"-0"`. Runners that use the in-graph pass/fail variables are unaffected.
4. **Index merging.** Whether `supplemental-index.json` is merged into `test-index.json` and `mathtests-index.json`, or kept separate, is for the maintainers to decide.
5. **Conditional sub-tests.** Reporting a skipped sub-test as passed keeps existing runners working but hides skips from them. The alternative is a third result state, which existing runners do not support.
6. **Extension-dependent sub-tests.** Section 10.11 uses an operation from another Khronos extension to test declaration handling. The maintainers may prefer that these sub-tests live with that extension's tests.
7. **Existing suite issues.** Section 1.7 lists issues in the existing assets, such as engine-specific expected values and a reversed sub-test label. This generator does not correct them (Section 4.3); they need to be fixed in the existing generator.
