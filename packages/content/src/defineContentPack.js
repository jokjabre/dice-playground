import { ConfigurationError, mergeConfig } from '@dice/core';

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {any} value
 * @returns {any}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

/**
 * Freeze and normalise a content pack. This performs only structural checks
 * (a plain object with a non-empty string `id`); full validation against
 * dice, enclosure, and style registries happens in `validateContentPack` and
 * `resolveContent`, where registries are available.
 *
 * The returned pack is a deep-frozen copy; the input is never mutated.
 *
 * @param {Record<string, any>} pack
 * @returns {Readonly<Record<string, any>>}
 */
export function defineContentPack(pack) {
  if (!isPlainObject(pack)) {
    throw new ConfigurationError('Content pack must be a plain object.', {
      path: 'pack'
    });
  }
  if (typeof pack.id !== 'string' || pack.id.length === 0) {
    throw new ConfigurationError('Content pack id must be a non-empty string.', {
      path: 'id'
    });
  }
  if (
    pack.version !== undefined &&
    (!Number.isInteger(pack.version) || pack.version < 1)
  ) {
    throw new ConfigurationError('Content pack version must be an integer >= 1.', {
      path: 'version'
    });
  }
  if (pack.label !== undefined && typeof pack.label !== 'string') {
    throw new ConfigurationError('Content pack label must be a string.', {
      path: 'label'
    });
  }

  const copy = mergeConfig({}, /** @type {Record<string, any>} */ (pack));
  return deepFreeze(copy);
}
