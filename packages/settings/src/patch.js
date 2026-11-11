import { isResetMarker } from './constants.js';

/**
 * @param {any} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** @param {any} value @returns {any} */
export function cloneValue(value) {
  if (Array.isArray(value)) return value.map((v) => cloneValue(v));
  if (isPlainObject(value)) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = cloneValue(v);
    return out;
  }
  return value;
}

/** @param {any} a @param {any} b */
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (isPlainObject(a) || isPlainObject(b)) {
    if (!isPlainObject(a) || !isPlainObject(b)) return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

/** @param {any} base @param {any} patch @returns {any} */
export function applyPatch(base, patch) {
  if (isResetMarker(patch)) return undefined;
  if (Array.isArray(patch)) return cloneValue(patch);
  if (isPlainObject(patch)) {
    const baseObj = isPlainObject(base) ? base : {};
    /** @type {Record<string, any>} */
    const result = { ...baseObj };
    for (const [key, value] of Object.entries(patch)) {
      if (isResetMarker(value)) {
        delete result[key];
        continue;
      }
      const current = result[key];
      if (isPlainObject(value)) {
        const applied = applyPatch(isPlainObject(current) ? current : {}, value);
        if (applied === undefined) delete result[key];
        else result[key] = applied;
      } else if (Array.isArray(value)) {
        result[key] = cloneValue(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return patch;
}

/** @param {...any} layers @returns {Record<string, any>} */
export function resolveLayers(...layers) {
  /** @type {any} */
  let result = {};
  for (const layer of layers) {
    if (layer == null) continue;
    const applied = applyPatch(result, layer);
    result = applied === undefined ? {} : applied;
  }
  return cloneValue(result || {});
}

/** @param {any} fallbackResolved @param {any} patch @returns {any} */
export function applyPatchWithFallback(fallbackResolved, patch) {
  if (isResetMarker(patch)) return cloneValue(fallbackResolved);
  if (Array.isArray(patch)) return cloneValue(patch);
  if (isPlainObject(patch)) {
    const baseObj = isPlainObject(fallbackResolved) ? fallbackResolved : {};
    /** @type {Record<string, any>} */
    const result = cloneValue(baseObj);
    for (const [key, value] of Object.entries(patch)) {
      if (isResetMarker(value)) {
        if (Object.prototype.hasOwnProperty.call(baseObj, key)) {
          result[key] = cloneValue(baseObj[key]);
        } else {
          delete result[key];
        }
        continue;
      }
      const currentFallback = baseObj[key];
      if (isPlainObject(value)) {
        const applied = applyPatchWithFallback(
          isPlainObject(currentFallback) ? currentFallback : {},
          value
        );
        if (applied === undefined) delete result[key];
        else result[key] = applied;
      } else if (Array.isArray(value)) {
        result[key] = cloneValue(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return patch;
}

/** @param {any} base @param {any} target @returns {any|undefined} */
export function diffOverrides(base, target) {
  if (deepEqual(base, target)) return undefined;
  if (Array.isArray(target)) return cloneValue(target);
  if (isPlainObject(target)) {
    const baseObj = isPlainObject(base) ? base : {};
    /** @type {Record<string, any>} */
    const out = {};
    const keys = new Set([...Object.keys(baseObj), ...Object.keys(target)]);
    for (const key of keys) {
      const hasTarget = Object.prototype.hasOwnProperty.call(target, key);
      const hasBase = Object.prototype.hasOwnProperty.call(baseObj, key);
      if (!hasTarget && hasBase) {
        out[key] = { $reset: true };
        continue;
      }
      if (!hasTarget) continue;
      const b = baseObj[key];
      const t = target[key];
      if (deepEqual(b, t)) continue;
      if (isPlainObject(t) && (isPlainObject(b) || b === undefined)) {
        const child = diffOverrides(b ?? {}, t);
        if (child !== undefined) out[key] = child;
      } else {
        out[key] = cloneValue(t);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return cloneValue(target);
}

/** @param {any} patch @returns {any} */
function stripResetsToBase(patch) {
  if (!isPlainObject(patch)) return patch;
  /** @type {Record<string, any>} */
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (isResetMarker(v)) {
      continue;
    }
    if (isPlainObject(v)) {
      const child = stripResetsToBase(v);
      if (child && isPlainObject(child) && Object.keys(child).length) out[k] = child;
      continue;
    }
    out[k] = cloneValue(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** @param {any} effective @param {any} engineBase @returns {Record<string, any>} */
export function buildEffectiveMinusBase(effective, engineBase) {
  const diff = diffOverrides(engineBase, effective);
  if (diff === undefined) return {};
  const stripped = stripResetsToBase(diff);
  return isPlainObject(stripped) ? stripped : {};
}

/** @param {any} base @param {any} patch @returns {any} */
function normalizePatchAgainstBase(base, patch) {
  if (patch == null) return undefined;
  if (isResetMarker(patch)) {
    return cloneValue(patch);
  }
  if (Array.isArray(patch)) {
    return deepEqual(base, patch) ? undefined : cloneValue(patch);
  }
  if (isPlainObject(patch)) {
    const baseObj = isPlainObject(base) ? base : {};
    /** @type {Record<string, any>} */
    const out = {};
    for (const [k, v] of Object.entries(patch)) {
      if (isResetMarker(v)) {
        if (Object.prototype.hasOwnProperty.call(baseObj, k)) out[k] = { $reset: true };
        continue;
      }
      const childBase = baseObj[k];
      if (isPlainObject(v)) {
        const child = normalizePatchAgainstBase(isPlainObject(childBase) ? childBase : {}, v);
        if (child !== undefined) out[k] = child;
      } else if (!deepEqual(childBase, v)) {
        out[k] = cloneValue(v);
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return deepEqual(base, patch) ? undefined : cloneValue(patch);
}

/**
 * @param {any} resolvedBelow
 * @param {any} liveResolvedOrDirtyPatch
 * @param {{ treatSecondArgAsDirtyPatch?: boolean }} [options]
 * @returns {Record<string, any>}
 */
export function buildOverridesOnly(resolvedBelow, liveResolvedOrDirtyPatch, options = {}) {
  if (options.treatSecondArgAsDirtyPatch) {
    const normalized = normalizePatchAgainstBase(resolvedBelow, liveResolvedOrDirtyPatch);
    return isPlainObject(normalized) ? normalized : {};
  }
  const diff = diffOverrides(resolvedBelow, liveResolvedOrDirtyPatch);
  return isPlainObject(diff) ? diff : {};
}

export { isPlainObject, deepEqual as deepEqualValue, cloneValue as cloneSettingsValue };
