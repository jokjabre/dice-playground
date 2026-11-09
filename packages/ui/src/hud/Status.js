import { EVENTS } from '@dice/core';

import { createElement, setText } from '../dom/createElement.js';

/**
 * Status line: an `aria-live="polite"` region for short messages such as
 * motion-sensor status. When an event bus is supplied it follows
 * `motion:status` payloads.
 */
export class Status {
  /** @type {HTMLElement} */
  #element;

  /** @type {(() => void)|null} */
  #unsubscribe = null;

  /**
   * @param {{ events?: any, container?: HTMLElement|null, text?: string, testId?: string }} [options]
   */
  constructor(options = {}) {
    this.#element = createElement('div', {
      className: 'dice-status',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': options.testId ?? 'status',
      text: options.text ?? ''
    });

    if (options.container) {
      options.container.appendChild(this.#element);
    }

    if (options.events) {
      this.#unsubscribe = options.events.on(
        EVENTS.MOTION_STATUS,
        (/** @type {any} */ payload) => {
          this.update(payload?.message ?? payload?.status ?? '');
        }
      );
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * @param {string} text
   * @returns {void}
   */
  update(text) {
    setText(this.#element, text);
  }

  /**
   * @returns {string}
   */
  get text() {
    return this.#element.textContent ?? '';
  }

  /**
   * @returns {void}
   */
  clear() {
    this.update('');
  }

  /**
   * @returns {void}
   */
  destroy() {
    if (this.#unsubscribe) {
      this.#unsubscribe();
      this.#unsubscribe = null;
    }
    if (this.#element.parentNode) {
      this.#element.parentNode.removeChild(this.#element);
    }
  }
}
