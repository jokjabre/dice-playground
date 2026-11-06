import { EVENTS } from './catalog.js';

/**
 * Generic event bus with isolated listener failures.
 *
 * A listener that throws does not stop the remaining listeners. Instead, the
 * bus emits `engine:error` with the event scope and the original error. Errors
 * thrown by `engine:error` listeners are swallowed to avoid recursion.
 *
 * @template {Record<string, any>} [Events=import('../contracts.js').EventMap]
 */
export class EventBus {
  constructor() {
    /**
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   *
   * @template {keyof Events & string} K
   * @param {K} name
   * @param {(payload: Events[K]) => void} handler
   * @param {{ once?: boolean }} [options]
   * @returns {() => void} Unsubscribe function.
   */
  on(name, handler, options = {}) {
    if (options.once) {
      return this.once(name, handler);
    }

    let handlers = this.listeners.get(name);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(name, handlers);
    }
    handlers.add(handler);
    return () => this.off(name, handler);
  }

  /**
   * Subscribe to the next occurrence of an event only.
   *
   * @template {keyof Events & string} K
   * @param {K} name
   * @param {(payload: Events[K]) => void} handler
   * @returns {() => void} Unsubscribe function.
   */
  once(name, handler) {
    /** @type {() => void} */
    let unsubscribe = () => {};

    /** @param {Events[K]} payload */
    const wrapper = (payload) => {
      unsubscribe();
      handler(payload);
    };

    unsubscribe = this.on(name, wrapper);
    return unsubscribe;
  }

  /**
   * Remove a listener.
   *
   * @template {keyof Events & string} K
   * @param {K} name
   * @param {(payload: Events[K]) => void} handler
   */
  off(name, handler) {
    const handlers = this.listeners.get(name);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.listeners.delete(name);
    }
  }

  /**
   * Emit an event to every subscriber.
   *
   * @template {keyof Events & string} K
   * @param {K} name
   * @param {Events[K]} payload
   */
  emit(name, payload) {
    const handlers = this.listeners.get(name);
    if (!handlers || handlers.size === 0) return;

    for (const handler of Array.from(handlers)) {
      try {
        handler(payload);
      } catch (error) {
        if (name === EVENTS.ENGINE_ERROR) continue;

        const normalized =
          error instanceof Error ? error : new Error(String(error));
        this.emit(
          /** @type {keyof Events & string} */ (EVENTS.ENGINE_ERROR),
          /** @type {any} */ ({
            scope: `event:${name}`,
            error: normalized
          })
        );
      }
    }
  }

  /**
   * Clear listeners for one event, or every listener when no event is given.
   *
   * @param {keyof Events & string} [name]
   */
  clear(name) {
    if (name) {
      this.listeners.delete(name);
    } else {
      this.listeners.clear();
    }
  }
}
