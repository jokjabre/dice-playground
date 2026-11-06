/**
 * Shared enclosure sizing.
 * Every enclosure derives its physics boundary and visual meshes from the
 * values computed here, so physics and visuals can never diverge.
 */

/**
 * Die vertex radius for the current field (DiceFactory uses scale * 0.9).
 * @param {Object} [dimensions]
 * @returns {number}
 */
export function computeDieRadius(dimensions) {
    const scale = (dimensions && dimensions.scale) || 45;
    return Math.max(10, scale * 0.9);
}

/**
 * Radius for spherical enclosure. Sized so it stays proportionate to the
 * playing field (the box tray fills a comparable area) instead of being a
 * fixed size that ignores the viewport.
 * @param {Object} [dimensions]
 * @returns {number}
 */
export function computeSphereRadius(dimensions) {
    const w = (dimensions && dimensions.scene_width) || 500;
    const h = (dimensions && dimensions.scene_height) || 300;
    const minDim = Math.min(w, h);
    return Math.max(400, Math.min(1800, minDim * 1.35));
}

/**
 * Radius/height for the cylindrical enclosure (placeholder physics).
 * @param {Object} [dimensions]
 * @returns {{radius: number, height: number}}
 */
export function computeCylinderSize(dimensions) {
    const w = (dimensions && dimensions.scene_width) || 500;
    const h = (dimensions && dimensions.scene_height) || 300;
    const minDim = Math.min(w, h);
    const radius = Math.max(200, Math.min(900, minDim * 0.45));
    const height = Math.max(600, Math.min(1600, minDim * 1.4));
    return { radius, height };
}
