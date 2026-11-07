import { BodyHandle, getNativeBody } from './BodyHandle.js';
import { ContactManager } from './ContactManager.js';
import { createCannonEsBackend } from './backends/cannon-es/CannonEsBackend.js';
import {
  DEFAULT_BODY_MATERIAL,
  DEFAULT_GRAVITY,
  DEFAULT_MASS,
  DEFAULT_SOLVER_ITERATIONS
} from './config/defaults.js';

/**
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} QuatLike
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @typedef {Object} BodySpec
 * @property {import('./shapes.js').ShapeDescriptor} shape
 * @property {number} [mass]
 * @property {string} [material]
 * @property {{ position?: Vec3Like, quaternion?: QuatLike }} [transform]
 * @property {number} [linearDamping]
 * @property {number} [angularDamping]
 * @property {string} [id]
 */

/**
 * @typedef {Object} PhysicsWorldConfig
 * @property {any} [backend]
 * @property {Vec3Like} [gravity]
 * @property {number} [iterations]
 * @property {Record<string, { friction?: number, restitution?: number }>} [materials]
 */

/**
 * Backend-neutral physics world. Owns body handles, named contact materials,
 * gravity, solver tuning, and post-step callbacks. Direct backend access is
 * private; nothing from cannon-es is exposed.
 */
export class PhysicsWorld {
  /** @type {any} */
  #backend;

  /** @type {any} */
  #world;

  /** @type {ContactManager} */
  #contactManager;

  /** @type {Map<string, BodyHandle>} */
  #bodies = new Map();

  /** @type {Set<(world: PhysicsWorld, dt: number) => void>} */
  #postSteps = new Set();

  /** @type {number} */
  #bodySequence = 0;

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {PhysicsWorldConfig} [config]
   */
  constructor(config = {}) {
    this.#backend = config.backend ?? createCannonEsBackend();
    this.#world = this.#backend.createWorld({
      gravity: config.gravity ?? DEFAULT_GRAVITY,
      iterations: config.iterations ?? DEFAULT_SOLVER_ITERATIONS
    });
    this.#contactManager = new ContactManager({
      backend: this.#backend,
      world: this.#world,
      contacts: config.materials
    });
  }

  /**
   * @param {BodySpec} [spec]
   * @returns {BodyHandle}
   */
  createBody(spec = /** @type {BodySpec} */ ({})) {
    this.#assertActive();

    if (!spec.shape) {
      throw new TypeError('PhysicsWorld.createBody requires a shape descriptor.');
    }

    const id = spec.id ?? `body-${++this.#bodySequence}`;
    if (this.#bodies.has(id)) {
      throw new Error(`Physics body id already exists: ${id}`);
    }

    const nativeBody = this.#backend.createBody(this.#world, {
      shape: spec.shape,
      mass: spec.mass ?? DEFAULT_MASS,
      material: spec.material ?? DEFAULT_BODY_MATERIAL,
      transform: spec.transform,
      linearDamping: spec.linearDamping,
      angularDamping: spec.angularDamping
    });

    const handle = new BodyHandle(this.#backend, nativeBody, id);
    this.#bodies.set(id, handle);
    return handle;
  }

  /**
   * @param {BodyHandle} body
   */
  removeBody(body) {
    this.#assertActive();
    const nativeBody = getNativeBody(body);
    if (!nativeBody) return;

    this.#backend.removeBody(this.#world, nativeBody);
    this.#bodies.delete(body.id);
  }

  /** @returns {BodyHandle[]} */
  getBodies() {
    return [...this.#bodies.values()];
  }

  /**
   * @param {number} dt Delta time in seconds.
   */
  step(dt) {
    this.#assertActive();
    if (!(dt > 0)) {
      throw new RangeError('PhysicsWorld.step requires a positive delta time.');
    }

    this.#backend.step(this.#world, dt);

    for (const callback of [...this.#postSteps]) {
      try {
        callback(this, dt);
      } catch (error) {
        console.warn('PhysicsWorld postStep callback failed:', error);
      }
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setGravity(x, y, z) {
    this.#assertActive();
    this.#backend.setGravity(this.#world, x, y, z);
  }

  /**
   * @returns {{ x: number, y: number, z: number }}
   */
  getGravity() {
    this.#assertActive();
    return this.#backend.getGravity(this.#world);
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {{ friction?: number, restitution?: number }} settings
   * @returns {{ friction: number, restitution: number }}
   */
  setContactMaterial(materialA, materialB, settings) {
    this.#assertActive();
    return this.#contactManager.setContactMaterial(materialA, materialB, settings);
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @returns {{ friction: number, restitution: number }|null}
   */
  getContactMaterial(materialA, materialB) {
    this.#assertActive();
    return this.#contactManager.getContactMaterial(materialA, materialB);
  }

  /** @returns {string[]} */
  getMaterialNames() {
    this.#assertActive();
    return this.#contactManager.getMaterialNames();
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {number} friction
   */
  setFriction(materialA, materialB, friction) {
    this.#assertActive();
    this.#contactManager.setFriction(materialA, materialB, friction);
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {number} restitution
   */
  setRestitution(materialA, materialB, restitution) {
    this.#assertActive();
    this.#contactManager.setRestitution(materialA, materialB, restitution);
  }

  /**
   * @param {number} iterations
   */
  setSolverIterations(iterations) {
    this.#assertActive();
    if (!Number.isInteger(iterations) || iterations < 1) {
      throw new RangeError('Solver iterations must be an integer of at least 1.');
    }
    this.#backend.setSolverIterations(this.#world, iterations);
  }

  /**
   * @param {(world: PhysicsWorld, dt: number) => void} callback
   * @returns {() => void} Unsubscribe function.
   */
  addPostStep(callback) {
    this.#assertActive();
    this.#postSteps.add(callback);
    return () => this.removePostStep(callback);
  }

  /**
   * @param {(world: PhysicsWorld, dt: number) => void} callback
   */
  removePostStep(callback) {
    this.#postSteps.delete(callback);
  }

  dispose() {
    if (this.#disposed) return;

    this.#postSteps.clear();
    this.#bodies.clear();
    this.#contactManager.dispose();
    this.#backend.disposeWorld(this.#world);
    this.#disposed = true;
  }

  #assertActive() {
    if (this.#disposed) {
      throw new Error('PhysicsWorld has been disposed.');
    }
  }
}
