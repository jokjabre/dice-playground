import { EVENTS, EventBus, RandomSource, createBrowserRandom } from '@dice/core';
import { createDiceRegistry } from '@dice/dice';
import {
  createEnclosure,
  getEnclosureDefinition,
  computeDieRadius,
  normalizeEnclosureScale
} from '@dice/enclosures';

import {
  createDefaultPhysicsFactory,
  createDefaultRendererFactory
} from './backends.js';
import { configFromContent, createWorldConfig } from './config.js';
import { DiceFactory } from './DiceFactory.js';
import { DiceSet } from './DiceSet.js';
import { MeshBodySync } from './MeshBodySync.js';
import {
  PredictionSession,
  stateToTransform
} from './prediction/PredictionSession.js';
import { RollState } from './RollState.js';
import {
  buildThrowVectors,
  createSpawnProfile
} from './SpawnProfile.js';
import { TableVisual } from './TableVisual.js';
import { Viewport } from './Viewport.js';

/**
 * @typedef {Object} ViewportMetrics
 * @property {number} containerWidth
 * @property {number} containerHeight
 * @property {number} sceneWidth
 * @property {number} sceneHeight
 * @property {number} scale
 * @property {number} aspect
 * @property {number} wallHeight
 * @property {number} pixelRatio
 * @typedef {Object} SettleConfig
 * @property {number} velocityThreshold
 * @property {number} settleFrames
 * @property {number} maxIterations
 * @property {number} fixedStep
 */

/**
 * @typedef {Object} WorldOptions
 * @property {Record<string, any>} [config]
 * @property {Record<string, any>|null} [content]
 * @property {RandomSource|null} [rng]
 * @property {any|null} [events]
 * @property {boolean} [headless]
 * @property {any|null} [container]
 * @property {(config?: any) => any} [physicsFactory]
 * @property {(options?: any) => any} [rendererFactory]
 * @property {any} [diceRegistry]
 * @property {Record<string, any>} [enclosureOptions]
 */

/**
 * @typedef {Object} SpawnDiceSpec
 * @property {number} [dice]
 * @property {number} [count]
 * @property {string} [definition]
 * @property {any[]} [vectors]
 * @property {number[][]} [faceMappings]
 * @property {string[]} [keep]
 * @property {string|number} [seed]
 * @property {Record<string, any>} [spawnProfile]
 * @property {'standard'|'continuous'} [mode]
 * @property {string|any} [style]
 */

/**
 * @param {any} value
 * @returns {boolean}
 */
function isFiniteVector(value) {
  return (
    value &&
    typeof value === 'object' &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

/**
 * One live simulation: physics, optional rendering, dice, enclosure, table
 * visual, spawn/throw planning, settle tracking, selection, and partial
 * reroll. The world owns no scheduler; the engine's game loop drives `step`.
 */
export class World {
  /** @type {any} */
  #config;

  /** @type {Record<string, any>|null} */
  #content;

  /** @type {RandomSource} */
  #rng;

  /** @type {any} */
  #events;

  /** @type {boolean} */
  #headless;

  /** @type {any|null} */
  #container;

  /** @type {(config?: any) => any} */
  #physicsFactory;

  /** @type {(options?: any) => any} */
  #rendererFactory;

  /** @type {any} */
  #diceRegistry;

  /** @type {{ x: number, y: number, z: number }} */
  #cameraSettings = { x: 0, y: 0, z: 0 };

  /** @type {Record<string, any>} */
  #defaultCamera = {};

  /** @type {Viewport} */
  #viewport;

  /** @type {any|null} */
  #physics = null;

  /** @type {any|null} */
  #renderer = null;

  /** @type {any|null} */
  #enclosure = null;

  /** @type {string} */
  #enclosureId = 'box';

  /** @type {Record<string, any>} */
  #enclosureOptions = {};

  /** @type {Map<string, (options?: Record<string, any>) => any>} */
  #enclosureFactories = new Map();

  /** @type {TableVisual|null} */
  #tableVisual = null;

  /** @type {DiceSet} */
  #diceSet = new DiceSet();

  /** @type {DiceFactory|null} */
  #diceFactory = null;

  /** @type {RollState} */
  #rollState;

  /** @type {any} */
  #spawnProfile;

  /** @type {number} */
  #dieCounter = 0;

  /** @type {number} */
  #rollCounter = 0;

  /** @type {number} */
  #worldSeq = 1;

  /** @type {string|null} */
  #activeRollId = null;

  /** @type {any|null} */
  #activeRollRequest = null;

  /** @type {number} */
  #rollStartedAt = 0;

  /** @type {boolean} */
  #initialized = false;

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {WorldOptions} [options]
   */
  constructor(options = {}) {
    this.#content = options.content ?? null;

    const contentConfig = configFromContent(this.#content);
    this.#config = createWorldConfig({
      ...contentConfig,
      ...(options.config ?? {})
    });
    this.#defaultCamera = { ...(this.#config.camera ?? {}) };

    if (options.enclosureOptions) {
      this.#enclosureOptions = { ...options.enclosureOptions };
      this.#config.enclosureOptions = {
        ...this.#config.enclosureOptions,
        ...options.enclosureOptions
      };
    } else {
      this.#enclosureOptions = { ...this.#config.enclosureOptions };
    }

    this.#rng = options.rng ?? createBrowserRandom();
    this.#events = options.events ?? new EventBus();
    this.#container = options.container ?? null;
    this.#headless =
      options.headless !== undefined
        ? Boolean(options.headless)
        : this.#container == null;
    this.#physicsFactory =
      options.physicsFactory ?? createDefaultPhysicsFactory();
    this.#rendererFactory =
      options.rendererFactory ?? createDefaultRendererFactory();
    this.#diceRegistry = options.diceRegistry ?? createDiceRegistry();

    this.#viewport = new Viewport();
    this.#rollState = new RollState(this.#config.settle);
    this.#spawnProfile = createSpawnProfile({ mode: this.#config.enclosure });

    this.#enclosureId = this.#config.enclosure;

    // Numeric world sequence keeps die ids stable per world (`die-<seq>-<n>`)
    // without a module-level singleton.
    try {
      this.#worldSeq = 1 + Math.floor(this.#rng.next() * 1000000);
    } catch {
      this.#worldSeq = 1;
    }

    // Built-in enclosure factories. Custom factories can be added with
    // registerEnclosure().
    this.#registerBuiltIns();
  }

  /**
   * @returns {void}
   */
  #registerBuiltIns() {
    for (const id of ['box', 'sphere', 'cylinder']) {
      this.#enclosureFactories.set(id, (enclosureOptions = {}) =>
        createEnclosure(id, { ...enclosureOptions })
      );
    }
  }

  /**
   * Register or replace the factory used to create an enclosure by id.
   *
   * @param {string} id
   * @param {(options?: Record<string, any>) => any} factory
   * @returns {void}
   */
  registerEnclosure(id, factory) {
    this.#assertActive();
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('registerEnclosure requires a non-empty id.');
    }
    if (typeof factory !== 'function') {
      throw new TypeError('registerEnclosure requires a factory function.');
    }
    this.#enclosureFactories.set(id, factory);
  }

  /**
   * Initialise the world from engine-supplied viewport metrics. Never reads
   * DOM dimensions; the metrics arrive from the engine/app shell.
   *
   * @param {ViewportMetrics} viewport
   * @returns {Promise<void>}
   */
  async init(viewport) {
    this.#assertActive();
    if (!viewport) {
      throw new TypeError('World.init requires ViewportMetrics.');
    }

    this.#viewport.update(viewport);
    const metrics = this.#viewport.getMetrics();

    // Physics is always present, including in headless mode.
    const physicsResult = this.#physicsFactory({
      gravity: this.#config.gravity,
      iterations: this.#config.physicsIterations
    });
    this.#physics = physicsResult?.physics ?? physicsResult?.physicsWorld ?? physicsResult;
    if (!this.#physics || typeof this.#physics.createBody !== 'function') {
      throw new TypeError('physicsFactory must return a physics world.');
    }

    // Rendering is optional and async (the r73 backend loads lazily).
    if (!this.#headless && this.#container != null) {
      const rendererResult = await this.#rendererFactory({
        container: this.#container,
        config: this.#config.render,
        metrics
      });
      // A RenderScene instance is used as-is: its `scene` getter returns the
      // opaque backend handle, so unwrap only objects that do not already
      // expose the renderer API.
      this.#renderer =
        rendererResult && typeof rendererResult.createDiceVisual === 'function'
          ? rendererResult
          : (rendererResult?.renderer ?? rendererResult?.scene ?? rendererResult ?? null);
      if (this.#renderer && typeof this.#renderer.createDiceVisual !== 'function') {
        throw new TypeError('rendererFactory must return a render scene.');
      }
    } else {
      this.#renderer = null;
    }

    // Enclosure on the live world, then the table so the floor can cover the
    // enclosure footprint (box tray, sphere shell, cylinder shell).
    this.#buildEnclosure(this.#enclosureId, metrics);

    // Table visual comes from content/config; lighting lives in the render scene.
    this.#tableVisual = new TableVisual({
      renderer: this.#renderer,
      descriptor: {
        color: this.#config.table?.floorColor ?? this.#config.table?.color,
        receiveShadow: this.#config.table?.shadows
      }
    });
    this.#tableVisual.create(metrics, this.#enclosureFootprint(this.#enclosure));

    if (this.#renderer && this.#config.camera?.distance !== undefined) {
      this.#renderer.setCamera?.({
        distance: this.#config.camera.distance,
        near: this.#config.camera.near,
        far: this.#config.camera.far
      });
    }

    // Dice factory needs metrics, so it comes after the viewport is set.
    this.#diceFactory = new DiceFactory({
      physics: this.#physics,
      renderer: this.#renderer,
      diceRegistry: this.#diceRegistry,
      getMetrics: () => this.#viewport.getMetrics(),
      style: this.#config.diceStyle,
      mass: this.#config.mass,
      linearDamping: this.#config.linearDamping,
      angularDamping: this.#config.angularDamping
    });

    this.#updateSpawnProfile();
    this.#initialized = true;
  }

  /**
   * Build the enclosure for the current id on the live physics/renderer.
   *
   * @param {string} id
   * @param {ViewportMetrics} metrics
   * @returns {any}
   */
  #buildEnclosure(id, metrics) {
    if (!this.#physics) {
      throw new Error('World has no physics world; call init() first.');
    }

    const factory = this.#enclosureFactories.get(id);
    if (!factory) {
      throw new RangeError(`Unknown enclosure id: ${id}`);
    }

    const enclosure = factory({ ...this.#enclosureOptions });
    enclosure.createPhysics(this.#physics, metrics);
    if (this.#renderer) {
      enclosure.createVisuals(this.#renderer, metrics);
    }
    this.#enclosure = enclosure;
    this.#enclosureId = id;
    // Keep the public config in sync so consumers that read getConfig()
    // observe the active enclosure after a switch.
    this.#config.enclosure = id;
    return enclosure;
  }

  /**
   * Footprint the floor must cover so the table always reads as the surface
   * the active enclosure rests on. The built-in enclosures expose either
   * `bounds` (box) or `radius` (sphere/cylinder); custom enclosures without
   * either fall back to the scene-sized table.
   *
   * @param {any|null} enclosure
   * @returns {{ width: number, height: number }|null}
   */
  #enclosureFootprint(enclosure) {
    if (!enclosure) return null;

    const margin = 1.15;

    if (
      enclosure.bounds &&
      typeof enclosure.bounds.halfWidth === 'number' &&
      typeof enclosure.bounds.halfHeight === 'number'
    ) {
      return {
        width: enclosure.bounds.halfWidth * 2 * margin,
        height: enclosure.bounds.halfHeight * 2 * margin
      };
    }

    if (typeof enclosure.radius === 'number' && enclosure.radius > 0) {
      const side = enclosure.radius * 2 * margin;
      return { width: side, height: side };
    }

    return null;
  }

  /**
   * Rebuild the table against the current enclosure footprint.
   *
   * @param {ViewportMetrics} metrics
   * @returns {void}
   */
  #syncTable(metrics) {
    this.#tableVisual?.update(metrics, this.#enclosureFootprint(this.#enclosure));
  }

  /**
   * @returns {void}
   */
  #updateSpawnProfile() {
    const enclosureRadius =
      this.#enclosure && typeof this.#enclosure.radius === 'number'
        ? this.#enclosure.radius
        : undefined;
    this.#spawnProfile = createSpawnProfile({
      mode: this.#enclosureId,
      radius: enclosureRadius ?? this.#spawnProfile?.radius ?? 700,
      dieInertia: this.#spawnProfile?.dieInertia ?? 13
    });
  }

  /**
   * @returns {void}
   */
  #assertActive() {
    if (this.#disposed) {
      throw new Error('World has been disposed.');
    }
  }

  /**
   * @returns {void}
   */
  #assertInitialized() {
    this.#assertActive();
    if (!this.#initialized || !this.#physics || !this.#diceFactory) {
      throw new Error('World is not initialized; call init(viewport) first.');
    }
  }

  /**
   * @returns {any}
   */
  get physicsWorld() {
    return this.#physics;
  }

  /**
   * @returns {any|null}
   */
  get renderer() {
    return this.#renderer;
  }

  /**
   * @returns {any|null}
   */
  get enclosure() {
    return this.#enclosure;
  }

  /**
   * @returns {string}
   */
  get enclosureId() {
    return this.#enclosureId;
  }

  /**
   * @returns {number}
   */
  get worldSeq() {
    return this.#worldSeq;
  }

  /**
   * @returns {boolean}
   */
  get disposed() {
    return this.#disposed;
  }

  /**
   * @returns {Record<string, any>}
   */
  getConfig() {
    return { ...this.#config };
  }

  /**
   * Resize from engine-supplied metrics; never reads the DOM.
   *
   * @param {ViewportMetrics} viewport
   * @returns {void}
   */
  resize(viewport) {
    this.#assertInitialized();
    if (!viewport) return;

    const metrics = this.#viewport.update(viewport);

    this.#renderer?.resize?.(metrics);
    this.#enclosure?.update(metrics);
    this.#syncTable(metrics);
    this.#diceFactory?.clearCache();
    this.#updateSpawnProfile();
  }

  /**
   * @param {{ distance?: number, near?: number, far?: number }} settings
   * @returns {void}
   */
  setCamera(settings = {}) {
    this.#assertActive();
    if (settings.distance !== undefined) this.#config.camera.distance = settings.distance;
    if (settings.near !== undefined) this.#config.camera.near = settings.near;
    if (settings.far !== undefined) this.#config.camera.far = settings.far;
    this.#cameraSettings.x = settings.distance ?? this.#cameraSettings.x;
    this.#renderer?.setCamera?.(settings);
  }

  /**
   * @returns {void}
   */
  resetCamera() {
    this.#assertActive();
    // Restore the content camera values so the public config and the
    // renderer agree after a reset.
    this.#config.camera = { ...this.#defaultCamera };
    this.#cameraSettings.x =
      this.#defaultCamera.distance ?? this.#cameraSettings.x;
    this.#renderer?.resetCamera?.();
    if (Object.keys(this.#config.camera).length > 0) {
      this.#renderer?.setCamera?.({ ...this.#config.camera });
    }
  }

  /**
   * Switch enclosure: clears dice, rebuilds boundaries, and emits
   * `enclosure:change`.
   *
   * @param {string|{ id?: string, type?: string }} typeOrDefinition
   * @returns {void}
   */
  setEnclosure(typeOrDefinition) {
    this.#assertInitialized();
    const id =
      typeof typeOrDefinition === 'string'
        ? typeOrDefinition
        : typeOrDefinition?.id ?? typeOrDefinition?.type;

    if (!id || typeof id !== 'string') {
      throw new TypeError('setEnclosure requires an enclosure id.');
    }

    if (!this.#enclosureFactories.has(id)) {
      // Surface a friendly error that matches the enclosures package.
      getEnclosureDefinition(id);
    }

    this.clearDice();

    if (this.#enclosure) {
      try {
        this.#enclosure.dispose(this.#physics, this.#renderer);
      } catch {
        // Preserve switch semantics even if teardown warns.
      }
      this.#enclosure = null;
    }

    this.#buildEnclosure(id, this.#viewport.getMetrics());
    this.#syncTable(this.#viewport.getMetrics());
    this.#updateSpawnProfile();
    this.#rollState.reset();

    this.#events?.emit?.(EVENTS.ENCLOSURE_CHANGE, { type: id, preset: id });
  }

  /**
   * Resize the active built-in enclosure relative to its default size. Explicit
   * numeric `radius`/`height` enclosure options still win over the scale.
   * Clears dice and rebuilds the enclosure/table so boundaries match the shell.
   *
   * @param {number} scale
   * @returns {void}
   */
  setEnclosureScale(scale) {
    this.#assertInitialized();
    const normalized = normalizeEnclosureScale(scale);

    this.#enclosureOptions = {
      ...this.#enclosureOptions,
      scale: normalized
    };
    this.#config.enclosureOptions = {
      ...(this.#config.enclosureOptions ?? {}),
      scale: normalized
    };

    this.clearDice();

    if (this.#enclosure) {
      try {
        this.#enclosure.dispose(this.#physics, this.#renderer);
      } catch {
        // Preserve resize semantics even if teardown warns.
      }
      this.#enclosure = null;
    }

    const metrics = this.#viewport.getMetrics();
    this.#buildEnclosure(this.#enclosureId, metrics);
    this.#syncTable(metrics);
    this.#updateSpawnProfile();
    this.#rollState.reset();

    this.#events?.emit?.(EVENTS.ENCLOSURE_CHANGE, {
      type: this.#enclosureId,
      preset: this.#enclosureId,
      scale: normalized
    });
  }

  /**
   * Update render lighting. Position components are scene-relative multiples
   * of the largest scene dimension.
   *
   * @param {{ position?: { x?: number, y?: number, z?: number }|null }} [settings]
   * @returns {void}
   */
  setLight(settings = {}) {
    this.#assertActive();
    this.#renderer?.setLight?.(settings);
  }

  /**
   * Next stable die id. Ids are never reused, even after removal.
   *
   * @param {string} [prefix]
   * @returns {string}
   */
  #nextDieId(prefix) {
    this.#dieCounter += 1;
    return prefix ? `die-${this.#worldSeq}-${prefix}-${this.#dieCounter}` : `die-${this.#worldSeq}-${this.#dieCounter}`;
  }

  /**
   * Create throw vectors for a roll, or return the supplied vectors.
   *
   * @param {{ dice?: number, count?: number, definition?: string, seed?: string|number, mode?: string, vectors?: any[] }} [request]
   * @returns {{ vectors: any[], seed: string|number, dice: number, spawnProfile: Record<string, any>, definition: string }}
   */
  createThrowPlan(request = {}) {
    this.#assertInitialized();
    const count =
      request.dice ?? request.count ?? this.#config.diceCount ?? 6;
    const definitionId =
      typeof request.definition === 'string'
        ? request.definition
        : this.#config.diceDefinition;

    // Explicit vectors bypass generation.
    if (Array.isArray(request.vectors)) {
      const seed = request.seed ?? this.#mintSeed();
      return {
        vectors: request.vectors.slice(),
        seed,
        dice: request.vectors.length,
        spawnProfile: this.getSpawnProfile(),
        definition: definitionId
      };
    }

    const seed = request.seed !== undefined && request.seed !== null ? request.seed : this.#mintSeed();

    // A forked stream keeps repeated plans with the same seed identical and
    // never advances the parent stream.
    const planRng = this.#rng.fork(seed);
    const metrics = this.#viewport.getMetrics();
    const { sceneWidth, sceneHeight } = metrics;

    const rawX = (planRng.next() * 2 - 1) * sceneWidth;
    const rawY = -(planRng.next() * 2 - 1) * sceneHeight;
    const distance = Math.hypot(rawX, rawY) || 1;
    const direction = { x: rawX / distance, y: rawY / distance };
    const boost = (planRng.next() + 3) * distance;

    const vectors = buildThrowVectors({
      direction,
      boost,
      count,
      rng: planRng,
      metrics,
      spawnProfile: this.#spawnProfile,
      dieInertia: this.#spawnProfile?.dieInertia ?? 13,
      // Auto-generated plans: this boost ((rnd + 3) * distance) is already
      // calibrated to the legacy throw velocities, so the unified flick
      // strength (THROW_STRENGTH) must not multiply it again.
      strength: 1
    });

    return {
      vectors,
      seed,
      dice: count,
      spawnProfile: this.getSpawnProfile(),
      definition: definitionId
    };
  }

  /**
   * Mint a seed from the parent stream for plans without an explicit seed.
   *
   * @returns {string}
   */
  #mintSeed() {
    return `seed-${this.#rollCounter + 1}-${Math.floor(this.#rng.next() * 1e9)}`;
  }

  /**
   * Spawn dice, honouring `keep` for partial rerolls. Without `keep`, previous
   * dice are replaced. Face mappings are applied before the roll.
   *
   * @param {SpawnDiceSpec} [spec]
   * @returns {any[]} Created DiceEntity objects.
   */
  spawnDice(spec = {}) {
    this.#assertInitialized();
    if (!this.#diceFactory) {
      throw new Error('World dice factory is not ready.');
    }

    const definitionId =
      typeof spec.definition === 'string'
        ? spec.definition
        : this.#config.diceDefinition;
    const definition = this.#diceRegistry.get(definitionId);

    const keep = spec.keep ? [...spec.keep] : null;

    if (keep) {
      const keepSet = new Set(keep);
      const toRemove = this.#diceSet
        .getDiceIds()
        .filter((/** @type {string} */ id) => !keepSet.has(id));
      this.removeDice(toRemove);
    } else {
      this.clearDice();
    }

    const keptDice = keep ? this.#diceSet.getDice() : [];
    // Kept dice keep their order; new dice append after them.
    const keptCount = keptDice.length;

    let count = spec.dice ?? spec.count ?? this.#config.diceCount;
    if (keep) {
      const total = spec.dice ?? spec.count ?? this.#config.diceCount;
      count = Math.max(0, total - keptCount);
    }

    /** @type {any[]} */
    let vectors = [];
    if (Array.isArray(spec.vectors)) {
      vectors = spec.vectors.slice();
    } else if (count > 0) {
      const plan = this.createThrowPlan({
        dice: count,
        definition: definitionId,
        seed: spec.seed
      });
      vectors = plan.vectors;
      // The plan seed is recorded for reproducibility.
      if (spec.seed === undefined) {
        spec = { ...spec, seed: plan.seed };
      }
    }

    const faceMappings = Array.isArray(spec.faceMappings)
      ? spec.faceMappings
      : [];

    /** @type {any[]} */
    const created = [];

    for (let index = 0; index < count; index += 1) {
      const vector = vectors[index] ?? {};
      const position = vector.pos ?? vector.position ?? { x: 0, y: 0, z: 200 };
      const velocity = vector.velocity ?? { x: 0, y: 0, z: 0 };
      const angularVelocity = vector.angle ?? vector.angularVelocity ?? { x: 0, y: 0, z: 0 };

      const id = this.#nextDieId();
      const faceMapping =
        faceMappings[index] !== undefined
          ? faceMappings[index]
          : (spec.faceMappings && keptCount === 0
              ? undefined
              : undefined);

      const die = this.#diceFactory.createDie({
        id,
        definition,
        position: { x: position.x, y: position.y, z: position.z },
        velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
        angularVelocity: {
          x: angularVelocity.x,
          y: angularVelocity.y,
          z: angularVelocity.z
        },
        axis: vector.axis,
        quaternion: vector.quaternion,
        faceMapping: faceMapping ?? undefined,
        selected: false,
        state: 'rolling'
      });

      // Apply an explicit mapping before the roll settles.
      if (faceMappings[index] !== undefined) {
        die.setFaceMapping(faceMappings[index]);
      }

      this.#diceSet.add(die);
      created.push(die);

      this.#events?.emit?.(EVENTS.DIE_SPAWN, { dieId: die.id, index: keptCount + index });
    }

    this.#rollState.beginRoll({
      rollId: this.#activeRollId,
      mode: spec.mode ?? this.#rollState.mode,
      diceIds: this.#diceSet.getDiceIds()
    });

    return created;
  }

  /**
   * @param {string[]} ids
   * @returns {void}
   */
  removeDice(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const removed = this.#diceSet.remove(ids);

    for (const die of removed) {
      if (die.body && this.#physics) {
        try {
          this.#physics.removeBody(die.body);
        } catch {
          // Ignore removal errors during teardown.
        }
      }
      try {
        die.dispose();
      } catch {
        // Ignore visual teardown errors.
      }
      this.#events?.emit?.(EVENTS.DIE_REMOVE, { dieId: die.id });
    }
  }

  /**
   * @returns {void}
   */
  clearDice() {
    this.removeDice(this.#diceSet.getDiceIds());
  }

  /**
   * Zero velocities and mark dice idle without removing them.
   *
   * @returns {void}
   */
  resetDice() {
    this.#assertInitialized();
    for (const die of this.#diceSet.getDice()) {
      if (die.body) {
        die.body.setVelocity({ x: 0, y: 0, z: 0 });
        die.body.setAngularVelocity({ x: 0, y: 0, z: 0 });
      }
      die.state = 'idle';
    }
    this.#rollState.reset();
  }

  /**
   * @returns {any[]}
   */
  getDice() {
    return this.#diceSet.getDice();
  }

  /**
   * @returns {string[]}
   */
  getDiceIds() {
    return this.#diceSet.getDiceIds();
  }

  /**
   * @returns {string[]}
   */
  getSelection() {
    return this.#diceSet.getSelection();
  }

  /**
   * @param {string[]} ids
   * @returns {void}
   */
  setSelection(ids) {
    this.#assertInitialized();
    const result = this.#diceSet.setSelection(ids ?? []);
    for (const dieId of result.changed) {
      const die = this.#diceSet.getById(dieId);
      this.#events?.emit?.(EVENTS.DIE_SELECT, {
        dieId,
        selected: die ? die.selected : false
      });
    }
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  toggleSelection(id) {
    this.#assertInitialized();
    const result = this.#diceSet.toggleSelection(id);
    if (result) {
      this.#events?.emit?.(EVENTS.DIE_SELECT, {
        dieId: result.dieId,
        selected: result.selected
      });
    }
  }

  /**
   * @returns {ViewportMetrics}
   */
  getMetrics() {
    return this.#viewport.getMetrics();
  }

  /**
   * @returns {Record<string, any>}
   */
  getSpawnProfile() {
    return { ...this.#spawnProfile };
  }

  /**
   * @param {{ x: number, y: number }} ndc
   * @returns {{ dieId: string, distance: number, point: { x: number, y: number, z: number } }|null}
   */
  pick(ndc) {
    this.#assertInitialized();
    if (!this.#renderer) return null;
    return this.#renderer.pick(ndc, this.getDiceIds());
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {void}
   */
  setGravity(x, y, z) {
    this.#assertInitialized();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new TypeError('setGravity requires finite numbers.');
    }
    this.#physics.setGravity(x, y, z);
    this.#config.gravity = { x, y, z };
    this.#events?.emit?.(EVENTS.PHYSICS_GRAVITY, { x, y, z });
  }

  /**
   * @returns {{ x: number, y: number, z: number }}
   */
  getGravity() {
    this.#assertInitialized();
    return this.#physics.getGravity();
  }

  /**
   * @param {string[]} ids
   * @param {{ x: number, y: number, z: number }} impulse
   * @param {{ x: number, y: number, z: number }} [worldPoint]
   * @returns {void}
   */
  applyImpulse(ids, impulse, worldPoint) {
    this.#assertInitialized();
    if (!isFiniteVector(impulse)) {
      throw new TypeError('applyImpulse requires a finite impulse vector.');
    }

    const targets =
      Array.isArray(ids) && ids.length > 0
        ? ids
        : this.getDiceIds();

    for (const id of targets) {
      const die = this.#diceSet.getById(id);
      if (die?.body) {
        die.body.applyImpulse(
          { x: impulse.x, y: impulse.y, z: impulse.z },
          worldPoint && isFiniteVector(worldPoint) ? { ...worldPoint } : undefined
        );
      }
    }
  }

  /**
   * Apply a randomised impulse to every die. Used by motion shake and demos.
   *
   * @param {number} intensity
   * @returns {void}
   */
  jostle(intensity) {
    this.#assertInitialized();
    if (!(intensity > 0) || !Number.isFinite(intensity)) {
      throw new RangeError('jostle requires a positive finite intensity.');
    }

    for (const die of this.#diceSet.getDice()) {
      if (!die.body) continue;
      const direction = {
        x: (this.#rng.next() * 2 - 1) * intensity,
        y: (this.#rng.next() * 2 - 1) * intensity,
        z: (this.#rng.next() * 2 - 1) * intensity
      };
      die.body.applyImpulse(direction);
      die.body.wakeUp?.();
    }
  }

  /**
   * @param {{ definition?: string, count?: number, dice?: number, style?: string|any }} config
   * @returns {void}
   */
  setDiceConfig(config = {}) {
    this.#assertActive();
    if (config.definition !== undefined) {
      const definition = this.#diceRegistry.get(config.definition);
      this.#config.diceDefinition = definition.id;
    }
    const count = config.count ?? config.dice;
    if (count !== undefined) {
      if (!Number.isInteger(count) || count < 0) {
        throw new RangeError('setDiceConfig count must be a non-negative integer.');
      }
      this.#config.diceCount = count;
    }
    if (config.style !== undefined) {
      this.#config.diceStyle = config.style;
      this.#diceFactory?.setStyle(config.style);
    }
  }

  /**
   * @param {Partial<SettleConfig>|null|undefined} partial
   * @returns {SettleConfig}
   */
  setSettleConfig(partial) {
    this.#assertActive();
    return this.#rollState.setSettleConfig(partial ?? {});
  }

  /**
   * @returns {SettleConfig}
   */
  getSettleConfig() {
    return this.#rollState.getSettleConfig();
  }

  /**
   * Start a roll: spawn dice (honouring keep/mappings) and record the roll.
   * The world owns no loop; the engine steps it to settle.
   *
   * @param {SpawnDiceSpec & { id?: string, values?: number[] }} [request]
   * @returns {{ id: string, request: any, seed: string|number|undefined, vectors: any[], diceIds: string[] }}
   */
  roll(request = {}) {
    this.#assertInitialized();

    this.#rollCounter += 1;
    const rollId = request.id ?? `roll-${this.#rollCounter}`;
    this.#activeRollId = rollId;
    this.#activeRollRequest = request;
    this.#rollStartedAt = Date.now();

    this.#rollState.beginRoll({
      rollId,
      mode: request.mode ?? 'standard',
      diceIds: []
    });

    // A caller may supply vectors directly or ask for a plan. Keep the plan
    // vectors so the roll descriptor can report the seed.
    /** @type {{ vectors: any[], seed: string|number|undefined }} */
    let plan = { vectors: [], seed: request.seed ?? undefined };
    if (!Array.isArray(request.vectors)) {
      const count =
        request.dice ??
        request.count ??
        this.#config.diceCount;
      const resolved = this.createThrowPlan({
        dice: count,
        definition: request.definition,
        seed: request.seed
      });
      plan = { vectors: resolved.vectors, seed: resolved.seed };
      request = { ...request, vectors: plan.vectors, seed: plan.seed };
    }

    this.spawnDice(request);

    return {
      id: rollId,
      request: { ...request },
      seed: plan.seed,
      vectors: plan.vectors,
      diceIds: this.getDiceIds()
    };
  }

  /**
   * Advance physics by dt, sync visuals, and update settle progress.
   *
   * @param {number} dt
   * @returns {void}
   */
  step(dt) {
    this.#assertInitialized();
    if (!(dt > 0)) {
      throw new RangeError('World.step requires a positive delta time.');
    }

    this.#physics.step(dt);
    this.sync();

    const result = this.#rollState.update(this.#diceSet.getDice());

    if (this.#activeRollId) {
      this.#events?.emit?.(EVENTS.ROLL_PROGRESS, {
        rollId: this.#activeRollId,
        settled: result.settled,
        total: this.#diceSet.size
      });
    }
  }

  /**
   * @returns {void}
   */
  sync() {
    MeshBodySync.syncList(this.#diceSet.getDice());
  }

  /**
   * @param {number} [_alpha]
   * @returns {void}
   */
  render(_alpha) {
    if (this.#disposed || this.#renderer == null) return;
    this.sync();
    this.#renderer.render();
  }

  /**
   * @returns {number[]}
   */
  getValues() {
    /** @type {number[]} */
    const values = [];
    for (const die of this.#diceSet.getDice()) {
      if (typeof die.value === 'number') {
        values.push(die.value);
      }
    }
    return values;
  }

  /**
   * @returns {boolean}
   */
  areDiceSettled() {
    if (this.#diceSet.size === 0) return false;
    return this.#rollState.areSettled();
  }

  /**
   * Build the canonical roll result for the current dice.
   *
   * @param {string|number|null} [seed]
   * @returns {{ id: string, values: number[], total: number, dice: Array<{ id: string, value: number, selected: boolean, position: { x: number, y: number, z: number } }>, seed?: string|number|null, durationMs?: number, request?: any }}
   */
  getRollResult(seed) {
    const values = this.getValues();
    return {
      id: this.#activeRollId ?? `roll-${this.#rollCounter || 1}`,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
      dice: this.#diceSet.getDice().map((/** @type {any} */ die) => ({
        id: die.id,
        value: typeof die.value === 'number' ? die.value : 0,
        selected: die.selected,
        position: die.body ? die.body.getPosition() : { x: 0, y: 0, z: 0 }
      })),
      seed: seed ?? this.#activeRollRequest?.seed,
      durationMs: this.#rollStartedAt
        ? Date.now() - this.#rollStartedAt
        : undefined,
      request: this.#activeRollRequest ?? undefined
    };
  }

  /**
   * Build an equivalent headless prediction session. The live world is never
   * stepped, rendered, or mutated.
   *
   * @param {{ vectors?: any[], diceStates?: any[], dice?: number, count?: number, enclosure?: string, seed?: string|number, definition?: string }} [options]
   * @returns {PredictionSession}
   */
  createPredictionSession(options = {}) {
    this.#assertInitialized();
    if (!this.#physics) {
      throw new Error('World has no physics world; call init(viewport) first.');
    }

    const metrics = this.#viewport.getMetrics();
    const settleConfig = this.#rollState.getSettleConfig();

    const physics = this.#physicsFactory({
      gravity: this.#physics.getGravity(),
      iterations: this.#config.physicsIterations
    });
    const predictionPhysics =
      physics?.physics ?? physics?.physicsWorld ?? physics;

    const enclosureId = options.enclosure ?? this.#enclosureId;
    if (
      typeof enclosureId === 'string' &&
      !this.#enclosureFactories.has(enclosureId)
    ) {
      getEnclosureDefinition(enclosureId);
    }

    const factory = this.#enclosureFactories.get(enclosureId);
    if (!factory) {
      throw new RangeError(`Unknown enclosure id: ${String(enclosureId)}`);
    }
    const enclosure = factory({ ...this.#enclosureOptions });
    enclosure.createPhysics(predictionPhysics, metrics);

    const definitionId =
      typeof options.definition === 'string'
        ? options.definition
        : this.#config.diceDefinition;
    const definition = this.#diceRegistry.get(definitionId);

    const diceFactory = new DiceFactory({
      physics: predictionPhysics,
      renderer: null,
      diceRegistry: this.#diceRegistry,
      getMetrics: () => metrics,
      style: this.#config.diceStyle,
      mass: this.#config.mass,
      linearDamping: this.#config.linearDamping,
      angularDamping: this.#config.angularDamping
    });

    /** @type {any[]} */
    const dice = [];

    if (Array.isArray(options.diceStates) && options.diceStates.length > 0) {
      options.diceStates.forEach((/** @type {any} */ state, index) => {
        const transform = stateToTransform(state, index);
        const id = this.#nextDieId(`pred-${index + 1}`);
        dice.push(
          diceFactory.createDie({
            id,
            definition,
            position: transform.position,
            velocity: transform.velocity,
            angularVelocity: transform.angularVelocity,
            quaternion: transform.quaternion,
            faceMapping: state?.faceMapping,
            state: 'rolling'
          })
        );
      });
    } else {
      const vectors = Array.isArray(options.vectors)
        ? options.vectors
        : this.createThrowPlan({
            dice: options.dice ?? options.count,
            definition: definitionId,
            seed: options.seed
          }).vectors;

      vectors.forEach((/** @type {any} */ vector, index) => {
        const transform = stateToTransform(vector, index);
        const id = this.#nextDieId(`pred-${index + 1}`);
        dice.push(
          diceFactory.createDie({
            id,
            definition,
            position: transform.position,
            velocity: transform.velocity,
            angularVelocity: transform.angularVelocity,
            quaternion: transform.quaternion,
            axis: vector.axis,
            state: 'rolling'
          })
        );
      });
    }

    // Prediction ids must still be unique within the session; the prefix
    // keeps them distinct from live ids while the shared counter guarantees
    // they are never reused.
    const usedIds = new Set(dice.map((/** @type {any} */ die) => die.id));
    dice.forEach((/** @type {any} */ die, index) => {
      if (usedIds.has(die.id) && dice.indexOf(die) !== index) {
        // Duplicates cannot occur with the shared monotonic counter; this
        // guard documents the invariant for future id schemes.
      }
    });

    return new PredictionSession({
      physics: predictionPhysics,
      enclosure,
      dice,
      settleConfig
    });
  }

  /**
   * Clear dice and re-apply the active content gravity.
   *
   * @returns {void}
   */
  reset() {
    this.#assertInitialized();
    this.clearDice();
    this.#rollState.reset();
    this.#activeRollId = null;
    this.#activeRollRequest = null;
    if (this.#physics && this.#config.gravity) {
      this.#physics.setGravity(
        this.#config.gravity.x,
        this.#config.gravity.y,
        this.#config.gravity.z
      );
    }
  }

  /**
   * Dispose dice, table visual, enclosure, renderer, and physics. Idempotent.
   *
   * @returns {void}
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#initialized = false;

    // Dice first so visuals and bodies are released before their owners.
    try {
      this.clearDice();
    } catch {
      // Already disposed; ignore.
    }

    try {
      this.#tableVisual?.dispose();
    } catch {
      // Ignore.
    }
    this.#tableVisual = null;

    if (this.#enclosure) {
      try {
        this.#enclosure.dispose(this.#physics, this.#renderer);
      } catch {
        // Ignore.
      }
      this.#enclosure = null;
    }

    if (this.#renderer) {
      try {
        this.#renderer.dispose();
      } catch {
        // Ignore.
      }
      this.#renderer = null;
    }

    if (this.#physics) {
      try {
        this.#physics.dispose();
      } catch {
        // Ignore.
      }
      this.#physics = null;
    }

    this.#diceFactory = null;
    this.#activeRollId = null;
    this.#activeRollRequest = null;
  }
}
