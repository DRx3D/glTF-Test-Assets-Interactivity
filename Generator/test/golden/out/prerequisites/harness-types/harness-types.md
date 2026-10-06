### **Test Sample:** prerequisites/harness-types
### **Description:** Harness operations the supplemental assets rely on, on each input type they use. Run before the other supplemental assets.

### Tests:
| Sub Test | Result Var.Name | Result Var.Id | Expected Value | Spec refs |
| ----------- | ----------- | ----------- | ----------- | ----------- |
| NaN() is NaN | TestResult_prerequisites/harness-types_NaN() is NaN | 1 | NaN | math/NaN (line 466) |
| Inf() is Infinity | TestResult_prerequisites/harness-types_Inf() is Infinity | 3 | Infinity | math/Inf (line 452) |
| isNaN(NaN) is true | TestResult_prerequisites/harness-types_isNaN(NaN) is true | 5 | true | math/isNaN (line 927) |
| isNaN(1.25) is false | TestResult_prerequisites/harness-types_isNaN(1.25) is false | 7 | false | math/isNaN (line 927) |
| isNaN(Infinity) is false | TestResult_prerequisites/harness-types_isNaN(Infinity) is false | 9 | false | math/isNaN (line 927) |
| not(true) is false | TestResult_prerequisites/harness-types_not(true) is false | 11 | false | math/not (line 2934) |
| not(false) is true | TestResult_prerequisites/harness-types_not(false) is true | 13 | true | math/not (line 2934) |
| and(true, true) is true | TestResult_prerequisites/harness-types_and(true, true) is true | 15 | true | math/and (line 2945) |
| and(true, false) is false | TestResult_prerequisites/harness-types_and(true, false) is false | 17 | false | math/and (line 2945) |
| and(false, true) is false | TestResult_prerequisites/harness-types_and(false, true) is false | 19 | false | math/and (line 2945) |
| eq(7, 7) is true | TestResult_prerequisites/harness-types_eq(7, 7) is true | 21 | true | math/eq (line 2722) |
| eq(7, -7) is false | TestResult_prerequisites/harness-types_eq(7, -7) is false | 23 | false | math/eq (line 2722) |
| eq(-2147483648, -2147483648) is true | TestResult_prerequisites/harness-types_eq(-2147483648, -2147483648) is true | 25 | true | math/eq (line 2722) |
| eq(true, true) is true | TestResult_prerequisites/harness-types_eq(true, true) is true | 27 | true | math/eq (line 2922) |
| eq(false, true) is false | TestResult_prerequisites/harness-types_eq(false, true) is false | 29 | false | math/eq (line 2922) |
| eq(1.25, 1.25) is true | TestResult_prerequisites/harness-types_eq(1.25, 1.25) is true | 31 | true | math/eq (line 863) |
| eq(Infinity, Infinity) is true | TestResult_prerequisites/harness-types_eq(Infinity, Infinity) is true | 33 | true | math/eq (line 863) |
| eq(0.0, -0) is true | TestResult_prerequisites/harness-types_eq(0.0, -0) is true | 35 | true | math/eq (line 863) |
| eq(NaN, NaN) is false | TestResult_prerequisites/harness-types_eq(NaN, NaN) is false | 37 | false | math/eq (line 863) |
| le(1.25, 7.0) is true | TestResult_prerequisites/harness-types_le(1.25, 7.0) is true | 39 | true | math/le (line 889) |
| le(7.0, 7.0) is true | TestResult_prerequisites/harness-types_le(7.0, 7.0) is true | 41 | true | math/le (line 889) |
| le(7.0, 1.25) is false | TestResult_prerequisites/harness-types_le(7.0, 1.25) is false | 43 | false | math/le (line 889) |
| le(-0, 0.0) is true | TestResult_prerequisites/harness-types_le(-0, 0.0) is true | 45 | true | math/le (line 889) |
| le(1.7976931348623157e+308, Infinity) is true | TestResult_prerequisites/harness-types_le(1.7976931348623157e+308, Infinity) is true | 47 | true | math/le (line 889) |
| lt(-Infinity, -1.7976931348623157e+308) is true | TestResult_prerequisites/harness-types_lt(-Infinity, -1.7976931348623157e+308) is true | 49 | true | math/lt (line 877) |
| max(1.25, 7.0) is 7.0 | TestResult_prerequisites/harness-types_max(1.25, 7.0) is 7.0 | 51 | 7.0 | math/max (line 736) |
| max(-Infinity, 1.25) is 1.25 | TestResult_prerequisites/harness-types_max(-Infinity, 1.25) is 1.25 | 53 | 1.25 | math/max (line 736) |
| mul(1.25, 4.0) is 5.0 | TestResult_prerequisites/harness-types_mul(1.25, 4.0) is 5.0 | 55 | 5.0 | math/mul (line 642) |
| mul(1e-12, 7.0) is 7e-12 | TestResult_prerequisites/harness-types_mul(1e-12, 7.0) is 7e-12 | 57 | 7e-12 | math/mul (line 642) |
| sub(7.0, 1.25) is 5.75 | TestResult_prerequisites/harness-types_sub(7.0, 1.25) is 5.75 | 59 | 5.75 | math/sub (line 627) |
| sub(1.25, 1.25) is 0.0 | TestResult_prerequisites/harness-types_sub(1.25, 1.25) is 0.0 | 61 | 0.0 | math/sub (line 627) |
| abs(-1.25) is 1.25 | TestResult_prerequisites/harness-types_abs(-1.25) is 1.25 | 63 | 1.25 | math/abs (line 480) |
| abs(-0) is 0.0 | TestResult_prerequisites/harness-types_abs(-0) is 0.0 | 65 | 0.0 | math/abs (line 480) |
| abs(-Infinity) is Infinity | TestResult_prerequisites/harness-types_abs(-Infinity) is Infinity | 67 | Infinity | math/abs (line 480) |
| div(1.0, 0.0) is Infinity | TestResult_prerequisites/harness-types_div(1.0, 0.0) is Infinity | 69 | Infinity | math/div (line 665) |
| div(-1.0, 0.0) is -Infinity | TestResult_prerequisites/harness-types_div(-1.0, 0.0) is -Infinity | 71 | -Infinity | math/div (line 665) |
| div(1.0, -0) is -Infinity | TestResult_prerequisites/harness-types_div(1.0, -0) is -Infinity | 73 | -Infinity | math/div (line 665) |
| div(0.0, 0.0) is NaN | TestResult_prerequisites/harness-types_div(0.0, 0.0) is NaN | 75 | NaN | math/div (line 665) |
| neg(0.0) is -0 | TestResult_prerequisites/harness-types_neg(0.0) is -0 | 77 | -0 | math/neg (line 599) |
| neg(-0) is 0.0 | TestResult_prerequisites/harness-types_neg(-0) is 0.0 | 79 | 0.0 | math/neg (line 599) |
| neg(Infinity) is -Infinity | TestResult_prerequisites/harness-types_neg(Infinity) is -Infinity | 81 | -Infinity | math/neg (line 599) |

Schemas used in this test case:
- event/onStart
- event/send
- flow/branch
- flow/sequence
- math/Inf
- math/NaN
- math/abs
- math/and
- math/div
- math/eq
- math/isNaN
- math/le
- math/lt
- math/max
- math/mul
- math/neg
- math/not
- math/sub
- pointer/set
- variable/get
- variable/set

---

Copyright (c) 2026, The Khronos Group Inc.

Licensed under CC BY 4.0 International.
