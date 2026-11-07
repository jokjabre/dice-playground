import { mergeConfig } from '@dice/core';

/**
 * @typedef {Object} RenderColors
 * @property {number|string} ambient
 * @property {number|string} spotlight
 * @property {number|string} desk
 */

/**
 * @typedef {Object} RenderConfig
 * @property {number} fov
 * @property {number} aspect
 * @property {number} near
 * @property {number} far
 * @property {number} cameraDistance Multiplier on the automatic camera distance.
 * @property {number} cameraNear Near plane override; `0` uses the default.
 * @property {number} cameraFar Far plane override; `0` derives it from the distance.
 * @property {number|string} background
 * @property {boolean} shadows
 * @property {boolean} antialias
 * @property {number} spotlightIntensity
 * @property {boolean} castShadow
 * @property {RenderColors} colors
 */

/**
 * Defaults mirror the frozen legacy scene so the new renderer is visually
 * compatible before the world composition layer exists.
 *
 * @type {Readonly<RenderConfig>}
 */
export const DEFAULT_RENDER_CONFIG = Object.freeze({
  fov: 20,
  aspect: 1,
  near: 1,
  far: 1000,
  cameraDistance: 1,
  cameraNear: 1,
  cameraFar: 0,
  background: 0xffffff,
  shadows: true,
  antialias: true,
  spotlightIntensity: 2,
  castShadow: true,
  colors: Object.freeze({
    ambient: 0xf0f5fb,
    spotlight: 0xefdfd5,
    desk: 0x2596be
  })
});

/**
 * Merge render overrides over the defaults without mutating either layer.
 *
 * @param {Partial<RenderConfig>} [overrides]
 * @returns {RenderConfig}
 */
export function createRenderConfig(overrides = {}) {
  return /** @type {RenderConfig} */ (
    mergeConfig(DEFAULT_RENDER_CONFIG, overrides)
  );
}
