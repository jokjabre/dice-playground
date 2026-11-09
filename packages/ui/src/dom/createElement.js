/**
 * Create a DOM element from a tag, props, and children.
 *
 * Props:
 * - `className` sets the class attribute.
 * - `text` / `textContent` sets `textContent` (never as markup).
 * - `dataset` is an object copied to `element.dataset`.
 * - `on<Event>` functions (for example `onClick`) register listeners.
 * - every other key becomes an attribute via `setAttribute`.
 *
 * Children may be strings (text nodes), DOM nodes, or arrays of those.
 *
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {any} [children]
 * @returns {HTMLElement}
 */
export function createElement(tag, props = {}, children = []) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'className') {
      element.className = String(value);
    } else if (key === 'text' || key === 'textContent') {
      element.textContent = String(value);
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = String(dataValue);
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  }

  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === undefined || child === null || child === false) continue;
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else {
      element.appendChild(child);
    }
  }

  return element;
}

/**
 * Replace an element's text safely. Text is always assigned through
 * `textContent`, never inserted as markup.
 *
 * @param {HTMLElement|null|undefined} element
 * @param {string} text
 * @returns {void}
 */
export function setText(element, text) {
  if (element) element.textContent = String(text);
}
