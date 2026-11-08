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
 *
 * @typedef {Object} TableDescriptor
 * @property {'plane'} type
 * @property {number} width
 * @property {number} height
 * @property {number|string} [color]
 * @property {boolean} [receiveShadow]
 */

/**
 * The table/floor visual composed by the world. The render scene owns no desk;
 * the world creates this plane from content/metrics so physics and visuals
 * share the same dimensions. Headless worlds keep no visual.
 */
export class TableVisual {
  /** @type {any|null} */
  #renderer;

  /** @type {Record<string, any>} */
  #descriptor;

  /** @type {any|null} */
  #visual = null;

  /** @type {ViewportMetrics|null} */
  #metrics = null;

  /**
   * @param {{ renderer?: any|null, descriptor?: { color?: number|string, receiveShadow?: boolean, width?: number, height?: number } }} [options]
   */
  constructor(options = {}) {
    this.#renderer = options.renderer ?? null;
    this.#descriptor = {
      color: options.descriptor?.color,
      receiveShadow: options.descriptor?.receiveShadow,
      width: options.descriptor?.width,
      height: options.descriptor?.height
    };
  }

  /**
   * @param {any|null} renderer
   * @returns {void}
   */
  setRenderer(renderer) {
    this.dispose();
    this.#renderer = renderer;
  }

  /**
   * @returns {any|null}
   */
  get visual() {
    return this.#visual;
  }

  /**
   * Create the table visual for the given metrics. Replaces any previous one.
   *
   * @param {ViewportMetrics} metrics
   * @returns {any|null}
   */
  create(metrics) {
    this.#metrics = metrics;
    this.disposeVisual();
    if (!this.#renderer) return null;

    const width =
      typeof this.#descriptor.width === 'number'
        ? this.#descriptor.width
        : metrics.sceneWidth * 2;
    const height =
      typeof this.#descriptor.height === 'number'
        ? this.#descriptor.height
        : metrics.sceneHeight * 2;

    if (!(width > 0) || !(height > 0)) return null;

    /** @type {TableDescriptor} */
    const descriptor = {
      type: 'plane',
      width,
      height
    };
    if (this.#descriptor.color !== undefined) descriptor.color = this.#descriptor.color;
    if (this.#descriptor.receiveShadow !== undefined) {
      descriptor.receiveShadow = this.#descriptor.receiveShadow;
    }

    this.#visual = this.#renderer.createTableVisual(descriptor);
    return this.#visual;
  }

  /**
   * Rebuild the table visual from new metrics.
   *
   * @param {ViewportMetrics} metrics
   * @returns {any|null}
   */
  update(metrics) {
    return this.create(metrics);
  }

  /**
   * @returns {void}
   */
  dispose() {
    this.disposeVisual();
  }

  /**
   * @returns {void}
   */
  disposeVisual() {
    if (this.#visual) {
      try {
        this.#visual.dispose();
      } catch {
        // Visual disposal is idempotent in the rendering package; ignore
        // teardown errors so world disposal stays reliable.
      }
      this.#visual = null;
    }
  }
}
