// Option parsing and validation for the CLI (project spec section 14). Kept separate from
// the commander wiring so it can be unit tested.

import { DEFAULT_SEED } from '../prng/splitmix64.js';

export class UsageError extends Error {}

const U64_MAX = 0xffffffffffffffffn;

/** Parses a seed given in hex (`0x…`) or decimal; must fit an unsigned 64-bit integer. */
export function parseSeed(text: string | undefined): bigint {
  if (text === undefined) {
    return DEFAULT_SEED;
  }
  if (!/^(0x[0-9a-f]+|\d+)$/i.test(text)) {
    throw new UsageError(`invalid seed "${text}": use decimal or 0x-prefixed hex`);
  }
  const seed = BigInt(text);
  if (seed > U64_MAX) {
    throw new UsageError(`seed ${text} does not fit in 64 bits`);
  }
  return seed;
}

/** Copyright year: required, four digits, never taken from the clock (requirements §5.3). */
export function parseCopyrightYear(text: string | undefined): number {
  if (text === undefined || !/^\d{4}$/.test(text)) {
    throw new UsageError('--copyright-year is required and must be a four-digit year');
  }
  return Number(text);
}

/** Copyright owner: required and non-empty. */
export function parseCopyrightOwner(text: string | undefined): string {
  const owner = text?.trim() ?? '';
  if (owner === '') {
    throw new UsageError('--copyright-owner is required');
  }
  return owner;
}

/** Comma-separated generator ids for `--only`. */
export function parseOnly(text: string | undefined): readonly string[] | undefined {
  if (text === undefined) {
    return undefined;
  }
  const ids = text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (ids.length === 0) {
    throw new UsageError('--only needs at least one generator id');
  }
  return ids;
}

export interface GenerateOptions {
  readonly spec: string;
  readonly suite: string;
  readonly registry: string;
  readonly out: string;
  readonly seed: bigint;
  readonly copyrightOwner: string;
  readonly copyrightYear: number;
  readonly only: readonly string[] | undefined;
  readonly verifyDeterminism: boolean;
  readonly adapter: string | undefined;
}

export interface RawGenerateOptions {
  readonly spec?: string | undefined;
  readonly suite?: string | undefined;
  readonly registry?: string | undefined;
  readonly out?: string | undefined;
  readonly seed?: string | undefined;
  readonly copyrightOwner?: string | undefined;
  readonly copyrightYear?: string | undefined;
  readonly only?: string | undefined;
  readonly verifyDeterminism?: boolean | undefined;
  readonly adapter?: string | undefined;
}

const required = (name: string, value: string | undefined): string => {
  if (value === undefined || value.trim() === '') {
    throw new UsageError(`--${name} is required`);
  }
  return value;
};

/** Validates the options of `khr-itest-gen generate`. */
export function parseGenerateOptions(raw: RawGenerateOptions): GenerateOptions {
  return {
    spec: required('spec', raw.spec),
    suite: required('suite', raw.suite),
    registry: required('registry', raw.registry),
    out: required('out', raw.out),
    seed: parseSeed(raw.seed),
    copyrightOwner: parseCopyrightOwner(raw.copyrightOwner),
    copyrightYear: parseCopyrightYear(raw.copyrightYear),
    only: parseOnly(raw.only),
    verifyDeterminism: raw.verifyDeterminism === true,
    adapter: raw.adapter,
  };
}
