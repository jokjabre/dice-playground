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
 * Normalize an enclosure scale option. Non-positive or non-finite values fall
 * back to 1 (the default/initial size).
 *
 * @param {unknown} scale
 * @returns {number}
 */
export function normalizeEnclosureScale(scale) {
  return typeof scale === 'number' && Number.isFinite(scale) && scale > 0
    ? scale
    : 1;
}

/**
 * Half extents and ceiling height for the rectangular tray.
 *
 * @param {MetricsLike} [metrics]
 * @param {{ margin?: number, ceilingHeight?: number, scale?: number }} [options]
 * @returns {BoxBounds}
 */
export function computeBoxBounds(metrics = {}, options = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const margin = options.margin ?? 0.93;
  const ceilingHeight = options.ceilingHeight ?? 2700;
  const scale = normalizeEnclosureScale(options.scale);

  return {
    halfWidth: width * margin * scale,
    halfHeight: height * margin * scale,
    ceilingHeight: ceilingHeight * scale,
    margin
  };
}

/**
 * Radius for the spherical enclosure, proportionate to the playing field.
 * The scale multiplier applies to the default radius; it does not override an
 * explicitly supplied radius.
 *
 * @param {MetricsLike} [metrics]
 * @param {{ scale?: number }} [options]
 * @returns {number}
 */
export function computeSphereRadius(metrics = {}, options = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const minDimension = Math.min(width, height);
  const base = Math.max(400, Math.min(1800, minDimension * 1.5));
  return base * normalizeEnclosureScale(options.scale);
}

/**
 * Radius and height for the cylindrical enclosure. The scale multiplier
 * applies to the default dimensions; it does not override explicitly supplied
 * values.
 *
 * @param {MetricsLike} [metrics]
 * @param {{ scale?: number }} [options]
 * @returns {{ radius: number, height: number }}
 */
export function computeCylinderSize(metrics = {}, options = {}) {
  const width = metrics.sceneWidth ?? 500;
  const height = metrics.sceneHeight ?? 300;
  const minDimension = Math.min(width, height);
  const scale = normalizeEnclosureScale(options.scale);

  return {
    radius: Math.max(200, Math.min(1800, minDimension * 0.9)) * scale,
    height: Math.max(600, Math.min(3200, minDimension * 1.8)) * scale
  };
}
