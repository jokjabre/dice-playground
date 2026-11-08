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
 * @property {number} defaultNear
 * @property {number} defaultFar
 */

/**
 * Camera slider limits and defaults. Mirrors the legacy demo's camera
 * controls: distance is a multiplier on the auto wall-height distance, and
 * far `0` means auto.
 *
 * @type {SandboxCamera}
 */
export const SANDBOX_CAMERA = Object.freeze({
  min: 0.4,
  max: 3,
  step: 0.05,
  defaultDistance: 1,
  defaultNear: 1,
  defaultFar: 0
});

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isSandboxEnclosure(id) {
  return SANDBOX_ENCLOSURES.some((entry) => entry.id === id);
}
