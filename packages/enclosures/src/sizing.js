/**
 * Pure sizing functions shared by physics and visuals.
 *
 * Every enclosure derives its bodies and its visual descriptors from these
 * values, so resizing cannot make the two representations diverge. The inputs
 * are the shared viewport metrics; no function reads the DOM or a backend.
 */

/**
 * @typedef {Object} MetricsLike
 * @property {number} [sceneWidth]
 * @property {number} [sceneHeight]
 * @property {number} [scale]
 */

/**
 * @typedef {Object} BoxBounds
 * @property {number} halfWidth
 * @property {number} halfHeight
 * @property {number} ceilingHeight
 * @property {number} margin
 */

/**
 * Vertex radius used by the D6 geometry for the current viewport.
 *
 * @param {MetricsLike} [metrics]
 * @returns {number}
 */
export function computeDieRadius(metrics = {}) {
  const scale = metrics.scale ?? 45;
  return Math.max(10, scale * 0.9);
}

/**
 * Half extents and ceiling height for the rectangular tray.
 *
 * @param {MetricsLike} [metrics]
 * @param {{ margin?: number, ceilingHeight?: number }} [options]
 * @returns {BoxBounds}
 */
export function computeBoxBounds(metrics = {}, options = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const margin = options.margin ?? 0.93;
  const ceilingHeight = options.ceilingHeight ?? 2700;

  return {
    halfWidth: width * margin,
    halfHeight: height * margin,
    ceilingHeight,
    margin
  };
}

/**
 * Radius for the spherical enclosure, proportionate to the playing field.
 *
 * @param {MetricsLike} [metrics]
 * @returns {number}
 */
export function computeSphereRadius(metrics = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const minDimension = Math.min(width, height);
  return Math.max(400, Math.min(1800, minDimension * 1.35));
}

/**
 * Radius and height for the cylindrical enclosure.
 *
 * @param {MetricsLike} [metrics]
 * @returns {{ radius: number, height: number }}
 */
export function computeCylinderSize(metrics = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const minDimension = Math.min(width, height);

  return {
    radius: Math.max(200, Math.min(900, minDimension * 0.45)),
    height: Math.max(600, Math.min(1600, minDimension * 1.4))
  };
}
