import { SECTION_IDS } from './constants.js';
import { createDefaultCanonicalSettings, getCanonicalBaseDefaults } from './defaults.js';
import { CURRENT_SCHEMA_VERSION, migrateSettingsPayload } from './migration.js';
import { cloneSettingsValue, isPlainObject } from './patch.js';

const SECTION_SET = new Set(SECTION_IDS);

/** @param {string} sectionId */
export function isKnownSectionId(sectionId) {
  return SECTION_SET.has(sectionId);
}

export function createEmptyCanonicalSettings() {
  return /** @type {Record<string, any>} */ ({});
}

export function getBaseDefaults() {
  return getCanonicalBaseDefaults();
}

export { createDefaultCanonicalSettings };

/**
 * @param {unknown} value
 * @param {{ allowUnknownSections?: boolean }} [options]
 * @returns {Record<string, any>}
 */
export function normalizeSettings(value, options = {}) {
  if (!isPlainObject(value)) return {};
  /** @type {Record<string, any>} */
  const out = {};
  for (const [key, val] of Object.entries(/** @type {Record<string, any>} */ (value))) {
    if (!options.allowUnknownSections && !SECTION_SET.has(key)) continue;
    out[key] = cloneSettingsValue(val);
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {{ allowUnknownSections?: boolean }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateSettings(value, options = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  if (value == null) return { ok: true, errors, warnings };
  if (!isPlainObject(value)) {
    return { ok: false, errors: ['Settings payload must be an object.'], warnings };
  }
  for (const [key, val] of Object.entries(/** @type {Record<string, any>} */ (value))) {
    if (!SECTION_SET.has(key)) {
      if (options.allowUnknownSections) warnings.push(`Unknown section: ${key}`);
      else warnings.push(`Ignored unknown section: ${key}`);
      continue;
    }
    if (val !== undefined && val !== null && !isPlainObject(val)) {
      errors.push(`Section "${key}" must be an object.`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {any} payload
 * @param {number} fromVersion
 * @param {number} [toVersion]
 */
export function migrateSettings(payload, fromVersion, toVersion = CURRENT_SCHEMA_VERSION) {
  return migrateSettingsPayload(payload, fromVersion, toVersion);
}

export { CURRENT_SCHEMA_VERSION };
