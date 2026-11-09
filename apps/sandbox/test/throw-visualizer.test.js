// @ts-nocheck
// @vitest-environment happy-dom
/**
 * Integration test: the throw arrow is mounted on a real stage element,
 * tracks the drag in the DOM, clamps at maximum power, and releases while
 * the same flick drives a real engine roll — the exact wiring every app
 * (`new PointerInput({ container: stage }); engine.use(...)`) ships.
 */
import { createSeededRandom } from '@dice/core';
import { createDiceEngine } from '@dice/engine';
import {
  THROW_VISUALIZER_MAX_COLOR,
  THROW_VISUALIZER_MAX_LENGTH,
  THROW_VISUALIZER_RELEASE_MS,
  throwColorForPower
} from '@dice/input';
import { PointerInput } from '@dice/input';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** @type {HTMLElement} */
let container;

beforeEach(() => {
  container = document.createElement('div');
  container.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 1000,
    height: 600,
    right: 1000,
    bottom: 600,
    toJSON: () => {}
  });
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

/**
 * @returns {any}
 */
function svg() {
  return container.querySelector('[data-testid="throw-visualizer"]');
}

/**
 * @param {string} type
 * @param {number} x
 * @param {number} y
 */
function mouse(type, x, y) {
  container.dispatchEvent(
    new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  );
}

/**
 * Create a headless engine with a PointerInput mounted on the real stage
 * element. Roll requests are recorded at the engine boundary.
 *
 * @returns {Promise<{ engine: any, input: any, rolls: any[] }>}
 */
async function createHarness() {
  const engine = await createDiceEngine({
    headless: true,
    container: null,
    seed: 'throw-visualizer',
    viewport: {
      containerWidth: 1000,
      containerHeight: 600,
      sceneWidth: 1000,
      sceneHeight: 600,
      scale: 50,
      aspect: 1,
      wallHeight: 1000,
      pixelRatio: 1
    }
  });

  let now = 1000;
  const input = new PointerInput({
    container,
    rng: createSeededRandom('throw-visualizer'),
    now: () => now,
    dieCount: 6
  });

  /** @type {any[]} */
  const rolls = [];
  const originalRoll = engine.roll.bind(engine);
  engine.roll = (request) => {
    rolls.push(request);
    return originalRoll(request);
  };

  engine.use(input);
  return { engine, input, rolls };
}

/**
 * @param {any} engine
 */
async function settle(engine) {
  for (let i = 0; i < 100 && engine.loop.running; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('throw visualizer through a real engine (sandbox + demos wiring)', () => {
  it('mounts the arrow on the stage and tracks the drag', async () => {
    const { engine, input, rolls } = await createHarness();

    expect(svg()).not.toBeNull();
    expect(svg().style.visibility).toBe('hidden');
    expect(input.visualizer.visible).toBe(false);

    mouse('mousedown', 100, 100);
    expect(input.visualizer.anchor).toEqual({ x: 100, y: 100 });
    expect(input.visualizer.visible).toBe(false);

    // 60px drag: past the 18px threshold, the arrow appears aimed down.
    mouse('mousemove', 100, 160);
    expect(input.visualizer.visible).toBe(true);
    expect(svg().style.visibility).toBe('visible');
    expect(input.visualizer.length).toBe(60);
    expect(input.visualizer.powerRatio).toBeCloseTo(60 / THROW_VISUALIZER_MAX_LENGTH, 6);
    expect(input.visualizer.color).toBe(
      throwColorForPower(60 / THROW_VISUALIZER_MAX_LENGTH)
    );
    expect(svg().querySelector('line').getAttribute('stroke')).toBe(
      input.visualizer.color
    );
    expect(svg().querySelector('line').getAttribute('x1')).toBe('100');
    expect(svg().querySelector('line').getAttribute('y2')).toBe('160');

    // Dragging past maximum power clamps the tip along the ray and turns
    // the arrow fiery red-orange.
    mouse('mousemove', 100, 500);
    expect(input.visualizer.length).toBe(THROW_VISUALIZER_MAX_LENGTH);
    expect(input.visualizer.powerRatio).toBe(1);
    expect(input.visualizer.color).toBe(THROW_VISUALIZER_MAX_COLOR);
    expect(input.visualizer.tip).toEqual({ x: 100, y: 100 + THROW_VISUALIZER_MAX_LENGTH });

    // Release dispatches exactly one engine roll and plays the snap.
    vi.useFakeTimers();
    mouse('mouseup', 100, 500);
    expect(rolls).toHaveLength(1);
    expect(rolls[0].vectors).toHaveLength(6);
    expect(svg().classList.contains('is-releasing')).toBe(true);
    expect(svg().style.opacity).toBe('0');
    expect(input.visualizer.visible).toBe(false);

    vi.advanceTimersByTime(THROW_VISUALIZER_RELEASE_MS + 1);
    expect(svg().style.visibility).toBe('hidden');
    expect(input.visualizer.anchor).toBeNull();

    // The flick really spawned dice through the engine.
    vi.useRealTimers();
    for (let i = 0; i < 50 && engine.getDiceIds().length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    await settle(engine);
    expect(engine.getDiceIds()).toHaveLength(6);

    input.detach();
    expect(svg()).toBeNull();
    engine.cancelRoll('test-done');
    engine.destroy();
  });

  it('keeps sub-threshold drags hidden and dispatches no roll', async () => {
    const { engine, input, rolls } = await createHarness();

    mouse('mousedown', 100, 100);
    mouse('mousemove', 100, 105);
    expect(input.visualizer.visible).toBe(false);
    expect(svg().style.visibility).toBe('hidden');

    mouse('mouseup', 100, 105);
    expect(rolls).toHaveLength(0);
    expect(input.visualizer.anchor).toBeNull();
    expect(engine.getDiceIds()).toHaveLength(0);

    input.detach();
    engine.destroy();
  });
});
