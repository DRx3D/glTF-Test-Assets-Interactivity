// SplitMix64 pseudo-random number generator, exactly as requirements §8.10 defines it.

import { fromBits } from '../numeric/f64.js';
import { int, type F64, type Int32 } from '../numeric/value.js';

const M64 = (1n << 64n) - 1n;

/** Default seed: the ASCII bytes of "KHR_INTE" (requirements §5.2). */
export const DEFAULT_SEED = 0x4b48525f494e5445n;

/**
 * Maps one 64-bit output to a scatter float (requirements §8.10): bit 63 is the sign,
 * bits 52-62 the biased exponent, bits 0-51 the mantissa. Returns undefined for the
 * Infinity and NaN patterns (exponent all ones), which must be redrawn.
 */
export const scatterF64FromBits = (bits: bigint): F64 | undefined =>
  ((bits >> 52n) & 0x7ffn) === 0x7ffn ? undefined : fromBits(bits);

/** Maps one 64-bit output to a scatter int32: the low 32 bits as two's complement. */
export const scatterInt32FromBits = (bits: bigint): Int32 => int(Number(BigInt.asIntN(32, bits)));

export class SplitMix64 {
  private state: bigint;

  constructor(seed: bigint = DEFAULT_SEED) {
    if (seed < 0n || seed > M64) {
      throw new RangeError('seed must be an unsigned 64-bit integer');
    }
    this.state = seed;
  }

  /** The next 64-bit output. */
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & M64;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
    return z ^ (z >> 31n);
  }

  /** A scatter float; Infinity and NaN patterns are discarded and redrawn. */
  scatterF64(): F64 {
    for (;;) {
      const value = scatterF64FromBits(this.next());
      if (value !== undefined) {
        return value;
      }
    }
  }

  /** A scatter int32. */
  scatterInt32(): Int32 {
    return scatterInt32FromBits(this.next());
  }
}
