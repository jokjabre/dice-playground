import { EVENTS } from '@dice/core';

/**
 * Presenter backed by a caller-supplied formatter or callback.
 *
 * @typedef {{ events?: any, format?: (values: number[], metadata: Record<string, any>) => string, onPresent?: (values: number[], metadata: Record<string, any>) => void, container?: HTMLElement|null }} CustomPresenterOptions
 */
export class CustomPresenter {
  /** @type {(() => void)|null} */
  #unsubscribe = null;

  /** @type {CustomPresenterOptions} */
  #options;

  /**
   * @param {CustomPresenterOptions} [options]
   */
  constructor(options = {}) {
    this.#options = options;
    if (options.events) {
      this.#unsubscribe = options.events.on(
        EVENTS.ROLL_SETTLE,
        (/** @type {any} */ payload) => {
          const result = payload?.result ?? payload ?? {};
          this.present(result.values ?? [], result);
        }
      );
    }
  }

  /**
   * Run the formatter/callback for a settled result. When a container is
   * supplied and a formatter returns a string, the string is shown as text.
   *
   * @param {number[]} values
   * @param {Record<string, any>} [metadata]
   * @returns {string}
   */
  present(values, metadata = {}) {
    const list = Array.isArray(values) ? values : [];
    const total =
      typeof metadata.total === 'number'
        ? metadata.total
        : list.reduce((sum, value) => sum + value, 0);
    const info = { ...metadata, total };

    if (typeof this.#options.onPresent === 'function') {
      this.#options.onPresent(list, info);
    }

    let text = '';
    if (typeof this.#options.format === 'function') {
      text = this.#options.format(list, info);
    }
    if (text && this.#options.container) {
      this.#options.container.textContent = text;
    }
    return text;
  }

  /**
   * @returns {void}
   */
  clear() {
    if (this.#options.container) {
      this.#options.container.textContent = '';
    }
  }

  /**
   * @returns {void}
   */
  destroy() {
    this.clear();
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
  }
}
