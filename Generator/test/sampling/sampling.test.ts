import { describe, expect, it } from 'vitest';
import { fromBits, sameBits } from '../../src/numeric/f64.js';
import { int } from '../../src/numeric/value.js';
import { SplitMix64 } from '../../src/prng/splitmix64.js';
import {
  CHECKED,
  FLOAT_CLASSES,
  floatSamples,
  INT_CLASSES,
  intSamples,
  OUT_OF_INT32_FLOATS,
  SHIFT_COUNTS,
} from '../../src/sampling/classes.js';
import {
  checkEnumeration,
  MANDATORY_INT_PAIRS,
  samplesFor,
  type InputValue,
  type SampleTuple,
  type ScatterSlot,
} from '../../src/sampling/combine.js';
import { allComponentsDistinct, pack } from '../../src/sampling/pack.js';
import { fillScatterSlots } from '../../src/sampling/slots.js';

const valueOf = (v: InputValue | undefined): unknown =>
  v === undefined || v.kind === 'scatter' ? v : v.value;

describe('value classes (requirements §8.2, §8.4, §8.5)', () => {
  it('decimal spellings match their bit patterns', () => {
    for (const [name, { decimal, bits }] of Object.entries(CHECKED)) {
      expect(sameBits(Number(decimal), fromBits(BigInt(`0x${bits}`))), name).toBe(true);
    }
  });

  it('contain the required boundaries', () => {
    expect(FLOAT_CLASSES.zero?.some((x) => Object.is(x, -0))).toBe(true);
    expect(FLOAT_CLASSES.subnormal).toContain(5e-324);
    expect(FLOAT_CLASSES.halfway).toContain(0.49999999999999994);
    expect(FLOAT_CLASSES.intBoundary).toContain(9007199254740994);
    expect(FLOAT_CLASSES.intBoundary).toContain(-16777217);
    expect(FLOAT_CLASSES.decade).toContain(1e-300);
    expect(FLOAT_CLASSES.max).toContain(-Number.MAX_VALUE);
    expect(FLOAT_CLASSES.nan?.[0]).toBeNaN();
    expect(INT_CLASSES.limit).toEqual([2147483646, 2147483647, -2147483647, -2147483648]);
    expect(SHIFT_COUNTS).toHaveLength(12);
    expect(OUT_OF_INT32_FLOATS).toContain(-2147483649);
  });

  it('merges values that belong to several classes and flags graph-produced values', () => {
    const half = floatSamples().find((s) => s.value === 0.5);
    expect(half?.classes).toEqual(['unit', 'halfway']);
    const negZero = floatSamples().find((s) => Object.is(s.value, -0));
    expect(negZero?.graphProduced).toBe(true);
    expect(floatSamples().find((s) => s.value === 2)?.graphProduced).toBe(false);
    expect(floatSamples(['nan'])).toHaveLength(1);
    const two = intSamples(['unit']).find((s) => s.value === 2);
    expect(two?.classes).toEqual(['unit']);
    expect(() => floatSamples(['nope'])).toThrow(/unknown float class/);
    expect(() => intSamples(['nope'])).toThrow(/unknown int class/);
  });
});

describe('samplesFor (requirements §8.6, §8.7)', () => {
  it('puts special-case rows first and every sampled value in each position', () => {
    const special: InputValue[] = [{ kind: 'float', value: NaN }];
    const tuples = samplesFor(['float'], { specialRows: [special] });
    expect(tuples[0]?.classes).toEqual(['special']);
    // NaN from the special row is not repeated by the nan class.
    expect(tuples.filter((t) => Number.isNaN(valueOf(t.inputs[0]) as number))).toHaveLength(1);
    expect(tuples.length).toBe(floatSamples().length);
  });

  it('pairs each sampled value with ordinary values in the other positions', () => {
    const tuples = samplesFor(['float', 'float']);
    const firstPos = tuples.filter((t) => valueOf(t.inputs[1]) === 1.25);
    expect(firstPos.some((t) => Object.is(valueOf(t.inputs[0]), -0))).toBe(true);
    expect(tuples.some((t) => valueOf(t.inputs[0]) === 1.25 && valueOf(t.inputs[1]) === Infinity)).toBe(true);
  });

  it('adds the mandatory int32 pairs, divisor 0 and scatter slots for integer binary operations', () => {
    const tuples = samplesFor(['int', 'int'], { divisorZero: true });
    for (const [a, b] of MANDATORY_INT_PAIRS) {
      expect(tuples.some((t) => valueOf(t.inputs[0]) === a && valueOf(t.inputs[1]) === b)).toBe(true);
    }
    const divZero = tuples.filter((t) => valueOf(t.inputs[1]) === 0 && t.classes.includes('zero'));
    expect(divZero.length).toBeGreaterThanOrEqual(intSamples().length);
    const scatter = tuples.filter((t) => t.classes.includes('scatter'));
    expect(scatter).toHaveLength(8); // 4 per int input
  });

  it('uses the shift counts for a shift-count input and domain values when given', () => {
    const tuples = samplesFor(['int', 'int'], {
      shiftCountInput: 1,
      domainValues: { 0: [{ kind: 'int', value: int(12345) }] },
      scatterPerInput: 5,
    });
    expect(tuples.filter((t) => t.classes.includes('shiftCount'))).toHaveLength(SHIFT_COUNTS.length);
    expect(tuples.some((t) => t.classes.includes('domain') && valueOf(t.inputs[0]) === 12345)).toBe(true);
    expect(tuples.filter((t) => t.classes.includes('scatter'))).toHaveLength(10);
  });

  it('enumerates every boolean combination (§8.6)', () => {
    const tuples = samplesFor(['bool', 'bool', 'bool']);
    expect(tuples).toHaveLength(8);
    expect(new Set(tuples.map((t) => t.inputs.map((v) => String(valueOf(v))).join()))).toHaveProperty(
      'size',
      8,
    );
  });

  it('samples booleans in mixed signatures and floats with requested scatter', () => {
    const tuples = samplesFor(['bool', 'float'], { scatterPerInput: 2 });
    expect(tuples.filter((t) => valueOf(t.inputs[0]) === false)).toHaveLength(1);
    expect(tuples.filter((t) => t.inputs[1]?.kind === 'scatter')).toHaveLength(2);
  });

  it('checkEnumeration enforces the 64 limit (§8.1)', () => {
    expect(() => checkEnumeration('loop', 64)).not.toThrow();
    expect(() => checkEnumeration('loop', 65)).toThrow(/exceeds the enumeration limit of 64/);
  });
});

describe('pack (requirements §8.8, §8.9)', () => {
  const tuples = samplesFor(['float']);

  it('packs in order, pads the last group, and reserves scalars for zero, halfway, infinity, nan', () => {
    const { scalars, packed } = pack(tuples, 4);
    expect(packed).toHaveLength(Math.ceil(tuples.length / 4));
    expect(packed.every((p) => p.components.length === 4)).toBe(true);
    const reservedValues = scalars.map((s) => valueOf(s.components[0]?.inputs[0]));
    expect(reservedValues.some((v) => Object.is(v, -0))).toBe(true);
    expect(reservedValues.some((v) => Number.isNaN(v))).toBe(true);
    expect(reservedValues).toContain(Infinity);
    expect(reservedValues).toContain(0.49999999999999994);
    expect(packed.some(allComponentsDistinct)).toBe(true);
  });

  it('rejects bad widths and packings without a distinct-component sub-test', () => {
    expect(() => pack(tuples, 1)).toThrow(RangeError);
    const same: SampleTuple = { inputs: [{ kind: 'float', value: 3 }], classes: ['unit'] };
    expect(() => pack([same, same, same, same], 4)).toThrow(/all-distinct/);
    expect(pack([], 4)).toEqual({ scalars: [], packed: [] });
  });

  it('treats -0 and +0, and scatter slots, as distinct components', () => {
    const zeros: SampleTuple[] = [0, -0].map((value) => ({
      inputs: [{ kind: 'float', value }],
      classes: ['x'],
    }));
    expect(pack(zeros, 2).packed.some(allComponentsDistinct)).toBe(true);
    const slotTuple = (n: number): SampleTuple => ({
      inputs: [{ kind: 'scatter', slot: { kind: 'f64', value: n } }],
      classes: ['scatter'],
    });
    expect(allComponentsDistinct({ width: 2, components: [slotTuple(1), slotTuple(2)] })).toBe(true);
    expect(allComponentsDistinct({ width: 1, components: [{ inputs: [], classes: [] }] })).toBe(true);
  });
});

describe('fillScatterSlots (requirements §8.10)', () => {
  const asset = (
    name: string,
    kinds: ScatterSlot['kind'][],
  ): { name: string; subTests: { slots: ScatterSlot[] }[] } => ({
    name,
    subTests: [{ slots: kinds.map((kind) => ({ kind })) }],
  });

  it('draws by asset name, then sub-test and slot order, independent of input order', () => {
    const a = asset('b-asset', ['f64', 'int32']);
    const b = asset('a-asset', ['int32']);
    expect(fillScatterSlots([a, b], new SplitMix64(0n))).toBe(3);
    const ref = new SplitMix64(0n);
    expect(b.subTests[0]?.slots[0]?.value).toBe(ref.scatterInt32());
    expect(a.subTests[0]?.slots[0]?.value).toBe(ref.scatterF64());
    expect(a.subTests[0]?.slots[1]?.value).toBe(ref.scatterInt32());
  });

  it('refuses duplicate names and slots filled twice', () => {
    expect(() => fillScatterSlots([asset('x', []), asset('x', [])], new SplitMix64())).toThrow(/unique/);
    const once = asset('x', ['f64']);
    fillScatterSlots([once], new SplitMix64());
    expect(() => fillScatterSlots([once], new SplitMix64())).toThrow(/filled twice/);
  });
});
