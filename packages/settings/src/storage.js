import { defaultSettingsStorageKey } from './constants.js';
import { deserializeEnvelope, serializeEnvelope } from './envelope.js';

function getDefaultStorage() {
  try {
    if (typeof globalThis !== 'undefined' && /** @type {any} */ (globalThis).localStorage) {
      return /** @type {Storage} */ (/** @type {any} */ (globalThis).localStorage);
    }
  } catch {}
  return null;
}

/** @param {string} appId */
export function storageKeyForApp(appId) {
  return defaultSettingsStorageKey(appId);
}

/**
 * @param {string} appId
 * @param {{ storage?: Storage|null, deserialize?: boolean }} [options]
 * @returns {null | string | { ok: boolean, envelope?: any, errors: string[], warnings: string[], raw?: string }}
 */
export function loadDefaultSettings(appId, options = {}) {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  if (!appId || !storage) return null;
  const key = storageKeyForApp(appId);
  let raw = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  if (options.deserialize) {
    const result = deserializeEnvelope(raw);
    return { ...result, raw };
  }
  return raw;
}

/**
 * @param {string} appId
 * @param {string|object} document
 * @param {{ storage?: Storage|null }} [options]
 * @returns {{ ok: boolean, error?: string, key?: string }}
 */
export function saveDefaultSettings(appId, document, options = {}) {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  if (!appId || !storage) return { ok: false, error: 'Storage unavailable or invalid appId.' };
  const key = storageKeyForApp(appId);
  let json;
  try {
    json = typeof document === 'string' ? document : serializeEnvelope(document);
    JSON.parse(json);
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
    return { ok: false, error: 'Invalid settings document: ' + msg };
  }
  try {
    storage.setItem(key, json);
    return { ok: true, key };
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
    return { ok: false, error: 'Failed to persist settings: ' + msg };
  }
}

/**
 * @param {string} appId
 * @param {{ storage?: Storage|null }} [options]
 * @returns {{ ok: boolean, error?: string }}
 */
export function clearDefaultSettings(appId, options = {}) {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  if (!appId || !storage) return { ok: false, error: 'Storage unavailable or invalid appId.' };
  const key = storageKeyForApp(appId);
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
    return { ok: false, error: 'Failed to clear settings: ' + msg };
  }
}
