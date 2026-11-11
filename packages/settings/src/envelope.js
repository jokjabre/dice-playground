import { SCHEMA_VERSION, SETTINGS_FORMAT, isResetMarker } from './constants.js';
import { CURRENT_SCHEMA_VERSION, migrateSettings } from './schema.js';
import { normalizeSettings, validateSettings } from './schema.js';
import { cloneSettingsValue, isPlainObject } from './patch.js';

/**
 * @param {Record<string, any>} settings
 * @param {Record<string, any>} [options]
 * @returns {Record<string, any>}
 */
export function createEnvelope(settings, options = {}) {
  const normalized = normalizeSettings(settings ?? {});
  /** @type {Record<string, any>} */
  const env = {
    format: SETTINGS_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    settings: normalized
  };
  if (options.kind) env.kind = options.kind;
  if (options.appId) env.appId = options.appId;
  if (options.sectionId) env.sectionId = options.sectionId;
  if (options.meta) env.meta = { ...options.meta };
  return env;
}

/**
 * @param {unknown} value
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateEnvelopeStructure(value) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  if (!isPlainObject(value)) {
    return { ok: false, errors: ['Envelope must be an object.'], warnings };
  }
  const v = /** @type {Record<string, any>} */ (value);
  if (v.format !== SETTINGS_FORMAT) errors.push('Invalid or missing format.');
  if (v.schemaVersion !== SCHEMA_VERSION) {
    if (Number.isInteger(v.schemaVersion) && v.schemaVersion >= 1 && v.schemaVersion < SCHEMA_VERSION) {
      warnings.push(`Envelope schemaVersion ${v.schemaVersion} requires migration to ${SCHEMA_VERSION}.`);
    } else {
      errors.push(`Unsupported schemaVersion (expected ${SCHEMA_VERSION}).`);
    }
  }
  if (!isPlainObject(v.settings)) {
    errors.push('Missing or invalid settings payload.');
  } else {
    const sv = validateSettings(v.settings);
    errors.push(...sv.errors);
    warnings.push(...(sv.warnings || []));
  }
  if (v.kind != null && !['full', 'section', 'patch'].includes(v.kind)) {
    errors.push('Invalid kind.');
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {any} envelope
 * @param {{ pretty?: number|boolean }} [options]
 */
export function serializeEnvelope(envelope, options = {}) {
  const space = options.pretty === true ? 2 : (typeof options.pretty === 'number' ? options.pretty : 0);
  return JSON.stringify(envelope, null, space);
}

/**
 * @param {string|any} input
 * @param {{ migrate?: boolean, normalize?: boolean }} [options]
 * @returns {{ ok: boolean, envelope?: any, errors: string[], warnings: string[] }}
 */
export function deserializeEnvelope(input, options = {}) {
  const { migrate = true, normalize = true } = options;
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
      return { ok: false, errors: ['Invalid JSON: ' + msg], warnings: [] };
    }
  }
  if (!isPlainObject(value)) {
    return { ok: false, errors: ['Envelope must be an object.'], warnings: [] };
  }
  /** @type {string[]} */
  const warnings = [];
  let env = cloneSettingsValue(value);
  if (env.format !== SETTINGS_FORMAT) {
    return { ok: false, errors: ['Invalid or missing format.'], warnings };
  }
  if (env.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    if (migrate && Number.isInteger(env.schemaVersion) && env.schemaVersion >= 1 && env.schemaVersion < CURRENT_SCHEMA_VERSION) {
      try {
        const migrated = migrateSettings(env.settings ?? {}, env.schemaVersion, CURRENT_SCHEMA_VERSION);
        env.settings = migrated.payload;
        env.schemaVersion = migrated.version;
        warnings.push(`Migrated settings payload from schemaVersion ${value.schemaVersion} to ${CURRENT_SCHEMA_VERSION}.`);
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
        return { ok: false, errors: [msg], warnings };
      }
    } else {
      return { ok: false, errors: [`Unsupported schemaVersion (expected ${CURRENT_SCHEMA_VERSION}).`], warnings };
    }
  }
  if (normalize && isPlainObject(env.settings)) {
    env.settings = normalizeSettings(env.settings);
  }
  const validation = validateEnvelopeStructure(env);
  return {
    ok: validation.ok,
    envelope: validation.ok ? env : undefined,
    errors: validation.errors,
    warnings: [...warnings, ...(validation.warnings || [])]
  };
}

export { isResetMarker };
