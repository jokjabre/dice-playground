import { classicTray } from '@dice/content';

/**
 * Gallery content: the shared "classic tray" pack with app-local
 * enclosure, gravity, and camera presentation data.
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
 * @type {ReadonlyArray<EnclosureOption>}
 */
export const GALLERY_ENCLOSURES = Object.freeze([
  {
    id: 'box',
    label: 'Box',
    description: 'Floor plane, four walls, and a ceiling. The classic dice tray.'
  },
  {
    id: 'sphere',
    label: 'Sphere',
    description: 'Tangent-plane floor with radial containment inside a glass orb.'
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    description: 'Bottom cap with polygonal wall facets inside a glass cup.'
  }
]);

/**
 * Gravity presets. Vectors use the world default as the baseline:
 * `{ x: 0, y: 0, z: -2940 }`.
 *
 * @typedef {Object} GravityPreset
 * @property {string} id
 * @property {string} label
 * @property {{ x: number, y: number, z: number }} gravity
 */

/**
 * @type {ReadonlyArray<GravityPreset>}
 */
export const GRAVITY_PRESETS = Object.freeze([
  {
    id: 'down',
    label: 'Down (default)',
    gravity: Object.freeze({ x: 0, y: 0, z: -2940 })
  },
  {
    id: 'tilt-left',
    label: 'Tilt left',
    gravity: Object.freeze({ x: -1400, y: 0, z: -1800 })
  },
  {
    id: 'tilt-right',
    label: 'Tilt right',
    gravity: Object.freeze({ x: 1400, y: 0, z: -1800 })
  },
  {
    id: 'zero-g',
    label: 'Zero gravity',
    gravity: Object.freeze({ x: 0, y: 0, z: 0 })
  }
]);

/**
 * @param {string} id
 * @returns {GravityPreset}
 */
export function getGravityPreset(id) {
  const preset = GRAVITY_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new Error(`Unknown gravity preset: ${id}`);
  }
  return preset;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isGalleryEnclosure(id) {
  return GALLERY_ENCLOSURES.some((entry) => entry.id === id);
}

/**
 * @param {string} id
 * @returns {EnclosureOption}
 */
export function getGalleryEnclosure(id) {
  const option = GALLERY_ENCLOSURES.find((entry) => entry.id === id);
  if (!option) {
    throw new Error(`Unknown gallery enclosure: ${id}`);
  }
  return option;
}

/**
 * The app content pack. Starts from the shared classic tray so camera,
 * table, and dice styling stay consistent with the sandbox.
 */
export const galleryContent = classicTray;

/**
 * @typedef {Object} GalleryCamera
 * @property {number} min
 * @property {number} max
 * @property {number} step
 * @property {number} defaultDistance
 */

export const GALLERY_CAMERA = Object.freeze({
  min: 0.5,
  max: 4,
  step: 0.1,
  defaultDistance: 1
});

/**
 * @typedef {Object} GalleryLight
 * @property {{ x: number, y: number, z: number }} defaultPosition
 * @property {number} min
 * @property {number} max
 * @property {number} step
 */

/**
 * Spotlight position defaults, expressed in multiples of the scene's largest
 * dimension. Mirrors the rendering package's default without importing it.
 *
 * @type {GalleryLight}
 */
export const GALLERY_LIGHT = Object.freeze({
  defaultPosition: Object.freeze({ x: -0.5, y: 0.5, z: 2 }),
  min: -3,
  max: 3,
  step: 0.1
});

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
export const GALLERY_ENCLOSURE_SCALES = Object.freeze([
  { value: 0.75, label: '75%' },
  { value: 1, label: '100% (default)' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
  { value: 2, label: '200%' }
]);
