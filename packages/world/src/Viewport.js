import { computeViewportMetrics } from '@dice/core';

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
 * @returns {ViewportMetrics}
 */
function defaultMetrics() {
  return computeViewportMetrics({
    containerWidth: 1000,
    containerHeight: 600,
    sceneWidth: 500,
    sceneHeight: 300,
    devicePixelRatio: 1
  });
}

/**
 * @param {ViewportMetrics} metrics
 * @returns {ViewportMetrics}
 */
function cloneMetrics(metrics) {
  return {
    containerWidth: metrics.containerWidth,
    containerHeight: metrics.containerHeight,
    sceneWidth: metrics.sceneWidth,
    sceneHeight: metrics.sceneHeight,
    scale: metrics.scale,
    aspect: metrics.aspect,
    wallHeight: metrics.wallHeight,
    pixelRatio: metrics.pixelRatio
  };
}

/**
 * @param {any} metrics
 * @returns {void}
 */
function assertMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    throw new TypeError('Viewport requires ViewportMetrics.');
  }
  if (!(metrics.sceneWidth > 0) || !(metrics.sceneHeight > 0)) {
    throw new RangeError('ViewportMetrics scene dimensions must be greater than zero.');
  }
  if (!(metrics.containerWidth > 0) || !(metrics.containerHeight > 0)) {
    throw new RangeError('ViewportMetrics container dimensions must be greater than zero.');
  }
}

/**
 * Pure metrics cache for one world. The engine or app shell owns the DOM reads
 * (container sizes and pixel ratio) and supplies the computed
 * metrics; this class never touches the DOM.
 */
export class Viewport {
  /** @type {ViewportMetrics} */
  #metrics;

  /**
   * @param {ViewportMetrics|null} [metrics]
   */
  constructor(metrics = null) {
    this.#metrics = metrics ? cloneMetrics(metrics) : defaultMetrics();
    if (metrics) assertMetrics(metrics);
  }

  /**
   * Replace the cached metrics with a new viewport.
   *
   * @param {ViewportMetrics} metrics
   * @returns {ViewportMetrics} A copy of the stored metrics.
   */
  update(metrics) {
    assertMetrics(metrics);
    this.#metrics = cloneMetrics(metrics);
    return this.getMetrics();
  }

  /**
   * @returns {ViewportMetrics} A copy of the stored metrics.
   */
  getMetrics() {
    return cloneMetrics(this.#metrics);
  }
}
