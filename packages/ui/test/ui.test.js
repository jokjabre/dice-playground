// @ts-nocheck
// @vitest-environment happy-dom
import { EventBus, EVENTS } from '@dice/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ControlPanel,
  CustomPresenter,
  Panel,
  ResultBanner,
  SilentPresenter,
  Status,
  Toolbar,
  createElement
} from '../src/index.js';

/** @type {HTMLElement} */
let container;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  document.body.innerHTML = '';
});

describe('createElement', () => {
  it('builds elements with text, datasets, and test ids without innerHTML', () => {
    const el = createElement('div', {
      className: 'box',
      'data-testid': 'box',
      text: '<b>not markup</b>'
    });
    expect(el.className).toBe('box');
    expect(el.getAttribute('data-testid')).toBe('box');
    expect(el.textContent).toBe('<b>not markup</b>');
    expect(el.querySelector('b')).toBeNull();
  });
});

describe('ResultBanner', () => {
  it('presents, hides, and clears on roll:settle', () => {
    const events = new EventBus();
    const banner = new ResultBanner({ events, container });

    const el = container.querySelector('[data-testid="result-banner"]');
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.hidden).toBe(true);

    events.emit(EVENTS.ROLL_SETTLE, {
      rollId: 'roll-1',
      result: { values: [3, 5], total: 8 }
    });

    expect(el.hidden).toBe(false);
    expect(el.textContent).toBe('3 + 5 = 8');
    expect(el.classList.contains('dice-banner-visible')).toBe(true);

    banner.clear();
    expect(el.hidden).toBe(true);
    expect(el.textContent).toBe('');

    banner.destroy();
    expect(container.querySelector('[data-testid="result-banner"]')).toBeNull();
  });

  it('presents a single value and auto-hides after the delay', () => {
    vi.useFakeTimers();
    const banner = new ResultBanner({ events: new EventBus(), container, autoHide: 1000 });
    banner.present([6]);
    expect(container.querySelector('[data-testid="result-banner"]').textContent).toBe('6');

    vi.advanceTimersByTime(1000);
    expect(container.querySelector('[data-testid="result-banner"]').hidden).toBe(true);
    vi.useRealTimers();
    banner.destroy();
  });

  it('present() works without a bus and destroy is idempotent', () => {
    const banner = new ResultBanner({ container });
    banner.present([1, 1, 1], { total: 3 });
    expect(banner.element.textContent).toContain('3');
    banner.destroy();
    banner.destroy();
  });
});

describe('SilentPresenter and CustomPresenter', () => {
  it('silent presenter re-emits result:present without touching the DOM', () => {
    const events = new EventBus();
    const seen = [];
    events.on(EVENTS.RESULT_PRESENT, (payload) => seen.push(payload));
    const presenter = new SilentPresenter({ events });

    presenter.present([2, 4]);
    expect(seen).toEqual([{ values: [2, 4], total: 6, metadata: {} }]);
    expect(container.innerHTML).toBe('');
    presenter.destroy();
  });

  it('custom presenter formats through the supplied callback', () => {
    const formatted = [];
    const presenter = new CustomPresenter({
      format: (values, metadata) => {
        formatted.push(metadata.total);
        return values.join('-');
      }
    });
    expect(presenter.present([1, 2])).toBe('1-2');
    expect(formatted).toEqual([3]);
    presenter.destroy();
  });
});

describe('ControlPanel', () => {
  const items = [
    {
      id: 'enclosure',
      type: 'select',
      label: 'Enclosure',
      value: 'box',
      options: [
        { value: 'box', label: 'Box' },
        { value: 'sphere', label: 'Sphere' }
      ]
    },
    { id: 'gravity', type: 'range', label: 'Gravity', value: -2940, min: -5000, max: 0 },
    { id: 'motion', type: 'toggle', label: 'Motion', value: false },
    { id: 'throw', type: 'button', label: 'Throw' }
  ];

  it('renders schema controls with labels and test ids', () => {
    const panel = new ControlPanel({ title: 'Engine', items, container });
    expect(container.querySelector('[data-testid="control-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="enclosure"]').tagName).toBe('SELECT');
    expect(container.querySelector('[data-testid="gravity"]').tagName).toBe('INPUT');
    expect(container.querySelector('[data-testid="throw"]').textContent).toBe('Throw');
    expect(panel.getValue('enclosure')).toBe('box');
    expect(panel.getValue('gravity')).toBe(-2940);
    panel.destroy();
  });

  it('emits change events and supports setValue / setDisabled / teardown', () => {
    const panel = new ControlPanel({ items, container });
    const changes = [];
    const off = panel.on((payload) => changes.push(payload));

    const select = container.querySelector('[data-testid="enclosure"]');
    select.value = 'sphere';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(changes).toContainEqual({ id: 'enclosure', value: 'sphere' });

    panel.setValue('gravity', -1000);
    expect(panel.getValue('gravity')).toBe(-1000);
    // Programmatic setValue does not emit.
    expect(changes.some((c) => c.id === 'gravity')).toBe(false);

    panel.setDisabled('throw', true);
    expect(container.querySelector('[data-testid="throw"]').disabled).toBe(true);
    panel.setDisabled('throw', false);

    off();
    changes.length = 0;
    select.value = 'box';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(changes).toEqual([]);

    panel.destroy();
    expect(container.querySelector('[data-testid="control-panel"]')).toBeNull();
    expect(() => panel.setValue('nope', 1)).toThrow();
  });

  it('rejects unknown control types and unknown ids', () => {
    expect(
      () => new ControlPanel({ items: [{ id: 'x', type: 'slider', label: 'X' }], container })
    ).toThrow();
    const panel = new ControlPanel({ items, container });
    expect(() => panel.getValue('missing')).toThrow();
    panel.destroy();
  });
});

describe('DOM integration', () => {
  it('mounts a banner and a control panel against one fake event bus', () => {
    const events = new EventBus();
    const banner = new ResultBanner({ events, container });
    const panel = new ControlPanel({
      title: 'Engine',
      items: [
        {
          id: 'enclosure',
          type: 'select',
          label: 'Enclosure',
          value: 'box',
          options: [
            { value: 'box', label: 'Box' },
            { value: 'sphere', label: 'Sphere' }
          ]
        }
      ],
      container
    });

    const changes = [];
    panel.on((payload) => changes.push(payload));

    // A settled roll flows through the bus into the banner.
    events.emit(EVENTS.ROLL_SETTLE, {
      rollId: 'roll-int',
      result: { values: [4, 2], total: 6 }
    });
    expect(container.querySelector('[data-testid="result-banner"]').textContent).toBe(
      '4 + 2 = 6'
    );

    // Panel changes are independent of the bus and wire to app commands.
    const select = container.querySelector('[data-testid="enclosure"]');
    select.value = 'sphere';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(changes).toEqual([{ id: 'enclosure', value: 'sphere' }]);

    banner.destroy();
    panel.destroy();
    expect(container.innerHTML).toBe('');
  });
});

describe('Toolbar, Panel, and Status', () => {
  it('toolbar emits actions and disables items', () => {
    const actions = [];
    const toolbar = new Toolbar({
      items: [
        { id: 'roll', label: 'Roll' },
        { id: 'clear', label: 'Clear', disabled: true }
      ],
      container,
      onAction: (payload) => actions.push(payload)
    });
    container.querySelector('[data-testid="roll"]').click();
    expect(actions).toEqual([{ id: 'roll' }]);
    toolbar.setDisabled('roll', true);
    expect(container.querySelector('[data-testid="roll"]').disabled).toBe(true);
    toolbar.destroy();
  });

  it('panel collapses on Escape and returns focus to the toggle', () => {
    const panel = new Panel({ title: 'Engine options', container, collapsed: false });
    const region = container.querySelector('[data-testid="panel"]');
    const toggle = container.querySelector('[data-testid="panel-toggle"]');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    region.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(panel.collapsed).toBe(true);
    expect(document.activeElement).toBe(toggle);

    toggle.click();
    expect(panel.collapsed).toBe(false);
    panel.destroy();
  });

  it('status follows motion:status events', () => {
    const events = new EventBus();
    const status = new Status({ events, container });
    events.emit(EVENTS.MOTION_STATUS, { status: 'denied', message: 'Permission denied' });
    expect(status.text).toBe('Permission denied');
    expect(container.querySelector('[data-testid="status"]').getAttribute('aria-live')).toBe('polite');
    status.destroy();
  });
});
