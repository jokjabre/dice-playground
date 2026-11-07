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
 * @typedef {Object} TransformLike
 * @property {Vec3Like} position
 * @property {QuatLike} quaternion
 */

/**
 * Backend-native bodies are stored outside the public object so handles can be
 * passed around without exposing cannon-es classes.
 *
 * @type {WeakMap<BodyHandle, any>}
 */
const nativeBodies = new WeakMap();

/**
 * @param {BodyHandle} handle
 * @returns {any}
 */
export function getNativeBody(handle) {
  return nativeBodies.get(handle) ?? null;
}

/**
 * Public handle for one physics body. Accessors return copies and mutations go
 * through explicit commands. No live backend vector or body object escapes.
 */
export class BodyHandle {
  /** @type {string} */
  id;

  /** @type {any} */
  #backend;

  /** @type {any} */
  #body;

  /**
   * @param {any} backend
   * @param {any} body
   * @param {string} id
   */
  constructor(backend, body, id) {
    this.#backend = backend;
    this.#body = body;
    this.id = id;
    nativeBodies.set(this, body);
  }

  get mass() {
    return this.#backend.getMass(this.#body);
  }

  get isStatic() {
    return this.#backend.isStatic(this.#body);
  }

  /** @returns {Vec3Like} */
  getPosition() {
    return this.#backend.getPosition(this.#body);
  }

  /** @returns {QuatLike} */
  getQuaternion() {
    return this.#backend.getQuaternion(this.#body);
  }

  /** @returns {Vec3Like} */
  getVelocity() {
    return this.#backend.getVelocity(this.#body);
  }

  /** @returns {Vec3Like} */
  getAngularVelocity() {
    return this.#backend.getAngularVelocity(this.#body);
  }

  /** @returns {string} */
  getSleepState() {
    return this.#backend.getSleepState(this.#body);
  }

  /** @returns {{ linear: number, angular: number }} */
  getDamping() {
    return this.#backend.getDamping(this.#body);
  }

  /** @returns {TransformLike} */
  getTransform() {
    return {
      position: this.getPosition(),
      quaternion: this.getQuaternion()
    };
  }

  /**
   * @param {{ position?: Vec3Like, quaternion?: QuatLike }} transform
   */
  setTransform(transform) {
    this.#backend.setTransform(this.#body, transform);
  }

  /** @param {Vec3Like} velocity */
  setVelocity(velocity) {
    this.#backend.setVelocity(this.#body, velocity);
  }

  /** @param {Vec3Like} velocity */
  setAngularVelocity(velocity) {
    this.#backend.setAngularVelocity(this.#body, velocity);
  }

  /** @param {number} mass */
  setMass(mass) {
    this.#backend.setMass(this.#body, mass);
  }

  /**
   * @param {number} linear
   * @param {number} angular
   */
  setDamping(linear, angular) {
    this.#backend.setDamping(this.#body, linear, angular);
  }

  /**
   * Apply an impulse. When `worldPoint` is supplied it is treated as a point in
   * world space; the backend converts it to the body-relative point required by
   * cannon-es.
   *
   * @param {Vec3Like} impulse
   * @param {Vec3Like} [worldPoint]
   */
  applyImpulse(impulse, worldPoint) {
    this.#backend.applyImpulse(this.#body, impulse, worldPoint);
  }

  /** @param {Vec3Like} force */
  applyForce(force) {
    this.#backend.applyForce(this.#body, force);
  }

  wakeUp() {
    this.#backend.wakeUp(this.#body);
  }
}
