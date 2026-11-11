/**
 * Phase 0 contract constants for the canonical settings system.
 * Values are locked by `.planning/config-overhaul/CONTRACTS.md` unless noted.
 */

/** Stable document format identifier. */
export const SETTINGS_FORMAT = 'dice-settings';

/** Current canonical schema version (integer, migratable). */
export const SCHEMA_VERSION = 1;

/** @typedef {'full'|'section'|'patch'} SettingsKind */
export const SETTINGS_KINDS = Object.freeze(['full', 'section', 'patch']);

/**
 * Explicit reset marker token. A value equal to this object at a path means
 * "clear override at this path and fall back to lower layers/base".
 * Final token is the plain object `{ "$reset": true }`.
 */
export const RESET_MARKER_KEY = '$reset';

/**
 * @returns {{ '$reset': true }}
 */
export function createResetMarker() {
  return { [RESET_MARKER_KEY]: true };
}

/**
 * @param {unknown} value
 * @returns {value is { '$reset': true }}
 */
export function isResetMarker(value) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      /** @type {Record<string, unknown>} */ (value)[RESET_MARKER_KEY] === true
  );
}

/**
 * Canonical section identifiers (Phase 0 taxonomy). Stable IDs used in
 * envelopes, registries, visibility, and storage/import targeting.
 * Order is a suggested default UI grouping order, not a semantic constraint.
 */
export const SECTION_IDS = Object.freeze([
  'diceVisuals',
  'enclosure',
  'camera',
  'lighting',
  'scene',
  'physicsWorld',
  'physicsSolver',
  'physicsMaterials',
  'throwSpawn',
  'determinism',
  'appMode'
]);

/** @typedef {typeof SECTION_IDS[number]} SectionId */

/** Default file naming conventions (documented; helpers may evolve in Phase 1). */
export const FILE_NAMING = Object.freeze({
  full: (/** @type {string} */ appId) => `${appId}-full.settings.json`,
  section: (/** @type {string} */ sectionId) => `${sectionId}.settings.json`
});

/**
 * Browser storage key scheme (appId-scoped).
 * @param {string} appId
 * @returns {string}
 */
export function defaultSettingsStorageKey(appId) {
  return `dice.settings.default.${appId}`;
}
