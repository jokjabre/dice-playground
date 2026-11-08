import { createElement } from '../dom/createElement.js';

/**
 * Collapsible panel wrapper with a disclosure toggle. The toggle is the
 * panel title itself, preceded by a chevron: `›` when closed, `⌄` when
 * open. Panels are independent disclosures; apps that want accordion
 * (mutually exclusive) behavior collapse siblings on toggle clicks.
 *
 * - The toggle reports `aria-expanded` and controls the region by id.
 * - `Escape` inside the panel collapses it and returns focus to the toggle.
 * - `show()` / `focusToggle()` let apps restore focus after a close.
 */
export class Panel {
  /** @type {HTMLElement} */
  #element;

  /** @type {HTMLElement} */
  #region;

  /** @type {HTMLElement} */
  #toggle;

  /** @type {HTMLElement} */
  #chevron;

  /** @type {boolean} */
  #collapsed;

  /**
   * @param {{ title?: string, container?: HTMLElement|null, collapsed?: boolean, testId?: string, toggleTestId?: string }} [options]
   */
  constructor(options = {}) {
    const title = options.title ?? 'Panel';
    const regionId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    this.#collapsed = options.collapsed ?? false;

    this.#chevron = createElement('span', {
      className: 'dice-panel-chevron',
      'aria-hidden': 'true',
      text: this.#collapsed ? '›' : '⌄'
    });

    this.#toggle = createElement(
      'button',
      {
        type: 'button',
        className: 'dice-panel-toggle',
        'aria-expanded': String(!this.#collapsed),
        'aria-controls': regionId,
        'data-testid': options.toggleTestId ?? 'panel-toggle'
      },
      [this.#chevron, title]
    );

    this.#region = createElement(
      'div',
      {
        id: regionId,
        className: 'dice-panel-region',
        role: 'region',
        'aria-label': title,
        'data-testid': options.testId ?? 'panel',
        hidden: this.#collapsed ? true : undefined
      },
      []
    );

    this.#toggle.addEventListener('click', () => {
      this.setCollapsed(!this.#collapsed);
    });

    this.#region.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
      if (event.key === 'Escape') {
        this.setCollapsed(true);
        this.focusToggle();
      }
    });

    this.#element = createElement(
      'div',
      { className: 'dice-panel', 'data-testid': 'panel-root' },
      [this.#toggle, this.#region]
    );

    if (options.container) {
      options.container.appendChild(this.#element);
    }
  }

  /**
   * @returns {HTMLElement}
   */
  get element() {
    return this.#element;
  }

  /**
   * @returns {HTMLElement}
   */
  get region() {
    return this.#region;
  }

  /**
   * @returns {HTMLElement}
   */
  get toggle() {
    return this.#toggle;
  }

  /**
   * @returns {boolean}
   */
  get collapsed() {
    return this.#collapsed;
  }

  /**
   * @param {boolean} collapsed
   * @returns {void}
   */
  setCollapsed(collapsed) {
    this.#collapsed = Boolean(collapsed);
    this.#region.hidden = this.#collapsed;
    this.#toggle.setAttribute('aria-expanded', String(!this.#collapsed));
    this.#chevron.textContent = this.#collapsed ? '›' : '⌄';
  }

  /**
   * Move keyboard focus back to the toggle button.
   *
   * @returns {void}
   */
  focusToggle() {
    this.#toggle.focus();
  }

  /**
   * Append content into the collapsible region.
   *
   * @param {HTMLElement} child
   * @returns {void}
   */
  append(child) {
    this.#region.appendChild(child);
  }

  /**
   * @returns {void}
   */
  destroy() {
    if (this.#element.parentNode) {
      this.#element.parentNode.removeChild(this.#element);
    }
  }
}
