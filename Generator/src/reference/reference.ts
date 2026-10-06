// High-precision reference values for transcendental functions (requirements §9.3; project
// spec section 7). Values are computed in MPFR through gmp-wasm, an external npm dependency
// (LGPL-3.0) used unmodified and loaded only here, and rounded once to the nearest binary64.
//
// Callers pass ordinary inputs. Special-value rows of the Specification's definition tables
// (NaN, ±Infinity, ±0, domain edges) are resolved from those tables, not by this module.

import { init, type CalculateTypeWithDestroy, type GMPLib } from 'gmp-wasm';
import type { F64 } from '../numeric/value.js';

export const UNARY_FUNCTIONS = [
  'exp',
  'exp2',
  'log',
  'log2',
  'log10',
  'sqrt',
  'cbrt',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
] as const;
export const BINARY_FUNCTIONS = ['pow', 'atan2', 'hypot'] as const;

export type UnaryFunction = (typeof UNARY_FUNCTIONS)[number];
export type BinaryFunction = (typeof BINARY_FUNCTIONS)[number];
export type RefFunction = UnaryFunction | BinaryFunction;

export interface ReferenceOptions {
  /** Starting precision in bits; at least 128 (requirements §9.3). */
  readonly precisionBits?: number;
  /** Highest precision tried before giving up (project spec section 7.2). */
  readonly maxPrecisionBits?: number;
}

export class ReferenceError extends Error {}

/**
 * The MPFR float operations used here. gmp-wasm declares its Float type through a ReturnType
 * chain that TypeScript cannot resolve, so the methods are described locally.
 */
interface FloatType {
  add(v: FloatType | number): FloatType;
  sub(v: FloatType | number): FloatType;
  mul(v: FloatType | number): FloatType;
  div(v: FloatType | number): FloatType;
  pow(v: FloatType | number): FloatType;
  sqrt(): FloatType;
  cbrt(): FloatType;
  exp(): FloatType;
  exp2(): FloatType;
  ln(): FloatType;
  log2(): FloatType;
  log10(): FloatType;
  sin(): FloatType;
  cos(): FloatType;
  tan(): FloatType;
  asin(): FloatType;
  acos(): FloatType;
  atan(): FloatType;
  sinh(): FloatType;
  cosh(): FloatType;
  tanh(): FloatType;
  asinh(): FloatType;
  acosh(): FloatType;
  atanh(): FloatType;
  isZero(): boolean;
  lessThan(v: number): boolean;
  greaterThan(v: number): boolean;
  toNumber(): number;
}

interface Ctx {
  Float(value: number): FloatType;
  Pi(): FloatType;
  destroy(): void;
}

const asCtx = (ctx: CalculateTypeWithDestroy): Ctx => ctx as unknown as Ctx;

const unary: Readonly<Record<UnaryFunction, (x: FloatType) => FloatType>> = {
  exp: (x) => x.exp(),
  exp2: (x) => x.exp2(),
  log: (x) => x.ln(),
  log2: (x) => x.log2(),
  log10: (x) => x.log10(),
  sqrt: (x) => x.sqrt(),
  cbrt: (x) => x.cbrt(),
  sin: (x) => x.sin(),
  cos: (x) => x.cos(),
  tan: (x) => x.tan(),
  asin: (x) => x.asin(),
  acos: (x) => x.acos(),
  atan: (x) => x.atan(),
  sinh: (x) => x.sinh(),
  cosh: (x) => x.cosh(),
  tanh: (x) => x.tanh(),
  asinh: (x) => x.asinh(),
  acosh: (x) => x.acosh(),
  atanh: (x) => x.atanh(),
};

/**
 * atan2 and hypot are not in gmp-wasm's Float API, so they are built from MPFR primitives at
 * the working precision; the precision check in `reference` covers any loss in these steps.
 */
const binary: Readonly<Record<BinaryFunction, (ctx: Ctx, a: FloatType, b: FloatType) => FloatType>> = {
  pow: (_ctx, a, b) => a.pow(b),
  atan2: (ctx, y, x) => {
    if (x.isZero()) {
      return ctx.Pi().div(y.lessThan(0) ? -2 : 2);
    }
    const base = y.div(x).atan();
    if (x.greaterThan(0)) return base;
    return y.lessThan(0) ? base.sub(ctx.Pi()) : base.add(ctx.Pi());
  },
  hypot: (_ctx, a, b) => a.mul(a).add(b.mul(b)).sqrt(),
};

const isUnary = (fn: RefFunction): fn is UnaryFunction => (UNARY_FUNCTIONS as readonly string[]).includes(fn);

export class GmpReference {
  private constructor(private readonly lib: GMPLib) {}

  /** Loads the MPFR WebAssembly module (from node_modules; no network access). */
  static async create(): Promise<GmpReference> {
    return new GmpReference(await init());
  }

  /** One evaluation at a fixed precision, rounded to the nearest binary64. */
  evaluateAt(fn: RefFunction, args: readonly F64[], precisionBits: number): F64 {
    const expected = isUnary(fn) ? 1 : 2;
    if (args.length !== expected) {
      throw new RangeError(`${fn} takes ${expected} argument(s), got ${args.length}`);
    }
    const ctx = asCtx(this.lib.getContext({ precisionBits }));
    try {
      // Float(number) is exact: every binary64 value fits in 53 bits.
      const [a, b] = args.map((x) => ctx.Float(x));
      if (a === undefined) throw new RangeError('missing argument');
      const result = isUnary(fn) ? unary[fn](a) : binary[fn](ctx, a, b ?? a);
      return result.toNumber();
    } finally {
      ctx.destroy();
    }
  }

  /**
   * The binary64 value nearest to `factor` × π, where `factor` is exact (an integer or a
   * dyadic fraction such as 0.5). Used for argument-reduction samples (requirements §8.3).
   */
  piTimes(factor: number, options: ReferenceOptions = {}): F64 {
    const start = options.precisionBits ?? 128;
    const max = options.maxPrecisionBits ?? 1024;
    const at = (bits: number): F64 => {
      const ctx = asCtx(this.lib.getContext({ precisionBits: bits }));
      try {
        return ctx.Pi().mul(ctx.Float(factor)).toNumber();
      } finally {
        ctx.destroy();
      }
    };
    let previous = at(start);
    for (let bits = start * 2; bits <= max; bits *= 2) {
      const current = at(bits);
      if (Object.is(current, previous)) return current;
      previous = current;
    }
    throw new ReferenceError(`pi * ${factor} did not settle by ${max} bits`);
  }

  /**
   * The reference value: evaluated at `precisionBits` and again at twice that, doubling until
   * two successive results round to the same binary64 (Ziv's strategy). Throws ReferenceError
   * if `maxPrecisionBits` does not settle, rather than return a doubtful value.
   */
  reference(fn: RefFunction, args: readonly F64[], options: ReferenceOptions = {}): F64 {
    const start = options.precisionBits ?? 128;
    const max = options.maxPrecisionBits ?? 1024;
    if (start < 128) {
      throw new RangeError('reference precision must be at least 128 bits (requirements §9.3)');
    }
    let previous = this.evaluateAt(fn, args, start);
    for (let bits = start * 2; bits <= max; bits *= 2) {
      const current = this.evaluateAt(fn, args, bits);
      if (Object.is(current, previous)) {
        return current;
      }
      previous = current;
    }
    throw new ReferenceError(`${fn}(${args.join(', ')}) did not settle by ${max} bits`);
  }
}
