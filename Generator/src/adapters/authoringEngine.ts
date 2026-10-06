// Adapter for the engine of the Khronos authoring tool, @khronosgroup/gltf-interactivity-engine
// (requirements §12; project spec section 16). It runs a generated asset headless and
// reports each sub-test's in-graph result. Results are informational: an adapter never
// changes an expected value.
//
// The engine is an optional dependency, loaded with dynamic import(). Its package `main`
// names a file that is not shipped, so the ESM build is imported by path. The build uses
// extensionless relative imports, which tsx and Vitest (with the package inlined) resolve
// but plain Node does not.
//
// The engine's DOMEventBus needs a browser `document`; this module supplies an in-memory
// event bus instead. The graph is stepped with executeEventQueueTick (no timers), which
// suits synchronous assets. Asynchronous assets need simulated time and arrive in M5.

import { readGlb } from '../asset/glb.js';

interface QueueItem {
  readonly behaveNode?: { processNode(socket?: string): void };
  readonly func?: () => void;
  readonly inSocketId?: string;
}

interface InterpolateAction {
  readonly action: () => void;
}

/** In-memory replacement for the engine's DOMEventBus. */
class MemoryEventBus {
  private eventList: QueueItem[] = [];
  private listeners: Record<string, ((event: { detail: unknown }) => void)[]> = {};
  private readonly variableInterpolations = new Map<number, InterpolateAction>();
  private readonly pointerInterpolations = new Map<string, InterpolateAction>();
  readonly sent: { readonly name: string; readonly values: unknown }[] = [];

  getEventList = (): QueueItem[] => this.eventList;
  clearEventList = (): void => {
    this.eventList = [];
  };
  addEvent = (event: QueueItem): void => {
    this.eventList.push(event);
  };
  addCustomEventListener = (name: string, func: (event: { detail: unknown }) => void): void => {
    (this.listeners[name] ??= []).push(func);
  };
  clearCustomEventListeners = (): void => {
    this.listeners = {};
  };
  dispatchCustomEvent = (name: string, values: unknown): void => {
    this.sent.push({ name, values });
    for (const func of this.listeners[name] ?? []) {
      this.eventList.push({ func: () => func({ detail: values }), inSocketId: name });
    }
  };
  getCustomEventsNames = (): string[] => Object.keys(this.listeners);
  // The engine iterates these with Object.values, so the getters return plain objects.
  setVariableInterpolationCallback = (variable: number, action: InterpolateAction): void => {
    this.variableInterpolations.set(variable, action);
  };
  getVariableInterpolationCallbacks = (): Record<number, InterpolateAction> =>
    Object.fromEntries(this.variableInterpolations);
  clearVariableInterpolation = (variable: number): void => {
    this.variableInterpolations.delete(variable);
  };
  setPointerInterpolationCallback = (pointer: string, action: InterpolateAction): void => {
    this.pointerInterpolations.set(pointer, action);
  };
  getPointerInterpolationCallbacks = (): Record<string, InterpolateAction> =>
    Object.fromEntries(this.pointerInterpolations);
  clearPointerInterpolation = (pointer: string): void => {
    this.pointerInterpolations.delete(pointer);
  };
}

interface Engine {
  registerJsonPointer(
    ptr: string,
    get: (path: string) => unknown,
    set: (path: string, value: unknown) => void,
    type: string,
    readOnly: boolean,
  ): void;
  loadBehaveGraph(graph: unknown, run: boolean): void;
  executeEventQueueTick(): void;
  clearScheduledDelays(): void;
  readonly variables: readonly { readonly name?: string; value: unknown[] }[];
}

interface EngineModule {
  readonly BasicBehaveEngine: new (fps: number, bus: MemoryEventBus) => Engine;
}

export interface EngineSubTestResult {
  readonly name: string;
  readonly passed: boolean;
  /** The result variable's final value as the engine holds it. */
  readonly actual: unknown;
}

export interface EngineRun {
  readonly subTests: readonly EngineSubTestResult[];
  /** Custom events the graph sent, in order (`test/onStart`, then `test/onSuccess` or `test/onFailed`). */
  readonly events: readonly string[];
  /** Material colours after the run, by material index. */
  readonly indicators: readonly (readonly number[])[];
  /** Input changes made so this engine version can load the graph (see engineCompatible). */
  readonly workarounds: readonly string[];
}

interface OracleView {
  readonly tests: readonly {
    readonly subTests: readonly {
      readonly name: string;
      readonly resultVarId: number;
      readonly successResultVarId: number;
    }[];
  }[];
}

const ENGINE_MODULE = '@khronosgroup/gltf-interactivity-engine/build/index.js';
const EVENT_PREFIX = 'KHR_INTERACTIVITY:';

/** Loads the engine, or returns undefined when the optional dependency is not installed. */
export async function loadAuthoringEngine(): Promise<EngineModule | undefined> {
  try {
    return (await import(ENGINE_MODULE)) as EngineModule;
  } catch {
    return undefined;
  }
}

/**
 * Runs one asset until the graph reports test/onSuccess or test/onFailed, or `maxTicks`
 * ticks pass, and reads every sub-test's pass variable.
 */
export function runOnAuthoringEngine(
  mod: EngineModule,
  glb: Uint8Array,
  oracleText: string,
  maxTicks = 10,
): EngineRun {
  const doc = JSON.parse(readGlb(glb).json) as {
    materials?: { pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
    extensions: { KHR_interactivity: { graphs: unknown[] } };
  };
  const bus = new MemoryEventBus();
  const engine = new mod.BasicBehaveEngine(60, bus);
  const colours = (doc.materials ?? []).map((m) => [
    ...(m.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]),
  ]);
  // The engine's pointer trie keeps one node per numeric segment, and a registered number is
  // a count: indices below it are valid. So the pointer is registered once, with the
  // material count, and the material index is read from the path.
  const materialOf = (path: string): number => Number(path.split('/')[2]);
  engine.registerJsonPointer(
    `/materials/${colours.length}/pbrMetallicRoughness/baseColorFactor`,
    (path) => colours[materialOf(path)],
    (path, value) => {
      colours[materialOf(path)] = [...(value as number[])];
    },
    'float4',
    false,
  );
  const { graph, workarounds } = engineCompatible(doc.extensions.KHR_interactivity.graphs[0]);
  engine.loadBehaveGraph(graph, false);
  const finished = (): boolean =>
    bus.sent.some(
      (e) => e.name === `${EVENT_PREFIX}test/onSuccess` || e.name === `${EVENT_PREFIX}test/onFailed`,
    );
  for (let tick = 0; tick < maxTicks && !finished(); tick++) engine.executeEventQueueTick();
  engine.clearScheduledDelays();

  const oracle = JSON.parse(oracleText) as OracleView;
  const subTests = oracle.tests.flatMap((t) =>
    t.subTests.map((st) => ({
      name: st.name,
      passed: engine.variables[st.successResultVarId]?.value[0] === true,
      actual: engine.variables[st.resultVarId]?.value[0],
    })),
  );
  return {
    subTests,
    events: bus.sent.map((e) =>
      e.name.startsWith(EVENT_PREFIX) ? e.name.slice(EVENT_PREFIX.length) : e.name,
    ),
    indicators: colours,
    workarounds,
  };
}

/**
 * Engine 1.0.0 reads `Object.keys(event.values)` in event/send, so it throws for a custom
 * event without `values`, which the schema requires when an event has no value sockets
 * (`minProperties: 1`). Adding an empty object changes no semantics; each use is reported.
 */
function engineCompatible(graph: unknown): { graph: unknown; workarounds: string[] } {
  const g = graph as { events?: { id?: string; values?: unknown }[] };
  const workarounds: string[] = [];
  const events = (g.events ?? []).map((e) => {
    if (e.values !== undefined) return e;
    workarounds.push(`event ${e.id ?? '?'}: added empty values for event/send`);
    return { ...e, values: {} };
  });
  return { graph: { ...g, events }, workarounds };
}
