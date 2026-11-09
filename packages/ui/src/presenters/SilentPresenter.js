import { EVENTS } from '@dice/core';

/**
 * Presenter that emits `result:present` events without touching the DOM.
 * Useful for headless runs and for apps that render results themselves.
 */
export class SilentPresenter {
  /** @type {(() => void)|null} */
  #unsubscribe = null;

  /** @type {any} */
  #events;

  /**
   * @param {{ events?: any }} [options]
   */
  constructor(options = {}) {
    this.#events = options.events ?? null;
    if (this.#events) {
      this.#unsubscribe = this.#events.on(
        EVENTS.ROLL_SETTLE,
        (/** @type {any} */ payload) => {
          const result = payload?.result ?? payload ?? {};
          this.present(result.values ?? [], result);
        }
      );
    }
  }

  /**
   * @param {number[]} values
   * @param {Record<string, any>} [metadata]
   * @returns {void}
   */
  present(values, metadata = {}) {
    if (!this.#events) return;
    const list = Array.isArray(values) ? values : [];
    this.#events.emit(EVENTS.RESULT_PRESENT, {
      values: list,
      total:
        typeof metadata.total === 'number'
          ? metadata.total
          : list.reduce((sum, value) => sum + value, 0),
      metadata: { ...metadata }
    });
  }

  /**
   * @returns {void}
   */
  clear() {}

  /**
   * @returns {void}
   */
  destroy() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }
}
