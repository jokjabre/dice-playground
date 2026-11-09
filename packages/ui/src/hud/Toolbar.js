import { createElement } from '../dom/createElement.js';

/**
 * Simple action toolbar. Renders one button per item and emits
 * `action` events with `{ id }`.
 */
export class Toolbar {
  /** @type {HTMLElement} */
  #element;

  /** @type {Map<string, HTMLButtonElement>} */
  #buttons = new Map();

  /** @type {Set<(payload: { id: string }) => void>} */
  #handlers = new Set();

  /** @type {((payload: { id: string }) => void)|undefined} */
  #onAction;

  /**
   * @param {{ items?: Array<{ id: string, label: string, testId?: string, disabled?: boolean }>, container?: HTMLElement|null, onAction?: (payload: { id: string }) => void, testId?: string }} [options]
   */
  constructor(options = {}) {
    this.#onAction = options.onAction;

    /** @type {HTMLElement[]} */
    const children = [];
    for (const item of options.items ?? []) {
      const button = /** @type {HTMLButtonElement} */ (createElement('button', {
        type: 'button',
        className: 'dice-toolbar-button',
        'data-testid': item.testId ?? item.id,
        'data-control-id': item.id,
        disabled: item.disabled ? true : undefined,
        text: item.label
      }));
      button.addEventListener('click', () => this.#emit(item.id));
      this.#buttons.set(item.id, button);
      children.push(button);
    }

    this.#element = createElement(
      'div',
      {
        className: 'dice-toolbar',
        role: 'toolbar',
        'data-testid': options.testId ?? 'toolbar'
      },
      children
    );

    if (options.container) {
      options.container.appendChild(this.#element);
    }
  }

  /**
   * @param {string} id
   * @returns {void}
   */
  #emit(id) {
    const payload = { id };
    if (this.#onAction) this.#onAction(payload);
    for (const handler of [...this.#handlers]) {
      handler(payload);
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * @param {(payload: { id: string }) => void} handler
   * @returns {() => void}
   */
  on(handler) {
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  /**
   * @param {string} id
   * @param {boolean} disabled
   * @returns {void}
   */
  setDisabled(id, disabled) {
    const button = this.#buttons.get(id);
    if (!button) {
      throw new RangeError(`Unknown toolbar item: ${id}`);
    }
    button.disabled = Boolean(disabled);
  }

  /**
   * @returns {void}
   */
  destroy() {
    this.#handlers.clear();
    this.#buttons.clear();
    if (this.#element.parentNode) {
      this.#element.parentNode.removeChild(this.#element);
    }
  }
}
