import { classicTray } from '@dice/content';

/**
 * Sandbox content: the shared "classic tray" pack with app-local
 * presentation data for the parity controls.
 *
 * Content is data only. The engine world resolves ids against the
 * enclosures and dice registries at startup.
 */

/**
 * @typedef {Object} EnclosureOption
 * @property {string} id
 * @property {string} label
 * @property {string} description
 */

/**
 * Enclosure options. Labels match the legacy demo's enclosure selector.
 *
 * @type {ReadonlyArray<EnclosureOption>}
 */
export const SANDBOX_ENCLOSURES = Object.freeze([
  {
    id: 'box',
    label: 'Box (Classic Tray)',
    description: 'Floor plane, four walls, and a ceiling. The classic dice tray.'
  },
  {
    id: 'sphere',
    label: 'Sphere (Orbe)',
    description: 'Tangent-plane floor with radial containment inside a glass orb.'
  },
  {
    id: 'cylinder',
    label: 'Cylinder (Dice Cup)',
    description: 'Bottom cap with polygonal wall facets inside a glass cup.'
  }
]);

/**
 * Default number of dice. Matches the legacy demo default.
 */
export const SANDBOX_DICE_COUNT = 6;

/**
 * The app content pack. Starts from the shared classic tray so camera,
 * table, and dice styling stay consistent with the other apps.
 */
export const sandboxContent = classicTray;

/**
 * @typedef {Object} SandboxCamera
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {number} defaultDistance
 */

/**
 * Camera slider limits and defaults. Mirrors the legacy demo's camera
 * distance: a multiplier on the auto wall-height distance. The legacy
 * near/far clipping fields were dropped from this UI (they only set
 * clipping planes, which have no visible effect at sensible values).
 *
 * @type {SandboxCamera}
 */
export const SANDBOX_CAMERA = Object.freeze({
  min: 0.4,
  max: 3,
  step: 0.05,
  defaultDistance: 1
});

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isSandboxEnclosure(id) {
  return SANDBOX_ENCLOSURES.some((entry) => entry.id === id);
}

/**
 * @typedef {Object} EnclosureScaleOption
 * @property {number} value
 * @property {string} label
 */

/**
 * Enclosure size presets, relative to each enclosure's default size.
 *
 * @type {ReadonlyArray<EnclosureScaleOption>}
 */
export const SANDBOX_ENCLOSURE_SCALES = Object.freeze([
  { value: 0.75, label: '75%' },
  { value: 1, label: '100% (default)' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2, label: '200%' }
]);

/**
 * @typedef {Object} SandboxLight
 * @property {{ x: number, y: number, z: number }} defaultPosition
 * @property {number} min
 * @property {number} max
 * @property {number} step
 */

/**
 * Spotlight position defaults, expressed in multiples of the scene's largest
 * dimension. Mirrors the rendering package's default without importing it.
 *
 * @type {SandboxLight}
 */
export const SANDBOX_LIGHT = Object.freeze({
  defaultPosition: Object.freeze({ x: -0.5, y: 0.5, z: 2 }),
  min: -3,
  max: 3,
  step: 0.1
});
