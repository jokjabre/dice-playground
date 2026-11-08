import { DiceError } from '@dice/core';

/**
 * @typedef {Object} EnginePlugin
 * @property {string} id
 * @property {(engine: any) => void} attach
 * @property {(engine: any) => void} [detach]
 * @property {(request: any) => Promise<{ request?: any, faceMappings?: number[][], diagnostics?: object } | void>} [prepareRoll]
 * @property {(result: any) => void} [afterRoll]
 */

/**
 * Owns the engine plugin lifecycle.
 *
 * `attach` receives the engine (which is also the `InputHost` for input
 * plugins). `prepareRoll` hooks run in registration order and are awaited;
 * their face mappings are merged into the effective roll request.
 */
export class PluginRegistry {
  /** @type {EnginePlugin[]} */
  #plugins = [];

  /**
   * Attach a plugin. Duplicate ids are rejected.
   *
   * @param {EnginePlugin} plugin
   * @param {any} host Engine / InputHost passed to `plugin.attach`.
   * @returns {EnginePlugin}
   */
  use(plugin, host) {
    if (!plugin || typeof plugin.id !== 'string' || plugin.id.length === 0) {
      throw new DiceError('Engine plugins require a non-empty string id.', {
        code: 'INVALID_PLUGIN'
      });
    }
    if (typeof plugin.attach !== 'function') {
      throw new DiceError(`Engine plugin "${plugin.id}" must implement attach().`, {
        code: 'INVALID_PLUGIN'
      });
    }
    if (this.has(plugin.id)) {
      throw new DiceError(`Engine plugin already attached: ${plugin.id}`, {
        code: 'DUPLICATE_PLUGIN'
      });
    }

    plugin.attach(host);
    this.#plugins.push(plugin);
    return plugin;
  }

  /**
   * Detach a plugin by id. Returns the removed plugin, or `null`.
   *
   * @param {string} pluginId
   * @param {any} host
   * @returns {EnginePlugin|null}
   */
  unuse(pluginId, host) {
    const index = this.#plugins.findIndex((plugin) => plugin.id === pluginId);
    if (index < 0) return null;
    const [plugin] = this.#plugins.splice(index, 1);
    if (typeof plugin.detach === 'function') {
      plugin.detach(host);
    }
    return plugin;
  }

  /**
   * @param {string} pluginId
   * @returns {boolean}
   */
  has(pluginId) {
    return this.#plugins.some((plugin) => plugin.id === pluginId);
  }

  /**
   * @param {string} pluginId
   * @returns {EnginePlugin|undefined}
   */
  get(pluginId) {
    return this.#plugins.find((plugin) => plugin.id === pluginId);
  }

  /**
   * @returns {EnginePlugin[]}
   */
  list() {
    return [...this.#plugins];
  }

  /**
   * Run every `prepareRoll` hook in registration order, merging requests
   * and face mappings. Hooks without `prepareRoll` are skipped.
   *
   * @param {Record<string, any>} request Effective roll request.
   * @returns {Promise<{ request: Record<string, any>, faceMappings: number[][]|undefined, diagnostics: Record<string, any> }>}
   */
  async prepareRoll(request) {
    /** @type {Record<string, any>} */
    let effective = { ...request };
    /** @type {number[][]|undefined} */
    let faceMappings = Array.isArray(effective.faceMappings)
      ? effective.faceMappings
      : undefined;
    /** @type {Record<string, any>} */
    const diagnostics = {};

    for (const plugin of this.#plugins) {
      if (typeof plugin.prepareRoll !== 'function') continue;
      const result = await plugin.prepareRoll({ ...effective });
      if (!result) continue;
      if (result.request) {
        effective = { ...effective, ...result.request };
      }
      if (result.faceMappings !== undefined) {
        faceMappings = result.faceMappings;
      }
      if (result.diagnostics) {
        diagnostics[plugin.id] = result.diagnostics;
      }
    }

    if (faceMappings !== undefined) {
      effective.faceMappings = faceMappings;
    }

    return { request: effective, faceMappings, diagnostics };
  }

  /**
   * Notify every plugin that a roll settled.
   *
   * @param {any} result Canonical RollResult.
   * @returns {void}
   */
  afterRoll(result) {
    for (const plugin of this.#plugins) {
      if (typeof plugin.afterRoll === 'function') {
        plugin.afterRoll(result);
      }
    }
  }

  /**
   * Detach every plugin in reverse registration order.
   *
   * @param {any} host
   * @returns {void}
   */
  detachAll(host) {
    while (this.#plugins.length > 0) {
      const plugin = /** @type {EnginePlugin} */ (this.#plugins.pop());
      if (typeof plugin.detach === 'function') {
        plugin.detach(host);
      }
    }
  }
}
