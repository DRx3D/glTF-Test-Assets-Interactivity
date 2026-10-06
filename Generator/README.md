# khr-itest-gen

Generator for supplemental `KHR_interactivity` test assets. It writes assets that close the coverage gaps found in the existing test suite, without modifying that suite.

- Requirements: [`Documents/KHR_interactivity_test_generator_spec.md`](../Documents/KHR_interactivity_test_generator_spec.md)
- Design: [`Documents/KHR_interactivity_test_generator_typescript_spec.md`](../Documents/KHR_interactivity_test_generator_typescript_spec.md)
- Build order: [`Documents/KHR_interactivity_test_generator_build_steps.md`](../Documents/KHR_interactivity_test_generator_build_steps.md)

## Status

Milestones M1 (foundations) and M2 (data and reference) of six. M2's gate waits on two working-group decisions; see [`docs/M2-gate.md`](docs/M2-gate.md). In place:

| Module             | Contents                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `src/numeric/`     | int32 and binary64 operations as the Specification defines them, number formatting, canonical JSON writer |
| `src/prng/`        | SplitMix64 and scatter values (requirements §8.10)                                                        |
| `src/asset/glb.ts` | GLB writer and reader                                                                                     |
| `src/registry/`    | Operation catalogue, target registry, interpretations, `check-registry`                                   |
| `src/existing/`    | Existing-suite reader, coverage mapping, `gaps`                                                           |
| `src/reference/`   | MPFR reference values through `gmp-wasm`                                                                  |
| `src/sampling/`    | Value classes, combination rules, packing, scatter slots, domain-specific values                          |
| `src/cli/`         | Command surface; `check-registry` and `gaps` work, `generate` and `explain` arrive in M3                  |
| `data/`            | Vendored Specification and schemas, `operations.yaml`, `registry/`, `existing-coverage.yaml`              |

## Use

Node.js 22 or later.

```
npm ci
npm run ci        # type check, lint, format check, tests with coverage thresholds
npm run build     # compile to dist/
npm run cli -- --help
```

Exit codes: 0 success, 1 a requirement failed, 2 a usage error.

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
