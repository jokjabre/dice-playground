import { SCHEMA_VERSION, SETTINGS_FORMAT, isResetMarker } from './constants.js';

/**
 * @typedef {Object} SettingsEnvelopeMeta
 * @property {string} [name]
 * @property {string} [createdAt] ISO-8601 timestamp.
 * @property {string} [source] Provenance label.
 * @property {boolean} [includesDefaults] Save-time mode hint when relevant.
 */

/**
 * @typedef {Object} SettingsEnvelope
 * @property {string} format Must be `dice-settings`.
 * @property {number} schemaVersion Integer schema version.
 * @property {'full'|'section'|'patch'} [kind]
 * @property {string} [appId]
 * @property {string} [sectionId]
 * @property {SettingsEnvelopeMeta} [meta]
 * @property {Record<string, unknown>} settings Canonical settings payload (patch-friendly).
 */

/**
 * Skeleton: create a versioned settings envelope. Phase 1 will add full
 * normalization/validation and export-mode metadata handling.
 *
 * @param {Record<string, unknown>} settings
 * @param {Partial<Omit<SettingsEnvelope, 'format'|'schemaVersion'|'settings'>>} [options]
 * @returns {SettingsEnvelope}
 */
export function createEnvelope(settings, options = {}) {
  return {
    format: SETTINGS_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.appId ? { appId: options.appId } : {}),
    ...(options.sectionId ? { sectionId: options.sectionId } : {}),
    ...(options.meta ? { meta: { ...options.meta } } : {}),
    settings: settings && typeof settings === 'object' ? { ...settings } : {}
  };
}

/**
 * Skeleton: shallow structural check for a candidate envelope.
 * Phase 1 will perform strict schema/version validation and migrations.
 *
 * @param {unknown} value
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateEnvelopeStructure(value) {
  /** @type {string[]} */
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['Envelope must be an object.'] };
  }
  const v = /** @type {Record<string, unknown>} */ (value);
  if (v.format !== SETTINGS_FORMAT) errors.push('Invalid or missing format.');
  if (v.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion (expected ${SCHEMA_VERSION}).`);
  }
  if (!v.settings || typeof v.settings !== 'object' || Array.isArray(v.settings)) {
    errors.push('Missing or invalid settings payload.');
  }
  return { ok: errors.length === 0, errors };
}

export { isResetMarker };
