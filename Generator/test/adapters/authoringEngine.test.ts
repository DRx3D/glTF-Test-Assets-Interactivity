// The M3 slice on the authoring tool's engine (build steps, M3 gate). Every sub-test of the
// golden output must pass in the graph and the graph must report test/onSuccess.

import { beforeAll, describe, expect, it } from 'vitest';
import {
  loadAuthoringEngine,
  runOnAuthoringEngine,
  type EngineRun,
} from '../../src/adapters/authoringEngine.js';
import { INDICATOR_COLOURS } from '../../src/graph/harness.js';
import { goldenRun } from '../golden/run.js';

const runs = new Map<string, EngineRun>();
beforeAll(async () => {
  const mod = await loadAuthoringEngine();
  if (mod === undefined) throw new Error('@khronosgroup/gltf-interactivity-engine is not installed');
  for (const b of (await goldenRun()).built)
    runs.set(b.index.name, runOnAuthoringEngine(mod, b.glb, b.oracle));
});

describe('authoring tool engine', () => {
  it('runs both slice assets', () => {
    expect([...runs.keys()]).toEqual(['math/div-boundary', 'prerequisites/harness-types']);
  });

  it('passes every sub-test in the graph', () => {
    const failed = [...runs].flatMap(([asset, r]) =>
      r.subTests
        .filter((st) => !st.passed)
        .map((st) => `${asset} / ${st.name} (actual ${String(st.actual)})`),
    );
    expect(failed).toEqual([]);
  });

  it('needs only the event-values workaround (Documents/.issues.md, issue 12)', () => {
    for (const r of runs.values()) {
      expect(r.workarounds).toEqual([
        'event test/onSuccess: added empty values for event/send',
        'event test/onFailed: added empty values for event/send',
      ]);
    }
  });

  it('sends test/onStart and then test/onSuccess, once each', () => {
    for (const r of runs.values()) expect(r.events).toEqual(['test/onStart', 'test/onSuccess']);
  });

  it('turns every indicator green', () => {
    for (const r of runs.values()) {
      for (const colour of r.indicators) expect(colour).toEqual([...INDICATOR_COLOURS.pass]);
    }
  });
});
