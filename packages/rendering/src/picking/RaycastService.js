/**
 * @typedef {Object} PickResult
 * @property {string} dieId
 * @property {number} distance
 * @property {{ x: number, y: number, z: number }} point
 */

/**
 * Thin picking service over a render backend. It never touches Three directly
 * and returns die ids plus world-space points, never meshes.
 */
export class RaycastService {
  /** @type {any} */
  #backend;

  /** @type {any} */
  #scene;

  /** @type {any} */
  #camera;

  /**
   * @param {{ backend: any, scene: any, camera: any }} options
   */
  constructor({ backend, scene, camera }) {
    if (!backend || typeof backend.pick !== 'function') {
      throw new TypeError('RaycastService requires a render backend.');
    }

    this.#backend = backend;
    this.#scene = scene;
    this.#camera = camera;
  }

  /**
   * @param {any} scene
   * @param {any} camera
   * @returns {void}
   */
  setSceneCamera(scene, camera) {
    this.#scene = scene;
    this.#camera = camera;
  }

  /**
   * @param {{ x: number, y: number }} ndc
   * @param {any[]} candidates
   * @returns {PickResult|null}
   */
  pick(ndc, candidates = []) {
    if (!ndc || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) {
      throw new TypeError('RaycastService.pick requires normalized device coordinates.');
    }

    const intersections = this.#backend.pick(
      this.#scene,
      this.#camera,
      ndc,
      candidates
    );

    if (!Array.isArray(intersections) || intersections.length === 0) {
      return null;
    }

    const hit = intersections[0];
    const dieId = findDieId(hit.object);
    if (!dieId) {
      return null;
    }

    return {
      dieId,
      distance: hit.distance,
      point: {
        x: hit.point.x,
        y: hit.point.y,
        z: hit.point.z
      }
    };
  }
}

/**
 * @param {any} object
 * @returns {string|null}
 */
function findDieId(object) {
  /** @type {any} */
  let current = object;

  while (current) {
    if (current.userData && typeof current.userData.dieId === 'string') {
      return current.userData.dieId;
    }
    current = current.parent ?? null;
  }

  return null;
}
