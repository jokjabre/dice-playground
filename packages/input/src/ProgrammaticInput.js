/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {Record<string, any>} RollRequest
 */
/**
 * @typedef {Object} InputHostLike
 * @property {(request: RollRequest) => Promise<any>} roll
 * @property {(x: number, y: number, z: number) => void} setGravity
 * @property {(ids: string[], impulse: Vec3, worldPoint?: Vec3) => void} applyImpulse
 * @property {() => string[]} getDiceIds
 * @property {() => string[]} getSelection
 * @property {(ids: string[]) => void} setSelection
 * @property {(id: string) => void} toggleSelection
 * @property {(ndc: { x: number, y: number }) => any} pick
 * @property {() => Record<string, any>} getMetrics
 * @property {() => Record<string, any>} getSpawnProfile
 * @property {{ emit: (name: string, payload: any) => void }} events
 */

/**
 * Programmatic input for tests and demos. It forwards commands to the host
 * without listening to the DOM, so headless and e2e tests can drive the
 * engine deterministically.
 */
export class ProgrammaticInput {
  /** @type {string} */
  id = 'programmatic-input';

  /** @type {InputHostLike|null} */
  #host = null;

  /**
   * @param {InputHostLike} host
   * @returns {void}
   */
  attach(host) {
    this.#host = host;
  }

  /**
   * @returns {void}
   */
  detach() {
    this.#host = null;
  }

  /**
   * @returns {InputHostLike}
   */
  #requireHost() {
    if (!this.#host) {
      throw new Error('ProgrammaticInput is not attached to an input host.');
    }
    return this.#host;
  }

  /**
   * Roll with explicit throw vectors.
   *
   * @param {Array<Record<string, any>>} vectors
   * @returns {Promise<any>}
   */
  throw(vectors) {
    return this.#requireHost().roll({ vectors });
  }

  /**
   * Roll with an arbitrary request.
   *
   * @param {RollRequest} request
   * @returns {Promise<any>}
   */
  roll(request) {
    return this.#requireHost().roll(request);
  }

  /**
   * Pick at normalized device coordinates.
   *
   * @param {{ x: number, y: number }} ndc
   * @returns {any}
   */
  pick(ndc) {
    const host = this.#requireHost();
    if (typeof host.pick !== 'function') {
      throw new Error('ProgrammaticInput host does not provide pick().');
    }
    return host.pick(ndc);
  }

  /**
   * Toggle selection for one die.
   *
   * @param {string} dieId
   * @returns {void}
   */
  toggleSelection(dieId) {
    this.#requireHost().toggleSelection(dieId);
  }

  /**
   * Replace the selection set.
   *
   * @param {string[]} ids
   * @returns {void}
   */
  setSelection(ids) {
    this.#requireHost().setSelection(ids);
  }

  /**
   * @returns {string[]}
   */
  getSelection() {
    return this.#requireHost().getSelection();
  }

  /**
   * @returns {string[]}
   */
  getDiceIds() {
    return this.#requireHost().getDiceIds();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {void}
   */
  setGravity(x, y, z) {
    this.#requireHost().setGravity(x, y, z);
  }

  /**
   * @param {string[]} ids
   * @param {Vec3} impulse
   * @param {Vec3} [worldPoint]
   * @returns {void}
   */
  applyImpulse(ids, impulse, worldPoint) {
    this.#requireHost().applyImpulse(ids, impulse, worldPoint);
  }
}
