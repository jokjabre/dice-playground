import { createElement } from '../dom/createElement.js';

/**
 * @typedef {Object} ControlItem
 * @property {string} id
 * @property {'select'|'range'|'number'|'text'|'toggle'|'button'} type
 * @property {string} label
 * @property {unknown} [value]
 * @property {Array<{ value: string, label: string }>} [options]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {boolean} [disabled]
 * @property {string} [testId]
 */

/**
 * @typedef {{ id: string, value: unknown }} ChangePayload
 */

/**
 * Schema-driven control panel. Renders `ControlItem` entries and emits
 * `change` events with `{ id, value }`. No engine instance is involved:
 * apps wire `change` to engine commands.
 */
export class ControlPanel {
  /** @type {HTMLElement} */
  #element;

  /** @type {Map<string, any>} */
  #controls = new Map();

  /** @type {Map<string, ControlItem>} */
  #items = new Map();

  /** @type {Set<(payload: ChangePayload) => void>} */
  #handlers = new Set();

  /**
   * @param {{ title?: string, items?: ControlItem[], container?: HTMLElement|null, testId?: string }} [options]
   */
  constructor(options = {}) {
    const items = options.items ?? [];

    /** @type {HTMLElement[]} */
    const children = [];

    if (options.title) {
      children.push(
        createElement('h2', {
          className: 'dice-panel-title',
          text: options.title
        })
      );
    }

    for (const item of items) {
      children.push(this.#buildItem(item));
    }

    this.#element = createElement(
      'section',
      {
        className: 'dice-control-panel',
        role: 'region',
        'aria-label': options.title ?? 'Controls',
        'data-testid': options.testId ?? 'control-panel'
      },
      children
    );

    if (options.container) {
      options.container.appendChild(this.#element);
    }
  }

  /**
   * @param {ControlItem} item
   * @returns {HTMLElement}
   */
  #buildItem(item) {
    if (!item || typeof item.id !== 'string' || item.id.length === 0) {
      throw new TypeError('ControlItem requires a non-empty id.');
    }
    if (!['select', 'range', 'number', 'text', 'toggle', 'button'].includes(item.type)) {
      throw new TypeError(`Unknown control type for "${item.id}": ${String(item.type)}`);
    }

    this.#items.set(item.id, { ...item });
    const testId = item.testId ?? item.id;
    /** @type {HTMLElement} */
    let control;

    if (item.type === 'select') {
      const options = (item.options ?? []).map((option) =>
        createElement('option', { value: option.value, text: option.label })
      );
      control = createElement(
        'select',
        {
          id: `control-${item.id}`,
          name: item.id,
          'data-testid': testId,
          'data-control-id': item.id,
          disabled: item.disabled ? true : undefined
        },
        options
      );
      if (item.value !== undefined) {
        /** @type {HTMLSelectElement} */ (control).value = String(item.value);
      }
    } else if (item.type === 'button') {
      control = createElement('button', {
        type: 'button',
        id: `control-${item.id}`,
        name: item.id,
        className: 'dice-control-button',
        'data-testid': testId,
        'data-control-id': item.id,
        disabled: item.disabled ? true : undefined,
        text: item.label
      });
    } else {
      const type =
        item.type === 'toggle'
          ? 'checkbox'
          : item.type === 'range'
            ? 'range'
            : item.type === 'number'
              ? 'number'
              : 'text';
      control = createElement('input', {
        type,
        id: `control-${item.id}`,
        name: item.id,
        className: 'dice-control-input',
        'data-testid': testId,
        'data-control-id': item.id,
        disabled: item.disabled ? true : undefined,
        min: item.min !== undefined ? String(item.min) : undefined,
        max: item.max !== undefined ? String(item.max) : undefined,
        step: item.step !== undefined ? String(item.step) : undefined,
        value:
          item.type === 'toggle'
            ? undefined
            : item.value !== undefined
              ? String(item.value)
              : undefined,
        checked:
          item.type === 'toggle' && item.value !== undefined
            ? Boolean(item.value)
            : undefined
      });
    }

    this.#controls.set(item.id, control);

    const emit = () => {
      this.#emit(item.id, this.#readValue(item.id));
    };
    control.addEventListener('change', emit);
    control.addEventListener('input', emit);
    if (item.type === 'button') {
      control.addEventListener('click', emit);
    }

    if (item.type === 'button') {
      return /** @type {HTMLElement} */ (control);
    }

    const label = createElement(
      'label',
      { className: 'dice-control-label', for: `control-${item.id}` },
      [item.label, ' ', control]
    );
    return createElement(
      'div',
      { className: 'dice-control-row' },
      [label]
    );
  }

  /**
   * @param {string} id
   * @returns {unknown}
   */
  #readValue(id) {
    const control = this.#controls.get(id);
    const item = this.#items.get(id);
    if (!control) return undefined;
    if (item?.type === 'toggle') return Boolean(control.checked);
    if (item?.type === 'range' || item?.type === 'number') {
      const number = Number(control.value);
      return Number.isFinite(number) ? number : control.value;
    }
    return control.value;
  }

  /**
   * @param {string} id
   * @param {unknown} value
   * @returns {void}
   */
  #emit(id, value) {
    for (const handler of [...this.#handlers]) {
      handler({ id, value });
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * Subscribe to `change` events. Returns an unsubscribe function.
   *
   * @param {(payload: ChangePayload) => void} handler
   * @returns {() => void}
   */
  on(handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('ControlPanel.on requires a handler function.');
    }
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  /**
   * Current value of a control.
   *
   * @param {string} id
   * @returns {unknown}
   */
  getValue(id) {
    if (!this.#controls.has(id)) {
      throw new RangeError(`Unknown control id: ${id}`);
    }
    return this.#readValue(id);
  }

  /**
   * Set a control's value from code without emitting `change`.
   *
   * @param {string} id
   * @param {unknown} value
   * @returns {void}
   */
  setValue(id, value) {
    const control = this.#controls.get(id);
    if (!control) {
      throw new RangeError(`Unknown control id: ${id}`);
    }
    const item = this.#items.get(id);
    if (item?.type === 'toggle') {
      control.checked = Boolean(value);
    } else {
      control.value = value === undefined || value === null ? '' : String(value);
    }
  }

  /**
   * @param {string} id
   * @param {boolean} disabled
   * @returns {void}
   */
  setDisabled(id, disabled) {
    const control = this.#controls.get(id);
    if (!control) {
      throw new RangeError(`Unknown control id: ${id}`);
    }
    control.disabled = Boolean(disabled);
  }

  /**
   * Remove the panel from the DOM and drop every handler.
   *
   * @returns {void}
   */
  destroy() {
    this.#handlers.clear();
    this.#controls.clear();
    this.#items.clear();
    if (this.#element.parentNode) {
      this.#element.parentNode.removeChild(this.#element);
    }
  }
}
