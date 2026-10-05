import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SEED,
  scatterF64FromBits,
  scatterInt32FromBits,
  SplitMix64,
} from '../../src/prng/splitmix64.js';

interface Fixture {
  outputs: Record<'0' | 'default', string[]>;
}
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/splitmix64.json', import.meta.url), 'utf8'),
) as Fixture;

const take = (rng: SplitMix64, n: number): string[] =>
  Array.from({ length: n }, () => `0x${rng.next().toString(16).padStart(16, '0')}`);

describe('SplitMix64', () => {
  it('reproduces the independent Python implementation for seed 0', () => {
    expect(take(new SplitMix64(0n), 16)).toEqual(fixture.outputs['0']);
  });

  it('first output for seed 0 is the published reference value 0xe220a8397b1dcdaf', () => {
    expect(new SplitMix64(0n).next()).toBe(0xe220a8397b1dcdafn);
  });

  it('reproduces the fixture for the default seed "KHR_INTE" (requirements §5.2)', () => {
    expect(DEFAULT_SEED).toBe(0x4b48525f494e5445n);
    expect(take(new SplitMix64(), 16)).toEqual(fixture.outputs.default);
  });

  it('rejects seeds outside the unsigned 64-bit range', () => {
    expect(() => new SplitMix64(-1n)).toThrow(RangeError);
    expect(() => new SplitMix64(1n << 64n)).toThrow(RangeError);
    expect(() => new SplitMix64((1n << 64n) - 1n)).not.toThrow();
  });
});

describe('scatter values (requirements §8.10)', () => {
  it('maps bits to sign, exponent and mantissa, and rejects Infinity and NaN patterns', () => {
    expect(scatterF64FromBits(0x3ff0000000000000n)).toBe(1);
    expect(Object.is(scatterF64FromBits(0x8000000000000000n), -0)).toBe(true);
    expect(scatterF64FromBits(0x0000000000000001n)).toBe(5e-324);
    expect(scatterF64FromBits(0x7ff0000000000000n)).toBeUndefined();
    expect(scatterF64FromBits(0xfff8000000000000n)).toBeUndefined();
  });

  it('never returns Infinity or NaN, redrawing when needed', () => {
    const rng = new SplitMix64();
    // With 1/2048 of draws rejected, 20,000 draws exercise the redraw path deterministically.
    for (let i = 0; i < 20_000; i++) {
      expect(Number.isFinite(rng.scatterF64())).toBe(true);
    }
  });

  it("scatter int32 is the low 32 bits as two's complement", () => {
    expect(scatterInt32FromBits(0xffffffff80000000n)).toBe(-2147483648);
    expect(scatterInt32FromBits(0x123456789n)).toBe(0x23456789);
    const rng = new SplitMix64(0n);
    expect(rng.scatterInt32()).toBe(Number(BigInt.asIntN(32, 0xe220a8397b1dcdafn)));
  });
});
