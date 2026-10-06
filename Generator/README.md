# khr-itest-gen

Generator for supplemental `KHR_interactivity` test assets. It writes assets that close the coverage gaps found in the existing test suite, without modifying that suite.

- Requirements: [`Documents/KHR_interactivity_test_generator_spec.md`](../Documents/KHR_interactivity_test_generator_spec.md)
- Design: [`Documents/KHR_interactivity_test_generator_typescript_spec.md`](../Documents/KHR_interactivity_test_generator_typescript_spec.md)
- Build order: [`Documents/KHR_interactivity_test_generator_build_steps.md`](../Documents/KHR_interactivity_test_generator_build_steps.md)

## Status

Milestones M1 (foundations) and M2 (data and reference) of six are done; M3 (vertical slice) is in progress. M2's gate waits on two working-group decisions; see [`docs/M2-gate.md`](docs/M2-gate.md). In place:

| Module             | Contents                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `src/numeric/`     | int32 and binary64 operations as the Specification defines them, number formatting, canonical JSON writer |
| `src/prng/`        | SplitMix64 and scatter values (requirements §8.10)                                                        |
| `src/asset/glb.ts` | GLB writer and reader                                                                                     |
| `src/registry/`    | Operation catalogue, target registry, interpretations, `check-registry`                                   |
| `src/existing/`    | Existing-suite reader, coverage mapping, `gaps`                                                           |
| `src/reference/`   | MPFR reference values through `gmp-wasm`                                                                  |
| `src/sampling/`    | Value classes, combination rules, packing, scatter slots, domain-specific values                          |
| `src/graph/`       | Typed graph builder (forward-only order, socket ids, types), harness, comparison modes                    |
| `src/asset/`       | GLB with indicator grid, oracle, description, index, naming and splitting                                 |
| `src/generators/`  | `prerequisites` (harness operations) and `math/div` (M3 slice)                                            |
| `src/validate/`    | Self-checks V1–V9 on the in-memory staging tree                                                           |
| `src/report/`      | `supplemental-coverage.json` and `.md`                                                                    |
| `src/generate/`    | Pipeline: plan, split, name, draw, resolve, build, check; flush and determinism check                     |
| `src/adapters/`    | Authoring tool engine adapter (optional dependency)                                                       |
| `src/cli/`         | `generate`, `check-registry` and `gaps`; `explain` arrives in M4                                          |
| `data/`            | Vendored Specification and schemas, `operations.yaml`, `registry/`, `existing-coverage.yaml`              |

## Use

Node.js 22 or later.

```
npm ci
npm run ci        # type check, lint, format check, tests with coverage thresholds
npm run build     # compile to dist/
npm run cli -- --help
```

Generate the M3 slice (only two generators exist, so a full run fails V4 by design):

```
npx tsx src/cli/index.ts generate --spec c5d1e1e8 --suite ../Tests/Interactivity \
    --registry data/registry --out ./out --copyright-owner "The Khronos Group Inc." \
    --copyright-year 2026 --only "prerequisites,math/div" --verify-determinism
```

Nothing is written unless every self-check passes. In PowerShell, quote the `--only` list, or the comma splits it into separate arguments.

Exit codes: 0 success, 1 a requirement failed, 2 a usage error.

The golden test compares a reduced registry's output (`test/golden/`) byte for byte. After a reviewed change, regenerate it with `UPDATE_GOLDEN=1 npx vitest run test/golden`. The engine tests run the output on `@khronosgroup/gltf-interactivity-engine`.

## Rules that keep output exact and deterministic

The lint configuration (`eslint.config.js`) bans APIs that would make output depend on binary32 rounding, the clock, the locale or engine-specific accuracy: `Math.fround`, `Float32Array`, `Math.round`, `Math.random`, `Date`, `Intl`, `toLocaleString`, `localeCompare`, `JSON.stringify`, and the transcendental `Math` functions. Generated JSON goes through `writeCanonicalJson`, which keeps NaN, ±Infinity and -0 intact and writes keys in the order given.

`test/fixtures/splitmix64.json` comes from an independent Python implementation (`tools/make-splitmix64-fixture.py`). `test/fixtures/reference.json` comes from mpmath (`tools/make-reference-fixture.py`). To regenerate it:

```
python -m venv .venv
.venv/Scripts/pip install mpmath        # .venv/bin/pip on Linux and macOS
.venv/Scripts/python tools/make-reference-fixture.py
```

## Licence

Apache License 2.0; see [`LICENSE`](LICENSE). The generated assets are licensed separately, under the licence of the test suite.

The dependency `gmp-wasm` (GMP and MPFR compiled to WebAssembly) is LGPL-3.0. It is installed from npm, used unmodified and not bundled into this package.
