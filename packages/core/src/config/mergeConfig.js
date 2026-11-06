/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Merge configuration layers with later layers taking precedence.
 *
 * - Plain objects merge deeply.
 * - Arrays and primitive values replace the previous value.
 * - Input layers are never mutated.
 *
 * @param {...(Record<string, any>|null|undefined)} layers
 * @returns {Record<string, any>}
 */
export function mergeConfig(...layers) {
  /** @type {Record<string, any>} */
  let result = {};

  for (const layer of layers) {
    if (!isPlainObject(layer)) continue;
    result = mergeInto(result, layer);
  }

  return result;
}

/**
 * @param {Record<string, any>} target
 * @param {Record<string, any>} source
 * @returns {Record<string, any>}
 */
function mergeInto(target, source) {
  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const current = result[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = mergeInto(current, value);
    } else if (Array.isArray(value)) {
      result[key] = value.slice();
    } else if (isPlainObject(value)) {
      result[key] = mergeInto({}, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
