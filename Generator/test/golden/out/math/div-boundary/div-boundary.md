### **Test Sample:** math/div-boundary
### **Description:** Integer division truncates toward zero, including inexact negative quotients and int32 limits.

### Tests:
| Sub Test | Result Var.Name | Result Var.Id | Expected Value | Spec refs |
| ----------- | ----------- | ----------- | ----------- | ----------- |
| div(-7, 2) is -3 | TestResult_math/div-boundary_div(-7, 2) is -3 | 1 | -3 | Math operations (line 2626) |
| div(7, -2) is -3 | TestResult_math/div-boundary_div(7, -2) is -3 | 3 | -3 | Math operations (line 2626) |
| div(-7, -2) is 3 | TestResult_math/div-boundary_div(-7, -2) is 3 | 5 | 3 | Math operations (line 2626) |
| div(7, 2) is 3 | TestResult_math/div-boundary_div(7, 2) is 3 | 7 | 3 | Math operations (line 2626) |
| div(-1, 2) is 0 | TestResult_math/div-boundary_div(-1, 2) is 0 | 9 | 0 | Math operations (line 2626) |
| div(1, -2) is 0 | TestResult_math/div-boundary_div(1, -2) is 0 | 11 | 0 | Math operations (line 2626) |
| div(-2147483648, 3) is -715827882 | TestResult_math/div-boundary_div(-2147483648, 3) is -715827882 | 13 | -715827882 | Math operations (line 2626) |
| div(2147483647, -2) is -1073741823 | TestResult_math/div-boundary_div(2147483647, -2) is -1073741823 | 15 | -1073741823 | Math operations (line 2626) |
| div(-2147483647, 2) is -1073741823 | TestResult_math/div-boundary_div(-2147483647, 2) is -1073741823 | 17 | -1073741823 | Math operations (line 2626) |
| div(2147483647, 2147483646) is 1 | TestResult_math/div-boundary_div(2147483647, 2147483646) is 1 | 19 | 1 | Math operations (line 2626) |
| div(720519128, 7) is 102931304 | TestResult_math/div-boundary_div(720519128, 7) is 102931304 | 21 | 102931304 | Math operations (line 2626) |
| div(-406091321, -3) is 135363773 | TestResult_math/div-boundary_div(-406091321, -3) is 135363773 | 23 | 135363773 | Math operations (line 2626) |
| div(-1265440754, 1711676100) is 0 | TestResult_math/div-boundary_div(-1265440754, 1711676100) is 0 | 25 | 0 | Math operations (line 2626) |

Schemas used in this test case:
- event/onStart
- event/send
- flow/branch
- flow/sequence
- math/and
- math/div
- math/eq
- pointer/set
- variable/get
- variable/set

---

Copyright (c) 2026, The Khronos Group Inc.

Licensed under CC BY 4.0 International.
