// Builds the files for one resolved asset (project spec section 4, `BuiltAsset`).

import { buildHarness, interactivityExtension, type HarnessResult } from '../graph/harness.js';
import type { OperationCatalogue } from '../registry/catalogue.js';
import { assetGeneratorString } from '../version.js';
import { descriptionMarkdown } from './description.js';
import { buildGlb } from './gltf.js';
import { testName, type ResolvedAsset } from './model.js';
import { oracleJson, usedSchemas } from './oracle.js';
import type { IndexEntry } from './supplementalIndex.js';

export interface BuildContext {
  readonly catalogue: OperationCatalogue;
  readonly seed: bigint;
  /** `Copyright (c) YYYY, Owner`. */
  readonly copyright: string;
}

export interface BuiltAsset {
  readonly asset: ResolvedAsset;
  readonly harness: HarnessResult;
  readonly glb: Uint8Array;
  readonly oracle: string;
  readonly description: string;
  readonly index: IndexEntry;
  /** POSIX paths relative to the output root (requirements §6.1). */
  readonly paths: { readonly glb: string; readonly oracle: string; readonly description: string };
}

export const copyrightLine = (year: number, owner: string): string => `Copyright (c) ${year}, ${owner}`;

export function buildAsset(asset: ResolvedAsset, ctx: BuildContext): BuiltAsset {
  const harness = buildHarness(ctx.catalogue, asset.subTests, {
    testName: testName(asset),
    expectedDuration: asset.expectedDuration,
  });
  const glb = buildGlb({
    generator: assetGeneratorString(),
    copyright: ctx.copyright,
    sceneName: asset.name,
    indicatorNames: asset.subTests.map((st) => st.name),
    interactivity: interactivityExtension(harness.graph),
  });
  const dir = `${asset.category}/${asset.name}`;
  return {
    asset,
    harness,
    glb,
    oracle: oracleJson({ asset, harness, seed: ctx.seed }),
    description: descriptionMarkdown(asset, harness, ctx.copyright),
    index: { name: testName(asset), assetName: asset.name, tags: usedSchemas(harness) },
    paths: {
      glb: `${dir}/glTF-Binary/${asset.name}.glb`,
      oracle: `${dir}/test-Json/${asset.name}.json`,
      description: `${dir}/${asset.name}.md`,
    },
  };
}
