import { createRenderConfig } from '../config/defaults.js';

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
 * @typedef {import('../config/defaults.js').RenderConfig} RenderConfig
 */

/**
 * @typedef {Object} CameraSettings
 * @property {number} distance Multiplier on the automatic wall-height distance.
 * @property {number} near Near plane; `0` keeps the default.
 * @property {number} far Far plane; `0` derives it from the distance.
 */

/**
 * Metrics-driven camera controller. The DOM is never read here; callers pass
 * shared `ViewportMetrics`.
 */
export class CameraController {
  /** @type {any} */
  #backend;

  /** @type {any} */
  #camera;

  /** @type {RenderConfig} */
  #config;

  /** @type {CameraSettings} */
  #settings;

  /** @type {ViewportMetrics|null} */
  #metrics = null;

  /**
   * @param {{ backend: any, config?: Partial<RenderConfig> }} options
   */
  constructor({ backend, config = {} }) {
    if (!backend || typeof backend.createCamera !== 'function') {
      throw new TypeError('CameraController requires a render backend.');
    }

    this.#backend = backend;
    this.#config = createRenderConfig(config);
    this.#settings = this.#defaultSettings();
    this.#camera = backend.createCamera({
      fov: this.#config.fov,
      aspect: this.#config.aspect,
      near: this.#config.near,
      far: this.#config.far
    });
  }

  /** @returns {any} Opaque camera handle. */
  get camera() {
    return this.#camera;
  }

  /** @returns {CameraSettings} */
  get settings() {
    return { ...this.#settings };
  }

  /**
   * @returns {CameraSettings}
   */
  #defaultSettings() {
    return {
      distance:
        this.#config.cameraDistance > 0 ? this.#config.cameraDistance : 1,
      near: this.#config.cameraNear > 0 ? this.#config.cameraNear : 1,
      far: this.#config.cameraFar > 0 ? this.#config.cameraFar : 0
    };
  }

  /**
   * Update aspect, position, and projection from shared viewport metrics.
   *
   * @param {ViewportMetrics} metrics
   * @returns {void}
   */
  update(metrics) {
    if (!metrics) return;
    this.#metrics = metrics;

    if (metrics.sceneWidth > 0 && metrics.sceneHeight > 0) {
      this.#camera.aspect = metrics.sceneWidth / metrics.sceneHeight;
    }

    this.#applyProjection();
  }

  /**
   * Apply app/content camera settings. Values are multipliers/overrides, matching
   * the legacy `camera_distance`, `camera_near`, and `camera_far` options.
   *
   * @param {{ distance?: number, near?: number, far?: number }} [settings]
   * @returns {void}
   */
  set(settings = {}) {
    if (settings.distance !== undefined && settings.distance > 0) {
      this.#settings.distance = settings.distance;
    }
    if (settings.near !== undefined && settings.near > 0) {
      this.#settings.near = settings.near;
    }
    if (settings.far !== undefined && settings.far > 0) {
      this.#settings.far = settings.far;
    }

    this.#applyProjection();
  }

  /**
   * Restore content defaults.
   *
   * @returns {void}
   */
  reset() {
    this.#settings = this.#defaultSettings();
    this.#applyProjection();
  }

  /**
   * @param {number} aspect
   * @returns {void}
   */
  setAspect(aspect) {
    if (!(aspect > 0)) return;
    this.#camera.aspect = aspect;
    this.#camera.updateProjectionMatrix();
  }

  /** @returns {void} */
  #applyProjection() {
    if (this.#metrics && this.#metrics.wallHeight > 0) {
      const distance = this.#metrics.wallHeight * this.#settings.distance;
      this.#camera.position.z = distance;
      this.#camera.near = this.#settings.near;
      this.#camera.far =
        this.#settings.far > 0 ? this.#settings.far : distance + 1500;
    } else {
      this.#camera.near = this.#settings.near;
      this.#camera.far =
        this.#settings.far > 0
          ? this.#settings.far
          : /** @type {RenderConfig} */ (this.#config).far;
    }

    this.#camera.updateProjectionMatrix();
  }

  /** @returns {void} */
  dispose() {
    this.#camera = null;
  }
}
