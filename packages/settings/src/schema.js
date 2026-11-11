/**
 * Phase 0 schema stubs.
 *
 * The canonical settings model is organized by section namespaces (see
 * `.planning/config-overhaul/CONTRACTS.md` and `INVENTORY.md`). Full typed
 * field definitions, defaults catalog (non-exported engine/base), normalization,
 * and validation are implemented in Phase 1.
 */

/**
 * @typedef {Record<string, unknown>} CanonicalSettings
 * A canonical settings tree keyed by sectionId. Only present keys are
 * meaningful for patches (omit = no change).
 */

/**
 * Return an empty canonical settings skeleton (no base defaults exported).
 * Phase 1 will provide `createDefaultCanonicalSettings()` sourced from the
 * authoritative engine/base defaults (never serialized to files).
 *
 * @returns {CanonicalSettings}
 */
export function createEmptyCanonicalSettings() {
  return {};
}

/**
 * Phase 1 stub: normalize a candidate settings payload toward canonical shape.
 * @param {unknown} value
 * @returns {CanonicalSettings}
 */
export function normalizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { /** @type {CanonicalSettings} */ ...(/** @type {any} */ (value)) };
}

/**
 * Phase 1 stub: validate canonical settings against schema/registry.
 * @param {unknown} _value
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateSettings(_value) {
  return { ok: true, errors: [] };
}
