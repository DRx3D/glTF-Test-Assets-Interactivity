import { describe, expect, it } from 'vitest';
import {
  parseCopyrightOwner,
  parseCopyrightYear,
  parseGenerateOptions,
  parseOnly,
  parseSeed,
  UsageError,
} from '../../src/cli/options.js';
import { DEFAULT_SEED } from '../../src/prng/splitmix64.js';

describe('parseSeed', () => {
  it('defaults to the KHR_INTE seed and accepts hex or decimal', () => {
    expect(parseSeed(undefined)).toBe(DEFAULT_SEED);
    expect(parseSeed('0x4B48525F494E5445')).toBe(DEFAULT_SEED);
    expect(parseSeed('42')).toBe(42n);
    expect(parseSeed('18446744073709551615')).toBe((1n << 64n) - 1n);
  });
  it.each(['-1', '1.5', 'abc', '0x', '18446744073709551616'])('rejects %s', (text) => {
    expect(() => parseSeed(text)).toThrow(UsageError);
  });
});

describe('copyright and --only', () => {
  it('requires a four-digit year and a non-empty owner', () => {
    expect(parseCopyrightYear('2026')).toBe(2026);
    expect(() => parseCopyrightYear(undefined)).toThrow(UsageError);
    expect(() => parseCopyrightYear('26')).toThrow(UsageError);
    expect(parseCopyrightOwner(' Khronos ')).toBe('Khronos');
    expect(() => parseCopyrightOwner('  ')).toThrow(UsageError);
    expect(() => parseCopyrightOwner(undefined)).toThrow(UsageError);
  });
  it('splits --only', () => {
    expect(parseOnly(undefined)).toBeUndefined();
    expect(parseOnly('math/round, flow/for')).toEqual(['math/round', 'flow/for']);
    expect(() => parseOnly(' , ')).toThrow(UsageError);
  });
});

describe('parseGenerateOptions', () => {
  const base = {
    spec: 'data/spec/Specification.adoc',
    suite: '../Tests/Interactivity',
    registry: 'data/registry',
    out: './out',
    copyrightOwner: 'Owner',
    copyrightYear: '2026',
  };
  it('validates a complete option set', () => {
    expect(parseGenerateOptions(base)).toEqual({
      ...base,
      seed: DEFAULT_SEED,
      copyrightYear: 2026,
      only: undefined,
      verifyDeterminism: false,
      adapter: undefined,
    });
  });
  it('reports the first missing required option', () => {
    expect(() => parseGenerateOptions({ ...base, spec: undefined })).toThrow(/--spec/);
    expect(() => parseGenerateOptions({ ...base, out: ' ' })).toThrow(/--out/);
  });
});
