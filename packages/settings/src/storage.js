import { defaultSettingsStorageKey } from './constants.js';

/**
 * Phase 0 skeleton: per-app default settings persistence in browser storage.
 * Real implementation (load/save/clear, quota/error handling, JSON parse/stringify,
 * and non-browser guards) is delivered in Phase 1 behind this API shape.
 */

/**
 * @param {string} appId
 * @returns {string}
 */
export function storageKeyForApp(appId) {
  return defaultSettingsStorageKey(appId);
}

/**
 * @param {string} _appId
 * @returns {string|null}
 */
export function loadDefaultSettings(_appId) {
  // Stub: no persistence side effects in Phase 0.
  return null;
}

/**
 * @param {string} _appId
 * @param {string} _json
 * @returns {boolean}
 */
export function saveDefaultSettings(_appId, _json) {
  // Stub: no persistence side effects in Phase 0.
  return false;
}

/**
 * @param {string} _appId
 * @returns {boolean}
 */
export function clearDefaultSettings(_appId) {
  // Stub: no persistence side effects in Phase 0.
  return false;
}
