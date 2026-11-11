import { SECTION_IDS, isResetMarker } from './constants.js';
import {
  applyPatch,
  applyPatchWithFallback,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  cloneSettingsValue,
  deepEqualValue,
  diffOverrides,
  isPlainObject,
  resolveLayers
} from './patch.js';

/** @param {Record<string, any>} base @param {Record<string, any>} patch @returns {Record<string, any>} */
export function mergeSettingsPatch(base, patch) {
  const result = applyPatch(isPlainObject(base) ? base : {}, isPlainObject(patch) ? patch : {});
  return result === undefined ? {} : result;
}

/** @param {Record<string, any>} settings @param {string|string[]} sectionId @returns {Record<string, any>} */
export function extractSection(settings, sectionId) {
  if (!isPlainObject(settings)) return {};
  const ids = Array.isArray(sectionId) ? sectionId : [sectionId];
  /** @type {Record<string, any>} */
  const out = {};
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(settings, id)) continue;
    out[id] = cloneSettingsValue(/** @type {any} */ (settings)[id]);
  }
  return out;
}

/** @param {Record<string, any>} settings @param {{ sectionIds?: string[] }} [options] */
export function extractApplicableSections(settings, options = {}) {
  const allowed = new Set(options.sectionIds || SECTION_IDS);
  if (!isPlainObject(settings)) return { extracted: /** @type {Record<string, any>} */ ({}), ignoredKeys: /** @type {string[]} */ ([]) };
  /** @type {Record<string, any>} */
  const extracted = {};
  /** @type {string[]} */
  const ignoredKeys = [];
  for (const [key, value] of Object.entries(settings)) {
    if (allowed.has(key)) extracted[key] = cloneSettingsValue(value);
    else ignoredKeys.push(key);
  }
  return { extracted, ignoredKeys };
}

/** @param {Record<string, any>} dirtyPatch @param {string[]} path @param {any} value */
export function setDirtyPath(dirtyPatch, path, value) {
  if (!Array.isArray(path) || path.length === 0) return isPlainObject(value) ? cloneSettingsValue(value) : dirtyPatch;
  const root = isPlainObject(dirtyPatch) ? cloneSettingsValue(dirtyPatch) : {};
  /** @type {Record<string, any>} */
  let cursor = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!isPlainObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = cloneSettingsValue(value);
  return root;
}

/** @param {any} obj @param {string[]} path */
export function getPathValue(obj, path) {
  let cur = obj;
  for (const key of path || []) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

export {
  applyPatch,
  applyPatchWithFallback,
  resolveLayers,
  diffOverrides,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  deepEqualValue,
  cloneSettingsValue,
  isResetMarker
};
