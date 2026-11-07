import { createRenderConfig } from '../config/defaults.js';

/**
 * @typedef {Object} ViewportMetrics
 * @property {number} sceneWidth
 * @property {number} sceneHeight
 */

/**
 * @typedef {import('../config/defaults.js').RenderConfig} RenderConfig
 */

/**
 * Config-driven ambient + spot lighting rig. All Three objects stay inside the
 * backend; this class only forwards opaque handles.
 */
export class LightingRig {
  /** @type {any} */
  #backend;

  /** @type {RenderConfig} */
  #config;

  /** @type {any} */
  #ambient = null;

  /** @type {any} */
  #spot = null;

  /** @type {any} */
  #scene = null;

  /**
   * @param {{ backend: any, config?: Partial<RenderConfig> }} options
   */
  constructor({ backend, config = {} }) {
    if (!backend || typeof backend.createLight !== 'function') {
      throw new TypeError('LightingRig requires a render backend.');
    }

    this.#backend = backend;
    this.#config = createRenderConfig(config);

    this.#ambient = backend.createLight({
      type: 'ambient',
      color: this.#config.colors.ambient,
      intensity: 1
    });

    this.#spot = backend.createLight({
      type: 'spot',
      color: this.#config.colors.spotlight,
      intensity: this.#config.spotlightIntensity,
      castShadow: this.#config.castShadow,
      target: { x: 0, y: 1, z: 0 }
    });
  }

  /**
   * @param {any} scene
   * @returns {void}
   */
  attach(scene) {
    this.#scene = scene;
    this.#backend.add(scene, this.#ambient);

    if (this.#spot) {
      this.#backend.add(scene, this.#spot);
      if (this.#spot.target) {
        this.#backend.add(scene, this.#spot.target);
      }
    }
  }

  /**
   * @param {any} scene
   * @returns {void}
   */
  detach(scene) {
    this.#backend.remove(scene, this.#ambient);
    if (this.#spot) {
      this.#backend.remove(scene, this.#spot);
      if (this.#spot.target) {
        this.#backend.remove(scene, this.#spot.target);
      }
    }
    if (this.#scene === scene) {
      this.#scene = null;
    }
  }

  /**
   * @param {ViewportMetrics} metrics
   * @returns {void}
   */
  update(metrics) {
    if (!metrics || !this.#spot) return;

    const maxWidth = Math.max(metrics.sceneWidth || 0, metrics.sceneHeight || 0);
    if (maxWidth === 0) return;

    this.#spot.position.set(-maxWidth / 2, maxWidth / 2, maxWidth * 2);
    this.#spot.distance = maxWidth * 5;
    this.#spot.shadowCameraNear = maxWidth / 10;
    this.#spot.shadowCameraFar = maxWidth * 5;
    this.#spot.shadowCameraFov = 50;
  }

  /** @returns {void} */
  dispose() {
    if (this.#scene) {
      this.detach(this.#scene);
    }
    this.#backend.disposeObject(this.#ambient);
    this.#backend.disposeObject(this.#spot);
    this.#ambient = null;
    this.#spot = null;
  }
}
