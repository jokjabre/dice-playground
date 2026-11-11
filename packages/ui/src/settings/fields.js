import { createElement } from '../dom/createElement.js';

/** @param {any} obj @param {string[]} path */
export function getAtPath(obj, path) {
  let cur = obj;
  for (const key of path || []) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

/** @param {any} obj @param {string[]} path @param {any} value */
export function setAtPath(obj, path, value) {
  const root = obj && typeof obj === 'object' ? { ...obj } : {};
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = cur[key];
    cur[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {};
    cur = cur[key];
  }
  if (path.length) cur[path[path.length - 1]] = value;
  return root;
}

/** @param {string} type @param {any} value */
function toInputValue(type, value) {
  if (type === 'toggle') return Boolean(value);
  if (value === undefined || value === null) return '';
  return String(value);
}

/** @param {string} type @param {any} control */
function readControlValue(type, control) {
  if (type === 'toggle') return Boolean(control.checked);
  if (type === 'range' || type === 'number') {
    if (control.value === '') return undefined;
    const n = Number(control.value);
    return Number.isFinite(n) ? n : control.value;
  }
  return control.value;
}

/**
 * Render a single field control.
 * @param {import('./registry.js').FieldDef} field
 * @param {{ value?: any, onChange?: (payload: { id: string, path: string[], value: any, field: any }) => void, testIdPrefix?: string }} options
 * @returns {{ element: HTMLElement, control: HTMLElement|null, getValue: () => any, setValue: (v:any)=>void }}
 */
export function renderField(field, options = {}) {
  const type = field.type || 'text';
  const id = field.id || (Array.isArray(field.path) ? field.path.join('.') : String(field.path || '')) || 'field';
  const labelText = field.label || id;
  const testId = (options.testIdPrefix ? options.testIdPrefix + '-' : '') + id;
  const path = Array.isArray(field.path) ? field.path : (typeof field.path === 'string' ? field.path.split('.').filter(Boolean) : [id]);
  let value = options.value !== undefined ? options.value : field.defaultValue;

  if (type === 'group') {
    const children = (field.fields || []).map((child) =>
      renderField({ ...child }, { ...options, value: getAtPath(value, /** @type {string[]} */ (Array.isArray(child.path)?child.path:(typeof child.path==='string'?child.path.split('.').filter(Boolean):(child.id?[String(child.id)]:[])))) }).element
    );
    const body = createElement('div', { className: 'dice-settings-group-body' }, children);
    const element = createElement('fieldset', { className: 'dice-settings-group', 'data-settings-group': id }, [
      labelText ? createElement('legend', { className: 'dice-settings-group-title', text: labelText }) : null,
      field.help ? createElement('div', { className: 'dice-settings-help', text: field.help }) : null,
      body
    ].filter(Boolean));
    return {
      element,
      control: null,
      getValue: () => value,
      setValue: (v) => { value = v; }
    };
  }

  /** @type {HTMLElement|null} */
  let control = null;

  if (type === 'select') {
    const opts = (field.options || []).map((o) =>
      createElement('option', { value: String(o.value), text: o.label ?? String(o.value) })
    );
    control = createElement('select', {
      className: 'dice-control-input dice-settings-input',
      'data-testid': testId,
      'data-field-id': id,
      disabled: field.disabled ? true : undefined
    }, opts);
    if (value !== undefined) /** @type {HTMLSelectElement} */ (control).value = String(value);
  } else if (type === 'button') {
    control = createElement('button', {
      type: 'button',
      className: 'dice-control-button dice-settings-button',
      'data-testid': testId,
      'data-field-id': id,
      disabled: field.disabled ? true : undefined,
      text: labelText
    });
  } else {
    const inputType = type === 'toggle' ? 'checkbox' : type === 'range' ? 'range' : type === 'number' ? 'number' : type === 'color' ? 'color' : 'text';
    /** @type {Record<string, any>} */
    const attrs = {
      type: inputType,
      className: 'dice-control-input dice-settings-input',
      'data-testid': testId,
      'data-field-id': id,
      disabled: field.disabled ? true : undefined
    };
    if (field.min !== undefined) attrs.min = String(field.min);
    if (field.max !== undefined) attrs.max = String(field.max);
    if (field.step !== undefined) attrs.step = String(field.step);
    if (type === 'toggle') {
      if (value !== undefined) attrs.checked = Boolean(value);
    } else if (value !== undefined) {
      attrs.value = String(toInputValue(type, value));
    }
    control = createElement('input', attrs);
  }

  const emit = () => {
    const next = readControlValue(type, control);
    value = next;
    if (options.onChange) options.onChange({ id, path, value: next, field });
  };
  if (control) {
    control.addEventListener('change', emit);
    if (type !== 'button') control.addEventListener('input', emit);
    if (type === 'button') control.addEventListener('click', () => options.onChange && options.onChange({ id, path, value: true, field }));
  }

  const help = field.help ? createElement('div', { className: 'dice-settings-help', text: field.help }) : null;
  let element;
  if (type === 'button') {
    element = createElement('div', { className: 'dice-control-row dice-settings-field' }, [control, help].filter(Boolean));
  } else if (type === 'toggle') {
    const label = createElement('label', { className: 'dice-control-label dice-settings-label', for: undefined }, [control, ' ', labelText]);
    element = createElement('div', { className: 'dice-control-row dice-settings-field' }, [label, help].filter(Boolean));
  } else {
    const label = createElement('label', { className: 'dice-control-label dice-settings-label' }, [labelText, ' ', control]);
    element = createElement('div', { className: 'dice-control-row dice-settings-field', 'data-field-id': id }, [label, help].filter(Boolean));
  }

  return {
    element,
    control,
    getValue: () => readControlValue(type, control),
    setValue: (v) => {
      value = v;
      if (!control) return;
      if (type === 'toggle') /** @type {HTMLInputElement} */ (control).checked = Boolean(v);
      else if (type !== 'button') /** @type {HTMLInputElement|HTMLSelectElement} */ (control).value = v === undefined || v === null ? '' : String(v);
    }
  };
}
