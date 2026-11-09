import { DiceError } from '@dice/core';

/**
 * Content never imports runtime registries. The world or the app supplies
 * them; this module normalises the shapes they may arrive in:
 *
 * - a registry object with `has(id)` / `get(id)` / `list()`
 * - a plain object map of id to definition
 * - an array of ids
 * - `{ ids: [...] }`
 *
 * @typedef {{ has?: (id: string) => boolean, get?: (id: string) => unknown, list?: () => string[], ids?: string[] }} RegistryLike
 */

/**
 * List the ids a registry knows, or `null` when no registry was supplied.
 *
 * @param {RegistryLike|string[]|Record<string, unknown>|null|undefined} registry
 * @returns {string[]|null}
 */
export function registryList(registry) {
  if (registry == null) return null;
  if (Array.isArray(registry)) return registry.slice();
  if (typeof registry.list === 'function') return registry.list();
  if (Array.isArray(registry.ids)) return registry.ids.slice();
  if (typeof registry === 'object') return Object.keys(registry);
  return null;
}

/**
 * Whether a registry knows `id`. Without a registry the answer is `true`:
 * structural validation still runs, registry validation is skipped.
 *
 * @param {RegistryLike|string[]|Record<string, unknown>|null|undefined} registry
 * @param {string} id
 * @returns {boolean}
 */
export function registryHas(registry, id) {
  const ids = registryList(registry);
  if (ids == null) return true;
  const like = /** @type {RegistryLike} */ (registry);
  if (like && typeof like.has === 'function') {
    try {
      return Boolean(like.has(id));
    } catch {
      return ids.includes(id);
    }
  }
  return ids.includes(id);
}

/**
 * Create a tiny explicit id registry for tests, apps, and content resolution.
 * It mirrors the `has`/`get`/`list` surface of the dice registry without
 * importing any runtime package.
 *
 * @param {{ ids?: string[], entries?: Record<string, unknown> }} [options]
 * @returns {{ has: (id: string) => boolean, get: (id: string) => unknown, list: () => string[] }}
 */
export function createIdRegistry(options = {}) {
  /** @type {Map<string, unknown>} */
  const entries = new Map(Object.entries(options.entries ?? {}));

  for (const id of options.ids ?? []) {
    if (!entries.has(id)) entries.set(id, { id });
  }

  return {
    /**
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
      return entries.has(id);
    },
    /**
     * @param {string} id
     * @returns {unknown}
     */
    get(id) {
      if (!entries.has(id)) {
        throw new DiceError(`Unknown id: ${id}`, { code: 'UNKNOWN_ID' });
      }
      return entries.get(id);
    },
    /**
     * @returns {string[]}
     */
    list() {
      return [...entries.keys()];
    }
  };
}
