// @ts-nocheck
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THROW_VISUALIZER_MAX_COLOR,
  THROW_VISUALIZER_MAX_LENGTH,
  THROW_VISUALIZER_MEDIUM_COLOR,
  THROW_VISUALIZER_SOFT_COLOR,
  THROW_VISUALIZER_THRESHOLD,
  PointerInput,
  ThrowVisualizer,
  clampThrowPoint,
  throwColorForPower,
  throwPowerRatio
} from '../src/index.js';
import { createFakeHost } from './fakes.js';

/** @type {HTMLElement} */
let container;

/** @type {ThrowVisualizer[]} */
let visualizers;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  visualizers = [];
});

afterEach(() => {
  for (const visualizer of visualizers) visualizer.detach();
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/**
 * @param {Record<string, any>} [options]
 * @returns {ThrowVisualizer}
 */
function createVisualizer(options = {}) {
  const visualizer = new ThrowVisualizer({ container, ...options });
  visualizers.push(visualizer);
  return visualizer;
}

/**
 * @returns {any}
 */
function svg() {
  return container.querySelector('[data-testid="throw-visualizer"]');
}

describe('ThrowVisualizer overlay', () => {
  it('creates a responsive SVG overlay on the container', () => {
    const visualizer = createVisualizer();
    const element = svg();

    expect(element).not.toBeNull();
    expect(visualizer.element).toBe(element);
    expect(element.tagName).toBe('svg');
    expect(element.getAttribute('aria-hidden')).toBe('true');

    // Responsive: fills the container without intercepting pointer events.
    expect(element.style.position).toBe('absolute');
    expect(element.style.width).toBe('100%');
    expect(element.style.height).toBe('100%');
    expect(element.style.pointerEvents).toBe('none');
    expect(element.style.overflow).toBe('visible');
  });

  it('starts hidden with a zero power ratio', () => {
    const visualizer = createVisualizer();

    expect(visualizer.visible).toBe(false);
    expect(visualizer.powerRatio).toBe(0);
    expect(visualizer.length).toBe(0);
    expect(visualizer.color).toBe(THROW_VISUALIZER_SOFT_COLOR);
    expect(visualizer.anchor).toBeNull();
    expect(svg().style.visibility).toBe('hidden');
  });

  it('renders the arrow, head, base anchor, and maximum boundary ring', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 100, y: 100 });
    visualizer.update({ x: 240, y: 100 });

    expect(visualizer.visible).toBe(true);
    const element = svg();
    expect(element.querySelector('line')).not.toBeNull();
    expect(element.querySelector('polygon')).not.toBeNull();
    expect(element.querySelectorAll('circle')).toHaveLength(2);

    // The dashed ring marks maximum power at Lmax around the anchor.
    const ring = element.querySelectorAll('circle')[0];
    expect(Number(ring.getAttribute('r'))).toBe(THROW_VISUALIZER_MAX_LENGTH);
    expect(Number(ring.getAttribute('cx'))).toBe(100);
    expect(Number(ring.getAttribute('cy'))).toBe(100);
  });

  it('anchors the base at the start point and follows the cursor direction', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 100, y: 120 });
    visualizer.update({ x: 200, y: 120 });

    const shaft = svg().querySelector('line');
    expect(Number(shaft.getAttribute('x1'))).toBe(100);
    expect(Number(shaft.getAttribute('y1'))).toBe(120);
    expect(Number(shaft.getAttribute('x2'))).toBe(200);
    expect(Number(shaft.getAttribute('y2'))).toBe(120);

    const anchorEl = svg().querySelectorAll('circle')[1];
    expect(Number(anchorEl.getAttribute('cx'))).toBe(100);
    expect(Number(anchorEl.getAttribute('cy'))).toBe(120);
    expect(visualizer.anchor).toEqual({ x: 100, y: 120 });
    expect(visualizer.tip).toEqual({ x: 200, y: 120 });
  });

  it('clamps the tip to the maximum length along the drag ray', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 100, y: 100 });
    visualizer.update({ x: 2000, y: 100 });

    expect(visualizer.length).toBe(THROW_VISUALIZER_MAX_LENGTH);
    expect(visualizer.powerRatio).toBe(1);
    expect(visualizer.tip).toEqual({ x: 100 + THROW_VISUALIZER_MAX_LENGTH, y: 100 });

    const shaft = svg().querySelector('line');
    expect(Number(shaft.getAttribute('x2'))).toBe(100 + THROW_VISUALIZER_MAX_LENGTH);
  });

  it('preserves the drag direction when clamping off-axis', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 1000, y: 1000 });

    const tip = visualizer.tip;
    expect(tip.x).toBeCloseTo(tip.y, 6);
    expect(Math.hypot(tip.x, tip.y)).toBeCloseTo(THROW_VISUALIZER_MAX_LENGTH, 6);
    expect(visualizer.powerRatio).toBe(1);
  });

  it('re-anchors when start is called again', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 10, y: 10 });
    visualizer.update({ x: 110, y: 10 });
    expect(visualizer.visible).toBe(true);

    visualizer.start({ x: 50, y: 60 });
    expect(visualizer.visible).toBe(false);
    expect(visualizer.anchor).toEqual({ x: 50, y: 60 });
    expect(visualizer.powerRatio).toBe(0);
  });
});

describe('ThrowVisualizer power styling', () => {
  it('interpolates teal to gold to orange-red with the power ratio', () => {
    expect(throwColorForPower(0)).toBe(THROW_VISUALIZER_SOFT_COLOR);
    expect(throwColorForPower(0.5)).toBe(THROW_VISUALIZER_MEDIUM_COLOR);
    expect(throwColorForPower(1)).toBe(THROW_VISUALIZER_MAX_COLOR);
    expect(THROW_VISUALIZER_SOFT_COLOR).not.toBe(THROW_VISUALIZER_MEDIUM_COLOR);
    expect(THROW_VISUALIZER_MEDIUM_COLOR).not.toBe(THROW_VISUALIZER_MAX_COLOR);

    const quarter = throwColorForPower(0.25);
    expect(quarter).not.toBe(THROW_VISUALIZER_SOFT_COLOR);
    expect(quarter).not.toBe(THROW_VISUALIZER_MEDIUM_COLOR);
    expect(throwColorForPower(0.75)).not.toBe(THROW_VISUALIZER_MEDIUM_COLOR);

    // Out-of-range ratios clamp to the nearest stop.
    expect(throwColorForPower(-1)).toBe(THROW_VISUALIZER_SOFT_COLOR);
    expect(throwColorForPower(2)).toBe(THROW_VISUALIZER_MAX_COLOR);
  });

  it('paints the sampled power colour onto the arrow parts', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: THROW_VISUALIZER_MAX_LENGTH / 2, y: 0 });

    expect(visualizer.powerRatio).toBeCloseTo(0.5, 6);
    expect(visualizer.color).toBe(THROW_VISUALIZER_MEDIUM_COLOR);
    expect(svg().querySelector('line').getAttribute('stroke')).toBe(
      THROW_VISUALIZER_MEDIUM_COLOR
    );
  });

  it('turns red-orange at maximum power', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: THROW_VISUALIZER_MAX_LENGTH * 3, y: 0 });

    expect(visualizer.color).toBe(THROW_VISUALIZER_MAX_COLOR);
    expect(svg().querySelector('polygon').getAttribute('fill')).toBe(
      THROW_VISUALIZER_MAX_COLOR
    );
  });

  it('computes clamped lengths, ratios, and points purely', () => {
    expect(throwPowerRatio(THROW_VISUALIZER_MAX_LENGTH)).toBe(1);
    expect(throwPowerRatio(THROW_VISUALIZER_MAX_LENGTH * 3)).toBe(1);
    expect(throwPowerRatio(0)).toBe(0);

    const clamped = clampThrowPoint({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(clamped.length).toBe(50);
    expect(clamped.point).toEqual({ x: 30, y: 40 });

    const beyond = clampThrowPoint({ x: 0, y: 0 }, { x: 300, y: 400 });
    expect(beyond.length).toBe(THROW_VISUALIZER_MAX_LENGTH);
    expect(beyond.ratio).toBe(1);
    expect(beyond.point.x).toBeCloseTo(
      (THROW_VISUALIZER_MAX_LENGTH * 300) / 500,
      6
    );
  });
});

describe('ThrowVisualizer threshold and lifecycle', () => {
  it('auto-hides sub-threshold drags and shows past the threshold', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 100, y: 100 });
    visualizer.update({ x: 100 + THROW_VISUALIZER_THRESHOLD - 1, y: 100 });

    expect(visualizer.visible).toBe(false);
    expect(svg().style.visibility).toBe('hidden');

    visualizer.update({ x: 100 + THROW_VISUALIZER_THRESHOLD + 10, y: 100 });
    expect(visualizer.visible).toBe(true);
    expect(svg().style.visibility).toBe('visible');
  });

  it('plays a fade and scale snap on release, then hides', () => {
    vi.useFakeTimers();
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 100, y: 0 });

    visualizer.release();
    expect(svg().classList.contains('is-releasing')).toBe(true);
    expect(svg().style.opacity).toBe('0');
    expect(visualizer.visible).toBe(false);

    vi.advanceTimersByTime(201);
    expect(svg().style.visibility).toBe('hidden');
    expect(svg().classList.contains('is-releasing')).toBe(false);
    expect(visualizer.powerRatio).toBe(0);
    expect(visualizer.anchor).toBeNull();
  });

  it('hides immediately on sub-threshold release without animating', () => {
    vi.useFakeTimers();
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 5, y: 0 });
    visualizer.release();

    expect(svg().classList.contains('is-releasing')).toBe(false);
    expect(svg().style.visibility).toBe('hidden');
    expect(visualizer.anchor).toBeNull();
  });

  it('hides immediately on cancel', () => {
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 100, y: 0 });
    expect(visualizer.visible).toBe(true);

    visualizer.cancel();
    expect(visualizer.visible).toBe(false);
    expect(svg().style.visibility).toBe('hidden');
    expect(visualizer.anchor).toBeNull();
  });

  it('snapshots the final point on release', () => {
    vi.useFakeTimers();
    const visualizer = createVisualizer();
    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 80, y: 0 });
    visualizer.release({ x: 160, y: 0 });

    // The snap reflects the release point, not the last move.
    expect(visualizer.length).toBe(160);
    vi.advanceTimersByTime(201);
    expect(visualizer.anchor).toBeNull();
  });

  it('tears down the overlay on detach and stays idempotent', () => {
    const visualizer = createVisualizer();
    expect(svg()).not.toBeNull();

    visualizer.detach();
    expect(svg()).toBeNull();
    expect(visualizer.element).toBeNull();

    // Detach and destroy are safe to repeat, and later drag calls no-op.
    expect(() => visualizer.detach()).not.toThrow();
    expect(() => visualizer.destroy()).not.toThrow();
    expect(() => visualizer.start({ x: 0, y: 0 })).not.toThrow();
    expect(() => visualizer.update({ x: 10, y: 10 })).not.toThrow();
    expect(() => visualizer.release()).not.toThrow();
  });

  it('honours custom maximum length and threshold options', () => {
    const visualizer = createVisualizer({ maxLength: 100, threshold: 40 });
    expect(visualizer.maxLength).toBe(100);
    expect(visualizer.threshold).toBe(40);

    visualizer.start({ x: 0, y: 0 });
    visualizer.update({ x: 30, y: 0 });
    expect(visualizer.visible).toBe(false);

    visualizer.update({ x: 500, y: 0 });
    expect(visualizer.length).toBe(100);
    expect(visualizer.powerRatio).toBe(1);
  });

  it('ignores updates without a preceding start', () => {
    const visualizer = createVisualizer();
    expect(() => visualizer.update({ x: 100, y: 100 })).not.toThrow();
    expect(visualizer.visible).toBe(false);
    expect(visualizer.anchor).toBeNull();
  });
});

describe('ThrowVisualizer without a DOM container', () => {
  it('stays inert but safe when constructed without a container', () => {
    const visualizer = new ThrowVisualizer();

    expect(visualizer.element).toBeNull();
    expect(() => visualizer.start({ x: 0, y: 0 })).not.toThrow();
    expect(() => visualizer.update({ x: 100, y: 0 })).not.toThrow();
    // State still tracks for headless consumers.
    expect(visualizer.powerRatio).toBeGreaterThan(0);
    expect(() => visualizer.release()).not.toThrow();
    expect(() => visualizer.detach()).not.toThrow();
  });

  it('stays inert when the container cannot accept children', () => {
    const visualizer = new ThrowVisualizer({ container: {} });

    expect(visualizer.element).toBeNull();
    expect(() => visualizer.start({ x: 0, y: 0 })).not.toThrow();
    expect(() => visualizer.detach()).not.toThrow();
  });
});

describe('ThrowVisualizer wired through PointerInput', () => {
  it('mounts the overlay on attach and tracks the drag in the DOM', () => {
    const host = createFakeHost();
    const input = new PointerInput({ container });

    expect(svg()).not.toBeNull();

    input.attach(host);
    container.dispatchEvent(
      new window.MouseEvent('mousedown', { bubbles: true, clientX: 100, clientY: 100 })
    );
    container.dispatchEvent(
      new window.MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 160 })
    );

    expect(input.visualizer.visible).toBe(true);
    expect(svg().style.visibility).toBe('visible');
    expect(svg().querySelector('line').getAttribute('stroke')).toBe(
      throwColorForPower(input.visualizer.powerRatio)
    );

    container.dispatchEvent(
      new window.MouseEvent('mouseup', { bubbles: true, clientX: 100, clientY: 300 })
    );
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    input.detach();
  });

  it('removes the overlay when PointerInput detaches', () => {
    const input = new PointerInput({ container });
    input.attach(createFakeHost());
    expect(svg()).not.toBeNull();

    input.detach();
    expect(svg()).toBeNull();
    expect(input.visualizer.element).toBeNull();
  });
});
