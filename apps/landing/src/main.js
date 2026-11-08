import registry from '@registry';

import './styles.css';

/**
 * Registry-driven landing page. The registry is imported at build time
 * through the shared `@registry` alias. This app contains no engine
 * bundle and loads instantly.
 */

/**
 * @typedef {Object} RegistryEntry
 * @property {string} id
 * @property {string} category
 * @property {string} title
 * @property {string} description
 * @property {string} path
 * @property {string} url
 * @property {string} status
 */

const CATEGORY_ORDER = ['sandbox', 'demo', 'game'];
/** @type {Record<string, string>} */
const CATEGORY_TITLES = {
  sandbox: 'Sandbox',
  demo: 'Demos',
  game: 'Games'
};

/**
 * @param {string} tag
 * @param {Record<string, string>|undefined} attrs
 * @param {Array<string|HTMLElement>} [children]
 * @returns {HTMLElement}
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (key === 'class') {
      node.className = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      node.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      node.appendChild(child);
    }
  }
  return node;
}

/**
 * @param {RegistryEntry} entry
 * @returns {HTMLElement}
 */
function renderCard(entry) {
  const live = entry.status === 'live';
  const badge = el('span', {
    class: `landing-badge landing-badge-${entry.status}`,
    'data-testid': `badge-${entry.id}`
  }, [entry.status]);

  const body = [
    el('span', { class: 'landing-card-title' }, [entry.title]),
    badge,
    el('span', { class: 'landing-card-description' }, [entry.description])
  ];

  if (live) {
    return el(
      'a',
      {
        class: 'landing-card',
        href: `./${entry.url}`,
        'data-testid': `card-${entry.id}`
      },
      body
    );
  }

  return el(
    'div',
    {
      class: `landing-card landing-card-disabled landing-card-${entry.status}`,
      'data-testid': `card-${entry.id}`
    },
    body
  );
}

function render() {
  const main = document.getElementById('landing-main');
  if (!main) return;

  const appEntries = /** @type {RegistryEntry[]} */ (
    /** @type {unknown} */ (registry)
  ).filter((entry) => entry.category !== 'landing');

  /** @type {HTMLElement[]} */
  const sections = [];

  for (const category of CATEGORY_ORDER) {
    const group = appEntries.filter((entry) => entry.category === category);
    if (group.length === 0) continue;
    const cards = group.map(renderCard);
    sections.push(
      el('section', { class: 'landing-section' }, [
        el('h2', {}, [CATEGORY_TITLES[category]]),
        el('div', { class: 'landing-cards' }, cards)
      ])
    );
  }

  main.replaceChildren(...sections);
}

render();
