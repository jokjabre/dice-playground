import { createElement } from '../dom/createElement.js';
import { Panel } from '../hud/Panel.js';
import { renderField, getAtPath } from './fields.js';
import { getUiSection, normalizeFieldDef } from './registry.js';

/**
 * Render a single settings section from a registry/UI definition.
 * Framework-agnostic DOM. Emits per-field changes with canonical path info.
 */
export class SettingsSection {
  /** @type {HTMLElement} */
  #element;
  /** @type {import('../hud/Panel.js').Panel|null} */
  #panel = null;
  /** @type {HTMLElement} */
  #body;
  /** @type {Map<string, { field: any, api: any }>} */
  #fields = new Map();
  /** @type {Set<(payload:any)=>void>} */
  #handlers = new Set();
  /** @type {string} */
  #sectionId;
  /** @type {Record<string, any>} */
  #value;

  /**
   * @param {{
   *   sectionId?: string,
   *   definition?: any,
   *   value?: Record<string, any>,
   *   container?: HTMLElement|null,
   *   collapsible?: boolean,
   *   collapsed?: boolean,
   *   title?: string,
   *   testId?: string
   * }} [options]
   */
  constructor(options = {}) {
    const definition = options.definition || (options.sectionId ? getUiSection(options.sectionId) : null);
    if (!definition || !definition.id) {
      throw new TypeError('SettingsSection requires a definition or a known sectionId.');
    }
    this.#sectionId = definition.id;
    this.#value = options.value && typeof options.value === 'object' ? { ...options.value } : {};

    const title = options.title || definition.label || definition.id;
    const testId = options.testId || `settings-section-${definition.id}`;
    this.#body = createElement('div', { className: 'dice-settings-section-body' }, []);

    const fields = (definition.fields || []).filter((/** @type {any} */ f) => !f.hidden);
    this.#renderFields(fields, '');

    if (options.collapsible === false) {
      this.#element = createElement('section', {
        className: 'dice-settings-section',
        'data-section-id': definition.id,
        'data-testid': testId
      }, [createElement('h3', { className: 'dice-settings-section-title', text: title }), this.#body]);
    } else {
      this.#panel = new Panel({
        title,
        collapsed: options.collapsed ?? false,
        testId,
        toggleTestId: `toggle-${testId}`,
        container: null
      });
      this.#panel.element.classList.add('dice-settings-section');
      this.#panel.element.setAttribute('data-section-id', definition.id);
      this.#panel.append(this.#body);
      this.#element = this.#panel.element;
    }

    if (options.container) options.container.appendChild(this.#element);
  }

  /** @param {any[]} fields @param {string} groupPrefix */
  #renderFields(fields, groupPrefix) {
    for (const raw of fields) {
      const field = /** @type {any} */ (normalizeFieldDef(raw));
      if (field.hidden) continue;
      const path = Array.isArray(field.path) ? field.path : (typeof field.path === "string" ? field.path.split(".").filter(Boolean) : (field.id ? [String(field.id)] : []));
      const current = getAtPath(this.#value, path);
      const api = renderField(field, {
        value: current,
        testIdPrefix: `settings-${this.#sectionId}`,
        onChange: (payload) => this.#emitChange(payload)
      });
      this.#fields.set(String(field.id || ""), { field, api });
      this.#body.appendChild(api.element);
    }
  }

  /** @param {any} payload */
  #emitChange(payload) {
    const event = {
      sectionId: this.#sectionId,
      id: payload.id,
      path: payload.path || [],
      value: payload.value,
      field: payload.field,
      apply: payload.field?.apply
    };
    for (const h of [...this.#handlers]) h(event);
  }

  get element() { return this.#element; }
  get sectionId() { return this.#sectionId; }

  /** @param {(payload:any)=>void} handler */
  onChange(handler) { this.#handlers.add(handler); return () => this.#handlers.delete(handler); }

  /** @param {string} fieldId @returns {any} */
  getValue(fieldId) {
    const entry = this.#fields.get(fieldId);
    if (!entry) throw new RangeError(`Unknown settings field: ${fieldId}`);
    return entry.api.getValue();
  }

  /** @param {string} fieldId @param {any} value */
  setValue(fieldId, value) {
    const entry = this.#fields.get(fieldId);
    if (!entry) throw new RangeError(`Unknown settings field: ${fieldId}`);
    entry.api.setValue(value);
  }

  /** @param {Record<string, any>} sectionValue */
  setSectionValue(sectionValue) {
    this.#value = sectionValue && typeof sectionValue === 'object' ? { ...sectionValue } : {};
    for (const [, { field, api }] of this.#fields) {
      const path = Array.isArray(field.path) ? field.path : (typeof field.path === "string" ? field.path.split(".").filter(Boolean) : (field.id ? [String(field.id)] : []));
      api.setValue(getAtPath(this.#value, path));
    }
  }

  destroy() {
    this.#handlers.clear();
    this.#fields.clear();
    if (this.#panel) this.#panel.destroy();
    else if (this.#element.parentNode) this.#element.parentNode.removeChild(this.#element);
  }
}
