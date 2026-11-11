import { isResetMarker } from './constants.js';

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Phase 0 skeleton: deep merge settings patches with canonical semantics.
 *
 * Rules (contracted in Phase 0, fully enforced in Phase 1):
 * - Omit = no change to targeted scope (caller responsibility when applying).
 * - Explicit reset marker `{ "$reset": true }` clears an override at that path
 *   so value falls back to lower layers/base (returned here as a marker/result
 *   signal for higher-level layering logic).
 * - Plain objects: deep-merge by key/path by default.
 * - Arrays and complex structured definitions: default replace-at-node when
 *   provided, unless a section defines an explicit keyed-merge contract.
 *
 * This stub implements plain-object deep merge + reset propagation; array and
 * per-section keyed strategies are finalized/applied in Phase 1+.
 *
 * @param {Record<string, unknown>} base
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>}
 */
export function mergeSettingsPatch(base, patch) {
  if (!isPlainObject(base)) base = {};
  if (!isPlainObject(patch)) return { .../** @type {any} */ (base) };

  /** @type {Record<string, unknown>} */
  const result = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isResetMarker(value)) {
      // Reset clears the override at this path. In a pure merge of two layers
      // we remove the key; layering (base vs user default vs live) is handled
      // by the apply/resolve pipeline in later phases.
      delete result[key];
      continue;
    }

    const current = result[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeSettingsPatch(current, value);
    } else if (Array.isArray(value)) {
      // Default: replace-at-node for arrays (contract). Deep clone shallowly.
      result[key] = value.slice();
    } else if (isPlainObject(value)) {
      result[key] = mergeSettingsPatch({}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Phase 1 stub: extract a section-scoped subset from a settings payload.
 * @param {Record<string, unknown>} settings
 * @param {string} sectionId
 * @returns {Record<string, unknown>}
 */
export function extractSection(settings, sectionId) {
  if (!settings || typeof settings !== 'object') return {};
  const value = /** @type {Record<string, unknown>} */ (settings)[sectionId];
  if (value === undefined) return {};
  return { [sectionId]: value };
}
