import {
  ContinuousMotionStrategy,
  DiceError,
  EventBus,
  EVENTS,
  GameLoop,
  ManualScheduler,
  RollInProgressError,
  StandardRollStrategy,
  UnsupportedRollOptionError,
  computeViewportMetrics,
  createBrowserRandom,
  createSeededRandom
} from '@dice/core';
import { World } from '@dice/world';

import { PluginRegistry } from './PluginRegistry.js';
import { BrowserScheduler } from './scheduler/BrowserScheduler.js';
import {
  createEngineConfig,
  engineConfigToWorldConfig
} from './config.js';

/**
 * Rejection used when a roll is cancelled. The name is part of the app
 * contract: callers distinguish cancellations from real failures by it.
 */
export class RollCancelledError extends DiceError {
  /**
   * @param {string} [reason]
   */
  constructor(reason = 'cancelled') {
    super(`Roll cancelled: ${reason}`, { code: 'ROLL_CANCELLED' });
    this.name = 'RollCancelledError';
    this.reason = reason;
  }
}

/**
 * @typedef {Object} PendingRoll
 * @property {string} rollId
 * @property {(result: any) => void} resolve
 * @property {(error: Error) => void} reject
 * @property {string|number|undefined} seed
 * @property {Record<string, any>} request
 * @property {boolean} started Whether the world roll has been spawned.
 * @property {boolean} cancelled Whether cancelRoll fired during preparation.
 */

/**
 * @param {number} w
 * @param {number} h
 * @returns {Record<string, any>}
 */
function defaultMetrics(w = 1000, h = 600) {
  return computeViewportMetrics({
    containerWidth: w,
    containerHeight: h,
    sceneWidth: w,
    sceneHeight: h,
    devicePixelRatio: 1
  });
}

/**
 * Public facade and lifecycle owner. The engine owns the event bus, the
 * game loop, the world, and the plugin registry. It implements the
 * `InputHost` contract, so the same object is handed to every plugin's
 * `attach` (input plugins) and every determinism-style plugin can capture
 * `engine.world`.
 *
 * The engine never imports UI, input, or determinism packages and contains
 * no game rules.
 */
export class DiceEngine {
  /** @type {import('./config.js').EngineConfig} */
  #config;

  /** @type {EventBus<any>} */
  #events;

  /** @type {any} */
  #world;

  /** @type {GameLoop} */
  #loop;

  /** @type {ManualScheduler|BrowserScheduler} */
  #scheduler;

  /** @type {PluginRegistry} */
  #plugins = new PluginRegistry();

  /** @type {string} */
  #engineId;

  /** @type {string} */
  #mode = 'standard';

  /**
   * Frames a standard roll may run before the strategy settles by force.
   * Read at strategy construction time, so `setLoopConfig({ maxFrames })`
   * takes effect from the next roll/mode/start.
   *
   * @type {number}
   */
  #maxFrames = 1000;

  /** @type {PendingRoll|null} */
  #pendingRoll = null;

  /** @type {number} */
  #rollCounter = 0;

  /** @type {boolean} */
  #destroyed = false;

  /** @type {Record<string, any>} */
  #lastMetrics;

  /**
   * @param {import('./config.js').EngineConfig} config
   * @param {{ events: EventBus<any>, world: any, loop: GameLoop, scheduler: ManualScheduler|BrowserScheduler, engineId: string, metrics: Record<string, any> }} parts
   */
  constructor(config, parts) {
    this.#config = config;
    this.#events = parts.events;
    this.#world = parts.world;
    this.#loop = parts.loop;
    this.#scheduler = parts.scheduler;
    this.#engineId = parts.engineId;
    this.#lastMetrics = parts.metrics;
    this.#maxFrames = config.loop?.maxFrames ?? 1000;

    this.#events.on(EVENTS.LOOP_STOP, (/** @type {any} */ payload) => {
      this.#onLoopStop(payload);
    });
  }

  /**
   * Async factory: the rendering backend may load the vendored Three
   * script, so creation is asynchronous even in headless mode.
   *
   * @param {import('./config.js').EngineConfig} [config]
   * @returns {Promise<DiceEngine>}
   */
  static async create(config = {}) {
    const resolved = createEngineConfig(config);
    const headless =
      resolved.headless || resolved.container == null;

    const rng =
      resolved.rng ??
      (resolved.seed !== undefined
        ? createSeededRandom(resolved.seed)
        : createBrowserRandom());

    const events = new EventBus();
    const engineId =
      resolved.engineId ??
      `engine-${Math.floor(rng.next() * 1e9).toString(36)}`;

    const world = resolved.worldFactory
      ? resolved.worldFactory({
          config: engineConfigToWorldConfig(resolved),
          content: resolved.content,
          rng,
          events,
          headless,
          container: resolved.container,
          physicsFactory: resolved.physicsFactory,
          rendererFactory: resolved.rendererFactory,
          diceRegistry: resolved.diceRegistry
        })
      : new World({
          config: engineConfigToWorldConfig(resolved),
          content: resolved.content,
          rng,
          events,
          headless,
          container: resolved.container,
          physicsFactory: resolved.physicsFactory,
          rendererFactory: resolved.rendererFactory,
          diceRegistry: resolved.diceRegistry
        });

    const metrics =
      resolved.viewport ??
      (resolved.container &&
      Number(resolved.container.clientWidth) > 0 &&
      Number(resolved.container.clientHeight) > 0
        ? computeViewportMetrics({
            containerWidth: Number(resolved.container.clientWidth),
            containerHeight: Number(resolved.container.clientHeight),
            sceneWidth: Number(resolved.container.clientWidth),
            sceneHeight: Number(resolved.container.clientHeight),
            devicePixelRatio:
              typeof globalThis.devicePixelRatio === 'number'
                ? globalThis.devicePixelRatio
                : 1
          })
        : defaultMetrics());

    await world.init({ ...metrics });

    const scheduler = headless
      ? new ManualScheduler()
      : new BrowserScheduler();

    const loop = new GameLoop({
      step: (/** @type {number} */ dt) => world.step(dt),
      render: (/** @type {number|undefined} */ alpha) => {
        world.render(alpha ?? 0);
      },
      world,
      scheduler: /** @type {any} */ (scheduler),
      eventBus: events,
      fixedStep: resolved.loop?.fixedStep ?? 1 / 60,
      maxSubSteps: resolved.loop?.maxSubSteps ?? 4,
      maxFrameGap: resolved.loop?.maxFrameGap ?? 0.25
    });

    const engine = new DiceEngine(resolved, {
      events,
      world,
      loop,
      scheduler,
      engineId,
      metrics: { ...metrics }
    });

    for (const plugin of resolved.plugins ?? []) {
      engine.use(plugin);
    }

    events.emit(EVENTS.ENGINE_READY, { engineId });
    return engine;
  }

  /**
   * @returns {EventBus<any>}
   */
  get events() {
    return this.#events;
  }

  /**
   * @returns {any}
   */
  get world() {
    return this.#world;
  }

  /**
   * @returns {GameLoop}
   */
  get loop() {
    return this.#loop;
  }

  /**
   * @returns {ManualScheduler|BrowserScheduler}
   */
  get scheduler() {
    return this.#scheduler;
  }

  /**
   * @returns {string}
   */
  get engineId() {
    return this.#engineId;
  }

  /**
   * @returns {string}
   */
  get mode() {
    return this.#mode;
  }

  /**
   * @returns {boolean}
   */
  get destroyed() {
    return this.#destroyed;
  }

  /**
   * @returns {Record<string, any>}
   */
  getConfig() {
    return { ...this.#config };
  }

  /**
   * @returns {void}
   */
  #assertNotDestroyed() {
    if (this.#destroyed) {
      throw new DiceError('DiceEngine has been destroyed.', {
        code: 'ENGINE_DESTROYED'
      });
    }
  }

  // ---------------------------------------------------------------- plugins

  /**
   * Attach a plugin. The engine itself is passed to `attach`, so input
   * plugins receive the `InputHost` and determinism capture `engine.world`.
   *
   * @param {any} plugin
   * @returns {any}
   */
  use(plugin) {
    this.#assertNotDestroyed();
    return this.#plugins.use(plugin, this);
  }

  /**
   * Detach a plugin by id.
   *
   * @param {string} pluginId
   * @returns {any|null}
   */
  unuse(pluginId) {
    return this.#plugins.unuse(pluginId, this);
  }

  // ------------------------------------------------------------------- rolls

  /**
   * Roll the dice. Resolves with the canonical `RollResult` when the dice
   * settle; rejects with `RollInProgressError` when a roll is active
   * (unless `{ cancelActive: true }`), with `RollCancelledError` on
   * cancellation, and with `UnsupportedRollOptionError` when `values` are
   * requested without a plugin that supplies face mappings.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  roll(request = {}) {
    try {
      this.#assertNotDestroyed();
    } catch (error) {
      return Promise.reject(error);
    }

    if (this.#pendingRoll) {
      if (request?.cancelActive) {
        this.cancelRoll('replaced');
      } else {
        return Promise.reject(new RollInProgressError());
      }
    }

    this.#rollCounter += 1;
    const rollId = String(request?.id ?? `roll-${this.#rollCounter}`);

    // Register the pending roll synchronously, before any await, so a
    // cancelRoll issued immediately after roll() always finds it.
    /** @type {PendingRoll} */
    const pending = {
      rollId,
      resolve: () => {},
      reject: () => {},
      seed: request?.seed,
      request: { ...request, id: rollId },
      started: false,
      cancelled: false
    };
    /** @type {Promise<any>} */
    const promise = new Promise((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.#pendingRoll = pending;

    void this.#runRoll(pending, { ...request, id: rollId });
    return promise;
  }

  /**
   * Async continuation of `roll`, after the pending promise is registered.
   *
   * @param {PendingRoll} pending
   * @param {Record<string, any>} request
   * @returns {Promise<void>}
   */
  async #runRoll(pending, request) {
    try {
      // Build the throw plan before plugin hooks so prediction and the
      // visible roll share the exact same vectors and seed.
      /** @type {Record<string, any>} */
      let effective = { ...request };

      if (!Array.isArray(effective.vectors)) {
        const count = effective.dice ?? effective.count ??
          this.#world.getConfig().diceCount ?? 6;
        const plan = this.#world.createThrowPlan({
          dice: count,
          definition: effective.definition,
          seed: effective.seed,
          mode: effective.mode ?? this.#mode
        });
        effective.vectors = plan.vectors;
        effective.seed = plan.seed;
        if (effective.dice === undefined && effective.count === undefined) {
          effective.dice = plan.dice;
        }
      }

      const prepared = await this.#plugins.prepareRoll(effective);
      if (pending.cancelled) return;
      effective = prepared.request;

      // Requested values need a plugin (determinism) to produce mappings.
      // The engine never imports that package; it only checks the result.
      if (
        Array.isArray(effective.values) &&
        effective.values.length > 0 &&
        prepared.faceMappings === undefined
      ) {
        throw new UnsupportedRollOptionError('values');
      }

      const mode = effective.mode ?? this.#mode;
      this.#mode = mode;

      pending.seed = effective.seed;
      pending.request = effective;
      pending.started = true;

      this.#events.emit(EVENTS.ROLL_START, {
        rollId: pending.rollId,
        request: effective
      });

      this.#world.roll(effective);

      const strategy =
        mode === 'continuous'
          ? new ContinuousMotionStrategy()
          : new StandardRollStrategy({ maxFrames: this.#maxFrames });
      this.#loop.setStrategy(strategy);
      this.#loop.start(strategy);

      // Headless/manual engines have no frame source: drive the loop here.
      // Browser engines are driven by BrowserScheduler frames.
      if (this.#scheduler instanceof ManualScheduler && mode !== 'continuous') {
        const fixedStep = this.#loop.fixedStep;
        let guard = 0;
        while (this.#pendingRoll === pending && this.#loop.running && guard < 10000) {
          this.#loop.step(fixedStep);
          guard += 1;
        }
      }
    } catch (error) {
      if (pending.cancelled) return;
      if (this.#pendingRoll === pending) {
        this.#pendingRoll = null;
      }
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Handle loop stops: exactly one `roll:settle` per settled roll, and a
   * single cancellation rejection for non-settled stops.
   *
   * @param {{ reason?: string }} payload
   * @returns {void}
   */
  #onLoopStop(payload) {
    if (!this.#pendingRoll) return;
    const pending = this.#pendingRoll;

    if (payload?.reason === 'settled') {
      this.#pendingRoll = null;
      const result = this.#world.getRollResult(pending.seed);
      result.id = pending.rollId;
      result.request = pending.request;
      this.#events.emit(EVENTS.ROLL_SETTLE, {
        rollId: pending.rollId,
        result
      });
      try {
        this.#plugins.afterRoll(result);
      } catch (error) {
        this.#events.emit(EVENTS.ENGINE_ERROR, {
          scope: 'plugin:afterRoll',
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
      pending.resolve(result);
    } else {
      this.#pendingRoll = null;
      const reason = payload?.reason ?? 'stopped';
      this.#events.emit(EVENTS.ROLL_CANCEL, {
        rollId: pending.rollId,
        reason
      });
      pending.reject(new RollCancelledError(reason));
    }
  }

  /**
   * Cancel the active roll, rejecting its promise.
   *
   * @param {string} [reason]
   * @returns {void}
   */
  cancelRoll(reason = 'cancelled') {
    if (!this.#pendingRoll) return;
    const pending = this.#pendingRoll;
    // Mark cancelled first so an async preparation still in flight
    // (plugin hooks) does not spawn dice after the cancellation.
    pending.cancelled = true;
    // Stopping the loop emits loop:stop, whose handler rejects the
    // pending roll and emits roll:cancel. When the loop never started
    // (cancellation during preparation), reject directly instead.
    if ((this.#loop.running || this.#loop.paused) && pending.started) {
      this.#loop.stop('cancelled');
    } else {
      this.#pendingRoll = null;
      this.#events.emit(EVENTS.ROLL_CANCEL, { rollId: pending.rollId, reason });
      pending.reject(new RollCancelledError(reason));
    }
  }

  /**
   * Run an isolated headless one-shot. Builds its own world with its own
   * event bus, so no public engine event fires and the live world is
   * never stepped or mutated.
   *
   * @param {Record<string, any>} [request]
   * @returns {Promise<any>}
   */
  async simulate(request = {}) {
    this.#assertNotDestroyed();

    const simWorld = this.#config.worldFactory
      ? this.#config.worldFactory({
          config: engineConfigToWorldConfig(this.#config),
          content: this.#config.content,
          events: new EventBus(),
          headless: true,
          container: null,
          physicsFactory: this.#config.physicsFactory,
          rendererFactory: this.#config.rendererFactory,
          diceRegistry: this.#config.diceRegistry
        })
      : new World({
          config: engineConfigToWorldConfig(this.#config),
          content: this.#config.content,
          events: new EventBus(),
          headless: true,
          container: null,
          physicsFactory: this.#config.physicsFactory,
          rendererFactory: this.#config.rendererFactory,
          diceRegistry: this.#config.diceRegistry
        });

    try {
      await simWorld.init({ ...this.#lastMetrics });
      const descriptor = simWorld.roll({ ...request });
      const settle = simWorld.getSettleConfig();
      const fixedStep = settle.fixedStep ?? this.#loop.fixedStep;
      const maxIterations = settle.maxIterations ?? 1000;

      let iterations = 0;
      while (!simWorld.areDiceSettled() && iterations < maxIterations * 3) {
        simWorld.step(fixedStep);
        iterations += 1;
      }

      return simWorld.getRollResult(descriptor.seed);
    } finally {
      simWorld.dispose();
    }
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * @param {'standard'|'continuous'} mode
   * @returns {void}
   */
  setMode(mode) {
    this.#assertNotDestroyed();
    if (mode !== 'standard' && mode !== 'continuous') {
      throw new DiceError(`Unknown engine mode: ${String(mode)}`, {
        code: 'UNKNOWN_MODE'
      });
    }
    this.#mode = mode;
    const strategy =
      mode === 'continuous'
        ? new ContinuousMotionStrategy()
        : new StandardRollStrategy({ maxFrames: this.#maxFrames });
    this.#loop.setStrategy(strategy);
  }

  /**
   * @param {string|{ id?: string, type?: string }} type
   * @returns {void}
   */
  setEnclosure(type) {
    this.#assertNotDestroyed();
    this.#world.setEnclosure(type);
  }

  /**
   * Resize the active built-in enclosure relative to its default size.
   *
   * @param {number} scale
   * @returns {void}
   */
  setEnclosureScale(scale) {
    this.#assertNotDestroyed();
    this.#world.setEnclosureScale(scale);
  }

  /**
   * Update render lighting.
   *
   * @param {{ position?: { x?: number, y?: number, z?: number }|null }} [settings]
   * @returns {void}
   */
  setLight(settings) {
    this.#assertNotDestroyed();
    this.#world.setLight(settings ?? {});
  }

  /**
   * @param {{ distance?: number, near?: number, far?: number }} settings
   * @returns {void}
   */
  setCamera(settings) {
    this.#assertNotDestroyed();
    this.#world.setCamera(settings ?? {});
  }

  /**
   * @returns {void}
   */
  resetCamera() {
    this.#assertNotDestroyed();
    this.#world.resetCamera();
  }

  /**
   * @param {{ definition?: string, count?: number, dice?: number, style?: string|any }} config
   * @returns {void}
   */
  setDiceConfig(config) {
    this.#assertNotDestroyed();
    this.#world.setDiceConfig(config ?? {});
  }

  /**
   * @param {Record<string, any>} config
   * @returns {Record<string, any>}
   */
  setSettleConfig(config) {
    this.#assertNotDestroyed();
    return this.#world.setSettleConfig(config ?? {});
  }

  /**
   * @param {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number, maxFrames?: number }} config
   * @returns {void}
   */
  setLoopConfig(config = {}) {
    this.#assertNotDestroyed();
    if (config.fixedStep !== undefined) {
      if (!(config.fixedStep > 0)) {
        throw new RangeError('loop fixedStep must be greater than zero.');
      }
      this.#loop.fixedStep = config.fixedStep;
    }
    if (config.maxSubSteps !== undefined) this.#loop.maxSubSteps = config.maxSubSteps;
    if (config.maxFrameGap !== undefined) this.#loop.maxFrameGap = config.maxFrameGap;
    if (config.maxFrames !== undefined) {
      if (!Number.isInteger(config.maxFrames) || config.maxFrames <= 0) {
        throw new RangeError('loop maxFrames must be a positive integer.');
      }
      this.#maxFrames = config.maxFrames;
    }
  }

  /**
   * @returns {void}
   */
  clear() {
    this.#assertNotDestroyed();
    if (this.#pendingRoll) this.cancelRoll('clear');
    this.#world.clearDice();
  }

  /**
   * @returns {void}
   */
  reset() {
    this.#assertNotDestroyed();
    if (this.#pendingRoll) this.cancelRoll('reset');
    this.#world.reset();
  }

  /**
   * Start the loop. Headless engines record the run without scheduling;
   * browser engines are driven by frames.
   *
   * @returns {void}
   */
  start() {
    this.#assertNotDestroyed();
    const strategy =
      this.#mode === 'continuous'
        ? new ContinuousMotionStrategy()
        : new StandardRollStrategy({ maxFrames: this.#maxFrames });
    this.#loop.start(strategy);
  }

  /**
   * @returns {void}
   */
  pause() {
    if (this.#destroyed) return;
    this.#loop.pause();
  }

  /**
   * @returns {void}
   */
  resume() {
    if (this.#destroyed) return;
    this.#loop.resume();
  }

  /**
   * @returns {void}
   */
  stop() {
    if (this.#destroyed) return;
    this.#loop.stop();
  }

  /**
   * Resize from explicit metrics or, when omitted, from the container's
   * DOM size. Headless engines without a container keep default metrics.
   *
   * @param {Record<string, any>|null} [viewport]
   * @returns {Record<string, any>} Metrics used.
   */
  resize(viewport = null) {
    this.#assertNotDestroyed();
    let metrics = viewport;

    if (!metrics) {
      const container = this.#config.container;
      if (
        container &&
        Number(container.clientWidth) > 0 &&
        Number(container.clientHeight) > 0
      ) {
        metrics = computeViewportMetrics({
          containerWidth: Number(container.clientWidth),
          containerHeight: Number(container.clientHeight),
          sceneWidth: Number(container.clientWidth),
          sceneHeight: Number(container.clientHeight),
          devicePixelRatio:
            typeof globalThis.devicePixelRatio === 'number'
              ? globalThis.devicePixelRatio
              : 1
        });
      } else {
        metrics = { ...this.#lastMetrics };
      }
    }

    this.#lastMetrics = { ...metrics };
    this.#world.resize({ ...metrics });
    this.#events.emit(EVENTS.ENGINE_RESIZE, { ...metrics });
    return { ...metrics };
  }

  /**
   * Detach plugins, stop the loop, dispose the world, and clear listeners.
   * Idempotent.
   *
   * @returns {void}
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;

    if (this.#pendingRoll) {
      const pending = this.#pendingRoll;
      pending.cancelled = true;
      this.#pendingRoll = null;
      try {
        this.#loop.stop('destroyed');
      } catch {
        // Loop teardown must not block engine destruction.
      }
      pending.reject(new RollCancelledError('destroyed'));
    } else {
      try {
        this.#loop.stop('destroyed');
      } catch {
        // Ignore.
      }
    }

    try {
      this.#plugins.detachAll(this);
    } catch {
      // Plugin teardown must not block destruction.
    }

    try {
      this.#world.dispose();
    } catch {
      // Ignore world teardown errors during destroy.
    }

    this.#events.clear();
  }

  // ---------------------------------------------------------------- InputHost

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {void}
   */
  setGravity(x, y, z) {
    this.#assertNotDestroyed();
    this.#world.setGravity(x, y, z);
  }

  /**
   * @param {string[]} ids
   * @param {{ x: number, y: number, z: number }} impulse
   * @param {{ x: number, y: number, z: number }} [worldPoint]
   * @returns {void}
   */
  applyImpulse(ids, impulse, worldPoint) {
    this.#assertNotDestroyed();
    this.#world.applyImpulse(ids, impulse, worldPoint);
  }

  /**
   * @returns {string[]}
   */
  getDiceIds() {
    return this.#world.getDiceIds();
  }

  /**
   * @returns {string[]}
   */
  getSelection() {
    return this.#world.getSelection();
  }

  /**
   * @param {string[]} ids
   * @returns {void}
   */
  setSelection(ids) {
    this.#world.setSelection(ids);
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  toggleSelection(id) {
    this.#world.toggleSelection(id);
  }

  /**
   * @param {{ x: number, y: number }} ndc
   * @returns {any}
   */
  pick(ndc) {
    return this.#world.pick(ndc);
  }

  /**
   * @returns {Record<string, any>}
   */
  getMetrics() {
    return this.#world.getMetrics();
  }

  /**
   * @returns {Record<string, any>}
   */
  getSpawnProfile() {
    return this.#world.getSpawnProfile();
  }
}
