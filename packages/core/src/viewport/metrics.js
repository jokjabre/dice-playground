/**
 * @typedef {import('../contracts.js').ViewportMetrics} ViewportMetrics
 */

/**
 * Compute pure viewport metrics from container and scene dimensions.
 *
 * The caller owns DOM reads. This function only performs the shared math used
 * by rendering, physics, and enclosures.
 *
 * @param {Object} input
 * @param {number} input.containerWidth
 * @param {number} input.containerHeight
 * @param {number} [input.sceneWidth]
 * @param {number} [input.sceneHeight]
 * @param {number} [input.devicePixelRatio]
 * @returns {ViewportMetrics}
 */
export function computeViewportMetrics({
  containerWidth,
  containerHeight,
  sceneWidth = containerWidth,
  sceneHeight = containerHeight,
  devicePixelRatio = 1
}) {
  if (!(containerWidth > 0) || !(containerHeight > 0)) {
    throw new RangeError('Viewport container dimensions must be greater than zero.');
  }
  if (!(sceneWidth > 0) || !(sceneHeight > 0)) {
    throw new RangeError('Viewport scene dimensions must be greater than zero.');
  }

  const aspect = Math.min(
    containerWidth / sceneWidth,
    containerHeight / sceneHeight
  );
  const scale =
    Math.sqrt(sceneWidth * sceneWidth + sceneHeight * sceneHeight) / 13;
  const wallHeight =
    containerHeight / aspect / Math.tan((10 * Math.PI) / 180);

  return {
    containerWidth,
    containerHeight,
    sceneWidth,
    sceneHeight,
    scale,
    aspect,
    wallHeight,
    pixelRatio: devicePixelRatio > 0 ? devicePixelRatio : 1
  };
}
