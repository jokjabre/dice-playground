import { EVENTS } from '@dice/core';

import { createElement, setText } from '../dom/createElement.js';

/**
 * Event-driven result banner. Subscribes to `roll:settle` on the supplied
 * event bus; no engine instance is required. The banner is an
 * `aria-live="polite"` status region with a stable `data-testid`.
 */
export class ResultBanner {
  /** @type {HTMLElement|null} */
  #element = null;

  /** @type {(() => void)|null} */
  #unsubscribe = null;

  /** @type {any} */
  #timer = null;

  /** @type {number} */
  #hideDelay;

  /** @type {boolean} */
  #autoHide;

  /**
   * @param {{ events?: any, container?: HTMLElement|null, id?: string, autoHide?: boolean|number, hideDelay?: number }} [options]
   */
  constructor(options = {}) {
    const autoHide = options.autoHide ?? false;
    this.#autoHide = autoHide === true || typeof autoHide === 'number';
    this.#hideDelay =
      typeof autoHide === 'number' ? autoHide : (options.hideDelay ?? 3000);

    this.#element = createElement('div', {
      id: options.id ?? 'dice-result-banner',
      className: 'dice-banner',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'result-banner',
      hidden: true
    });

    if (options.container) {
      options.container.appendChild(this.#element);
    }

    if (options.events) {
      this.#unsubscribe = options.events.on(
        EVENTS.ROLL_SETTLE,
        (/** @type {any} */ payload) => {
          const result = payload?.result ?? payload;
          const values = result?.values ?? [];
          this.present(values, result ?? {});
        }
      );
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return /** @type {HTMLElement} */ (this.#element);
  }

  /**
   * Show the settled values and their total.
   *
   * @param {number[]} values
   * @param {Record<string, any>} [metadata]
   * @returns {void}
   */
  present(values, metadata = {}) {
    if (!this.#element) return;
    const list = Array.isArray(values) ? values : [];
    if (list.length === 0) {
      this.clear();
      return;
    }

    const total =
      typeof metadata.total === 'number'
        ? metadata.total
        : list.reduce((sum, value) => sum + value, 0);

    setText(
      this.#element,
      list.length === 1 ? String(list[0]) : `${list.join(' + ')} = ${total}`
    );
    this.#element.hidden = false;
    this.#element.classList.add('dice-banner-visible');

    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#autoHide) {
      this.#timer = setTimeout(() => this.clear(), this.#hideDelay);
    }
  }

  /**
   * Hide the banner. The element stays mounted so assistive tech keeps a
   * stable live region.
   *
   * @returns {void}
   */
  clear() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (!this.#element) return;
    this.#element.classList.remove('dice-banner-visible');
    this.#element.hidden = true;
    setText(this.#element, '');
  }

  /**
   * Unsubscribe and remove the element.
   *
   * @returns {void}
   */
  destroy() {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
    if (this.#element?.parentNode) {
      this.#element.parentNode.removeChild(this.#element);
    }
    this.#element = null;
  }
}
