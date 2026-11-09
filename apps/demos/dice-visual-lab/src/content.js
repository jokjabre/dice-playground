import {
  D6,
  createDiceCollisionData,
  createDiceMeshData,
  createFaceMapping,
  shiftFaceMapping
} from '@dice/dice';

/**
 * Dice visual lab content and pure visual helpers.
 *
 * The lab drives the live engine through two public mechanisms:
 *
 * - A custom die definition whose `chamfer` is mutated in place. The world
 *   resolves definitions through the registry supplied at engine creation,
 *   so the lab registers one mutable `d6` definition up front. Changing
 *   chamfer clears the dice geometry cache (via `engine.resize()`) and
 *   rerolls, so the next spawn rebuilds mesh data from the new chamfer.
 * - A custom style descriptor passed to `engine.setDiceConfig({ style })`.
 *   Styles are resolved at die creation, so color/material changes apply
 *   on the next roll.
 *
 * Die radius in the live world comes from viewport metrics
 * (`computeDieRadius`). The lab's radius slider rescales the metrics'
 * `scale` through `engine.resize(metrics)` and rerolls, which changes the
 * live die radius without resizing the enclosure.
 */

export const VISUAL_DICE_COUNT = 3;

export const VISUAL_CHAMFER = Object.freeze({
  min: 0.5,
  max: 1,
  step: 0.01,
  default: D6.chamfer
});

export const VISUAL_RADIUS_SCALE = Object.freeze({
  min: 0.5,
  max: 2,
  step: 0.05,
  default: 1
});

export const VISUAL_SHININESS = Object.freeze({ min: 0, max: 128, step: 1 });

/**
 * Specular is a hex color number (`0x172022`), not a 0-255 intensity, so
 * the lab edits it as a `#rrggbb` text input and converts it here.
 *
 * @param {string} color `#rrggbb` hex string.
 * @returns {number} Hex color number.
 */
export function parseSpecularColor(color) {
  assertColor(color);
  return Number.parseInt(color.slice(1), 16);
}

/**
 * Format a hex color number as `#rrggbb`.
 *
 * @param {number} specular
 * @returns {string}
 */
export function formatSpecularColor(specular) {
  const value = Math.max(0, Math.min(0xffffff, Math.round(specular)));
  return `#${value.toString(16).padStart(6, '0')}`;
}

/**
 * @typedef {Object} VisualSettings
 * @property {number} chamfer
 * @property {number} radiusScale
 * @property {string} bodyColor
 * @property {string} labelColor
 * @property {number} shininess
 * @property {number} specular
 */

/**
 * @returns {VisualSettings}
 */
export function defaultVisualSettings() {
  return {
    chamfer: VISUAL_CHAMFER.default,
    radiusScale: VISUAL_RADIUS_SCALE.default,
    bodyColor: '#202020',
    labelColor: '#aaaaaa',
    shininess: 30,
    specular: 0x172022
  };
}

/**
 * Validate a chamfer factor. Returns the value, or throws a RangeError.
 *
 * @param {number} chamfer
 * @returns {number}
 */
export function assertChamfer(chamfer) {
  if (
    typeof chamfer !== 'number' ||
    !Number.isFinite(chamfer) ||
    chamfer < VISUAL_CHAMFER.min ||
    chamfer > VISUAL_CHAMFER.max
  ) {
    throw new RangeError(
      `chamfer must be a finite number in [${VISUAL_CHAMFER.min}, ${VISUAL_CHAMFER.max}].`
    );
  }
  return chamfer;
}

/**
 * Validate a CSS hex color in `#rrggbb` form. Returns the value.
 *
 * @param {string} color
 * @returns {string}
 */
export function assertColor(color) {
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new RangeError('color must be a #rrggbb hex string.');
  }
  return color;
}

/**
 * Build the style descriptor consumed by the dice factory from settings.
 * The descriptor shape matches `@dice/dice` style descriptors.
 *
 * @param {VisualSettings} settings
 * @returns {{ bodyColor: string, labelColor: string, fontFamily: string, material: { shininess: number, specular: number }, textureSize: number }}
 */
export function buildStyleDescriptor(settings) {
  assertColor(settings.bodyColor);
  assertColor(settings.labelColor);
  const shininess = Math.min(
    VISUAL_SHININESS.max,
    Math.max(VISUAL_SHININESS.min, settings.shininess)
  );
  return {
    bodyColor: settings.bodyColor,
    labelColor: settings.labelColor,
    fontFamily: 'Arial',
    material: { shininess, specular: settings.specular },
    textureSize: 256
  };
}

/**
 * Create a mutable D6 clone for the lab registry. The clone shares the
 * built-in definition's faces/vertices but owns its `chamfer`, so the lab
 * can retune geometry without mutating the shared `D6` export.
 *
 * @returns {any}
 */
export function createVisualDefinition() {
  const definition = {
    ...D6,
    id: 'd6',
    chamfer: VISUAL_CHAMFER.default,
    createFaceMapping: () => createFaceMapping(D6)
  };
  return definition;
}

/**
 * Face-mapping presets for the preview. Each preset is a label shift
 * applied with `shiftFaceMapping`, so every preset is a complete
 * permutation by construction.
 *
 * @typedef {Object} MappingPreset
 * @property {string} id
 * @property {string} label
 * @property {number} offset
 */

/**
 * @type {ReadonlyArray<MappingPreset>}
 */
export const MAPPING_PRESETS = Object.freeze([
  { id: 'identity', label: 'Identity (default)', offset: 0 },
  { id: 'shift-1', label: 'Shift labels +1', offset: 1 },
  { id: 'shift-2', label: 'Shift labels +2', offset: 2 },
  { id: 'shift-3', label: 'Shift labels +3', offset: 3 }
]);

/**
 * @param {string} id
 * @returns {MappingPreset}
 */
export function getMappingPreset(id) {
  const preset = MAPPING_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new Error(`Unknown mapping preset: ${id}`);
  }
  return preset;
}

/**
 * Build the face mapping for a preset id.
 *
 * @param {string} id
 * @returns {number[]}
 */
export function mappingForPreset(id) {
  const preset = getMappingPreset(id);
  return shiftFaceMapping(D6, createFaceMapping(D6), preset.offset);
}

/**
 * Pure-data preview stats for a definition at a given radius. Uses the
 * same `createDiceMeshData`/`createDiceCollisionData` the world uses, so
 * the preview cannot diverge from the live dice.
 *
 * @param {any} definition
 * @param {number} radius
 * @returns {{ vertices: number, faces: number, chamferFaces: number, boundingRadius: number, collisionVertices: number }}
 */
export function previewStats(definition, radius) {
  const meshData = createDiceMeshData(definition, { radius });
  const collisionData = createDiceCollisionData(definition, { radius });
  return {
    vertices: meshData.vertices.length,
    faces: meshData.faces.length,
    chamferFaces: meshData.faces.filter((face) => face.faceIndex === -1).length,
    boundingRadius: meshData.boundingRadius,
    collisionVertices: collisionData.vertices.length
  };
}

/**
 * Clamp a numeric control value into `[min, max]`, falling back when the
 * input is not finite.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampValue(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Scale viewport metrics' `scale` so the live die radius changes by the
 * requested factor while container/scene dimensions stay put.
 *
 * @param {Record<string, any>} metrics
 * @param {number} radiusScale
 * @returns {Record<string, any>}
 */
export function scaleMetrics(metrics, radiusScale) {
  const scale = typeof metrics.scale === 'number' ? metrics.scale : 45;
  return { ...metrics, scale: scale * radiusScale };
}
