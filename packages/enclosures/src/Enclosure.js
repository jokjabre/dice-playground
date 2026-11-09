/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

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
 */

/**
 * @typedef {Object} BodySpec
 * @property {Record<string, any>} shape
 * @property {number} [mass]
 * @property {string} [material]
 * @property {{ position?: Vec3, quaternion?: { x: number, y: number, z: number, w: number } }} [transform]
 * @property {string} [id]
 */

/**
 * @typedef {Object} PhysicsBodyHandle
 * @property {string} id
 * @property {number} mass
 * @property {() => Vec3} getPosition
 * @property {() => { x: number, y: number, z: number, w: number }} getQuaternion
 * @property {() => Vec3} getVelocity
 * @property {() => Vec3} getAngularVelocity
 * @property {(transform: { position?: Vec3 }) => void} setTransform
 * @property {(velocity: Vec3) => void} setVelocity
 */

/**
 * @typedef {Object} PhysicsWorldLike
 * @property {(spec: BodySpec) => PhysicsBodyHandle} createBody
 * @property {(body: PhysicsBodyHandle) => void} removeBody
 * @property {() => PhysicsBodyHandle[]} getBodies
 * @property {(callback: (world: PhysicsWorldLike, dt: number) => void) => (() => void)|void} addPostStep
 * @property {(callback: (world: PhysicsWorldLike, dt: number) => void) => void} removePostStep
 */

/**
 * @typedef {Object} VisualHandle
 * @property {string} id
 * @property {(transform: { position?: Vec3 }) => void} setTransform
 * @property {(visible: boolean) => void} setVisible
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} RenderSceneLike
 * @property {(descriptor: Record<string, any>) => VisualHandle} createEnclosureVisual
 */

/**
 * Base class for enclosures.
 *
 * Subclasses implement `buildPhysics`, `buildVisuals`, and optionally
 * `updatePhysics`. The base class owns the lifecycle: it removes old bodies,
 * visuals, and post-step callbacks before rebuilding, and it never imports a
 * physics or rendering backend.
 */
export class Enclosure {
  /**
   * @param {Record<string, any>} [options]
   */
  constructor(options = {}) {
    this.options = options;
    this.id = typeof options.id === 'string' ? options.id : 'enclosure';
    this.type = 'enclosure';

    /** @type {PhysicsWorldLike|null} */
    this.physicsWorld = null;

    /** @type {RenderSceneLike|null} */
    this.renderScene = null;

    /** @type {ViewportMetrics|null} */
    this.metrics = null;

    /** @type {PhysicsBodyHandle[]} */
    this.physicsBodies = [];

    /** @type {VisualHandle[]} */
    this.visualHandles = [];

    /** @type {Array<() => void>} */
    this.postStepUnsubscribers = [];

    this.disposed = false;
  }

  /**
   * Create the static physics bodies for this enclosure.
   *
   * @param {PhysicsWorldLike} physicsWorld
   * @param {ViewportMetrics} [metrics]
   * @returns {PhysicsBodyHandle[]}
   */
  createPhysics(physicsWorld, metrics) {
    if (this.disposed) {
      throw new Error('Enclosure has been disposed.');
    }
    if (!physicsWorld) {
      throw new TypeError('Enclosure.createPhysics requires a physics world.');
    }

    this.#clearPhysics(this.physicsWorld ?? physicsWorld);
    this.physicsWorld = physicsWorld;
    if (metrics) this.metrics = metrics;

    this.buildPhysics(physicsWorld, this.#requireMetrics());
    return this.physicsBodies;
  }

  /**
   * Create the visuals that describe this enclosure.
   *
   * @param {RenderSceneLike} renderScene
   * @param {ViewportMetrics} [metrics]
   * @returns {VisualHandle[]}
   */
  createVisuals(renderScene, metrics) {
    if (this.disposed) {
      throw new Error('Enclosure has been disposed.');
    }
    if (!renderScene) {
      throw new TypeError('Enclosure.createVisuals requires a render scene.');
    }

    this.#clearVisuals();
    this.renderScene = renderScene;
    if (metrics) this.metrics = metrics;

    this.buildVisuals(renderScene, this.#requireMetrics());
    return this.visualHandles;
  }

  /**
   * Recompute bodies and visuals from new metrics.
   *
   * @param {ViewportMetrics} metrics
   */
  update(metrics) {
    if (this.disposed || !metrics) return;

    this.metrics = metrics;

    if (this.physicsWorld) {
      this.updatePhysics(metrics);
    }

    if (this.renderScene) {
      this.#clearVisuals();
      this.buildVisuals(this.renderScene, metrics);
    }
  }

  /**
   * Remove bodies, visuals, and post-step callbacks. Idempotent.
   *
   * @param {PhysicsWorldLike|null} [physicsWorld]
   * @param {RenderSceneLike|null} [renderScene]
   */
  dispose(physicsWorld = this.physicsWorld, renderScene = this.renderScene) {
    if (this.disposed) return;

    this.#clearPhysics(physicsWorld);
    this.#clearVisuals();

    this.physicsWorld = null;
    this.renderScene = null;
    this.metrics = null;
    this.disposed = true;

    void renderScene;
  }

  /**
   * @param {PhysicsWorldLike} _physicsWorld
   * @param {ViewportMetrics} _metrics
   */
  buildPhysics(_physicsWorld, _metrics) {
    throw new Error('Enclosure.buildPhysics() must be implemented by a subclass.');
  }

  /**
   * @param {RenderSceneLike} _renderScene
   * @param {ViewportMetrics} _metrics
   */
  buildVisuals(_renderScene, _metrics) {
    throw new Error('Enclosure.buildVisuals() must be implemented by a subclass.');
  }

  /**
   * @param {ViewportMetrics} _metrics
   */
  updatePhysics(_metrics) {}

  /**
   * Create a static plane body and track it.
   *
   * @param {PhysicsWorldLike} physicsWorld
   * @param {{ id: string, normal: Vec3, position: Vec3, material: string }} spec
   * @returns {PhysicsBodyHandle}
   */
  createPlaneBody(physicsWorld, { id, normal, position, material }) {
    const body = physicsWorld.createBody({
      id: `${this.id}-${id}`,
      shape: { type: 'plane', normal },
      mass: 0,
      material,
      transform: { position }
    });

    this.physicsBodies.push(body);
    return body;
  }

  /**
   * Create an enclosure visual and track it.
   *
   * @param {RenderSceneLike} renderScene
   * @param {Record<string, any>} descriptor
   * @param {Vec3} [position]
   * @returns {VisualHandle}
   */
  createVisual(renderScene, descriptor, position) {
    const handle = renderScene.createEnclosureVisual(descriptor);
    if (position) handle.setTransform({ position });
    this.visualHandles.push(handle);
    return handle;
  }

  /**
   * @param {PhysicsWorldLike|null} physicsWorld
   */
  #clearPhysics(physicsWorld) {
    for (const unsubscribe of this.postStepUnsubscribers) {
      unsubscribe();
    }
    this.postStepUnsubscribers = [];

    if (physicsWorld) {
      for (const body of this.physicsBodies) {
        physicsWorld.removeBody(body);
      }
    }

    this.physicsBodies = [];
  }

  #clearVisuals() {
    for (const handle of this.visualHandles) {
      handle.dispose();
    }
    this.visualHandles = [];
  }

  /**
   * @returns {ViewportMetrics}
   */
  #requireMetrics() {
    if (!this.metrics) {
      throw new Error('Enclosure requires viewport metrics before building.');
    }
    return this.metrics;
  }
}
