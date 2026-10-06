# Supplemental coverage report

Generator khr-itest-gen 0.1.0; Specification c5d1e1e8; suite 9ffd30e; seed 0x4B48525F494E5445.

Copyright (c) 2026, The Khronos Group Inc.

## Counts

2 assets, 54 sub-tests.

| Category | Assets | Sub-tests |
| --- | --- | --- |
| math | 1 | 13 |
| prerequisites | 1 | 41 |

## Targets

7 covered by the existing suite, 1 by supplemental assets, 5 not covered.

| Target | Scope | Status | Covered by or reason |
| --- | --- | --- | --- |
| S-184 | in | covered-existing | animation/state / Not started:
translation unchanged |
| S-2626 | in | covered-supplemental | math/div-boundary / div(-7, 2) is -3; math/div-boundary / div(7, -2) is -3; math/div-boundary / div(-7, -2) is 3; math/div-boundary / div(7, 2) is 3; math/div-boundary / div(-1, 2) is 0; math/div-boundary / div(1, -2) is 0; math/div-boundary / div(-2147483648, 3) is -715827882; math/div-boundary / div(2147483647, -2) is -1073741823; math/div-boundary / div(-2147483647, 2) is -1073741823; math/div-boundary / div(2147483647, 2147483646) is 1; math/div-boundary / div(720519128, 7) is 102931304; math/div-boundary / div(-406091321, -3) is 135363773; math/div-boundary / div(-1265440754, 1711676100) is 0 |
| S-3203 | in | covered-existing | Extras/Float_Precision / intToFloat(-2147483647) + 2147483646 == -1; Extras/Float_Precision / intToFloat(2147483647) - 2147483646 == 1 |
| S-3205 | in | covered-existing | Extras/Float_Precision / intToFloat(0) is +0 |
| S-3891 | in | covered-existing | animation/start_playback_modes / Reverse (T..0):
position at 50%; animation/state / Not started:
translation unchanged |
| S-400 | out-rejection | not-covered | rejection target, out of scope (requirements §1.1); not in the invalid-graph set |
| S-4352 | in | covered-existing | animation/start_playback_modes / Restart: 1st
[done] not fired |
| S-4423 | in | covered-existing | animation/stop / Position frozen 
at ~50%; animation/stop / Start [done] 
not fired; animation/stop_and_stopAt_edge_cases / stop, not playing:
[out] |
| S-4894 | out-impractical | not-covered | impractical to test |
| S-4898 | out-rejection | not-covered | rejection target, out of scope (requirements §1.1); covered by invalid-graph cases |
| S-568 | in | covered-existing | Extras/Float_Precision / round(-0.3) is -0; Extras/Float_Precision / round(0.49999999999999994) == 0; math/round / [a] -2.50 = -3.00; math/round / [a] 0.50 = 1.00; math/round / [a] 1.50 = 2.00; math/round / [a] 2.50 = 3.00 |
| T-math/div-float2 | in | not-covered | vector and matrix results need component extraction in the harness (R1); planned for M4 |
| T-math/div-float4x4 | in | not-covered | vector and matrix results need component extraction in the harness (R1); planned for M4 |

## Type and value-class matrix (supplemental)

| Operation | Input types | Value classes |
| --- | --- | --- |
| math/Inf | - | infinity |
| math/NaN | - | nan |
| math/abs | float | infinity, ordinary, zero |
| math/and | bool,bool | bool |
| math/div | float,float | nan, zero |
| math/div | int,int | inexact, limit, negative, scatter |
| math/eq | bool,bool | bool |
| math/eq | float,float | infinity, nan, ordinary, zero |
| math/eq | int,int | limit, ordinary |
| math/isNaN | float | infinity, nan, ordinary |
| math/le | float,float | infinity, ordinary, zero |
| math/lt | float,float | infinity |
| math/max | float,float | infinity, ordinary |
| math/mul | float,float | ordinary, tolerance |
| math/neg | float | infinity, zero |
| math/not | bool | bool |
| math/sub | float,float | ordinary, zero |

## Existing credits

15 sub-test credits and 3 invalid-case credits; the JSON report lists each one.

## Review required

None.

## Adapter disagreements

None recorded (no adapter run).
