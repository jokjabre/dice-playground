// @ts-nocheck
import { createSeededRandom } from '@dice/core';
import { describe, expect, it, vi } from 'vitest';

import {
  THROW_STRENGTH,
  THROW_VISUALIZER_THRESHOLD,
  CONTINUOUS_UPWARD_VELOCITY_RATIO,
  DEFAULT_DIE_MASS,
  PointerInput,
  gestureBoost
} from '../src/index.js';
import {
  createFakeContainer,
  createFakeHost,
  createFakeTarget,
  mouseEvent
} from './fakes.js';

describe('PointerInput', () => {
  it('emits throw vectors for a swipe through the host', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    const rolls = host.calls.filter((call) => call.method === 'roll');
    expect(rolls).toHaveLength(1);
    const request = rolls[0].args[0];
    expect(request.vectors).toHaveLength(3);
    expect(request.dice).toBe(3);
    expect(request.vectors[0].velocity.z).toBeGreaterThan(0);

    const metrics = host.calls.filter((call) => call.method === 'getMetrics');
    const profiles = host.calls.filter((call) => call.method === 'getSpawnProfile');
    expect(metrics).toHaveLength(1);
    expect(profiles).toHaveLength(1);
    input.detach();
  });

  it('passes cancelActive only when interruptRolls is set', () => {
    let now = 1000;
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-interrupt'),
      now: () => now
    });
    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    let request = host.calls.filter((call) => call.method === 'roll')[0].args[0];
    expect(request.cancelActive).toBe(false);

    input.interruptRolls = true;
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    request = host.calls.filter((call) => call.method === 'roll')[1].args[0];
    expect(request.cancelActive).toBe(true);
    input.detach();
  });

  it('merges rollRequest extras into standard-mode rolls', () => {
    let now = 1000;
    const host = createFakeHost();
    const container = createFakeContainer();
    const faceMappings = [
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6]
    ];
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-extras'),
      now: () => now,
      rollRequest: () => ({ faceMappings, dice: 99, vectors: [] })
    });
    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    const rolls = host.calls.filter((call) => call.method === 'roll');
    expect(rolls).toHaveLength(1);
    const request = rolls[0].args[0];
    // App extras ride along ...
    expect(request.faceMappings).toBe(faceMappings);
    // ... but the flick always spawns its own vectors, count, and policy.
    expect(request.dice).toBe(3);
    expect(request.vectors).toHaveLength(3);
    expect(request.cancelActive).toBe(false);
    input.detach();
  });

  it('ignores rollRequest in continuous mode', () => {
    let now = 1000;
    let called = false;
    const host = createFakeHost({ mode: 'continuous' });
    const container = createFakeContainer();
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-extras-continuous'),
      now: () => now,
      rollRequest: () => {
        called = true;
        return { faceMappings: [] };
      }
    });
    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    expect(host.calls.filter((call) => call.method === 'applyImpulse')).toHaveLength(3);
    expect(called).toBe(false);
    input.detach();
  });

  it('ignores sub-threshold moves', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({ container });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(101, 101));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    input.detach();
  });

  it('uses the configured die count when there are no live dice', () => {
    const host = createFakeHost({ diceIds: [] });
    const container = createFakeContainer();
    const input = new PointerInput({
      container,
      dieCount: 5,
      rng: createSeededRandom('count')
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(0, 0));
    container.dispatch('mouseup', mouseEvent(0, 200));

    const rolls = host.calls.filter((call) => call.method === 'roll');
    expect(rolls).toHaveLength(1);
    expect(rolls[0].args[0].vectors).toHaveLength(5);
    input.detach();
  });

  it('completes a swipe whose release happens outside the container', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const fakeWindow = createFakeTarget();
    container.ownerDocument = { defaultView: fakeWindow };
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-window'),
      now: () => now
    });

    input.attach(host);
    expect(fakeWindow.listenerCount('mouseup')).toBe(1);
    expect(fakeWindow.listenerCount('touchend')).toBe(1);
    expect(fakeWindow.listenerCount('mousemove')).toBe(1);
    expect(fakeWindow.listenerCount('touchmove')).toBe(1);

    container.dispatch('mousedown', mouseEvent(100, 100));
    // The pointer leaves the container mid-gesture ...
    container.dispatch('mouseleave', mouseEvent(100, 100));
    // ... and the release lands on the window instead.
    now += 200;
    fakeWindow.dispatch('mouseup', mouseEvent(400, 100));

    const rolls = host.calls.filter((call) => call.method === 'roll');
    expect(rolls).toHaveLength(1);
    expect(rolls[0].args[0].vectors.length).toBeGreaterThan(0);

    input.detach();
    expect(fakeWindow.listenerCount()).toBe(0);
  });

  it('does not cancel the gesture when the pointer leaves the container', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-leave'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseleave', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    input.detach();
  });

  it('removes every listener on detach', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({ container });

    input.attach(host);
    expect(input.enabled).toBe(true);
    expect(container.listenerCount()).toBe(7);

    input.detach();
    expect(input.enabled).toBe(false);
    expect(container.listenerCount()).toBe(0);
  });

  it('applies per-die impulses in continuous mode without rolling', () => {
    const host = createFakeHost({ mode: 'continuous' });
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      // A configured count must not invent dice in continuous mode: the
      // impulses go to the live dice only.
      dieCount: 5,
      rng: createSeededRandom('pointer-continuous'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    // Swipe down the screen: scene direction is -Y (screen Y is flipped).
    container.dispatch('mouseup', mouseEvent(100, 300));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    // No respawn path is consulted in continuous mode.
    expect(host.calls.filter((call) => call.method === 'getSpawnProfile')).toHaveLength(0);

    const impulses = host.calls.filter((call) => call.method === 'applyImpulse');
    expect(impulses).toHaveLength(3);
    // Across all dice: every live die receives exactly one impulse.
    expect(impulses.map((call) => call.args[0])).toEqual([
      ['die-1'],
      ['die-2'],
      ['die-3']
    ]);

    const magnitudes = new Set();
    const directions = new Set();
    for (const call of impulses) {
      const impulse = call.args[1];
      // Projected pointer-down point shared by every impulse. The fake
      // container rect is 200x200 and the press lands at its centre, so the
      // horizontal projection is the world origin at the default throw
      // height (no enclosure profile is consulted in continuous mode).
      expect(call.args[2]).toEqual({ x: 0, y: 0, z: 300 });
      expect(Number.isFinite(impulse.x)).toBe(true);
      expect(Number.isFinite(impulse.y)).toBe(true);
      expect(Number.isFinite(impulse.z)).toBe(true);
      // Directional impulse along the swipe with a steep upward pop.
      expect(impulse.y).toBeLessThan(0);
      expect(impulse.z).toBeGreaterThan(0);
      expect(impulse.z).toBeCloseTo(
        Math.hypot(impulse.x, impulse.y) * CONTINUOUS_UPWARD_VELOCITY_RATIO,
        6
      );
      // Mass-scaled and strength-multiplied: impulse / mass is the
      // intended Δv (boost x strength), not boost / mass. An unscaled
      // impulse would move a mass-300 die by only ~1 unit.
      const boost = gestureBoost(200, 200);
      const deltaV = Math.hypot(impulse.x, impulse.y) / DEFAULT_DIE_MASS;
      const expectedDeltaV = boost * THROW_STRENGTH;
      expect(deltaV).toBeGreaterThanOrEqual(expectedDeltaV * 0.85);
      expect(deltaV).toBeLessThanOrEqual(expectedDeltaV * 1.15);
      expect(deltaV).toBeGreaterThan(500);
      magnitudes.add(Number(Math.hypot(impulse.x, impulse.y, impulse.z).toFixed(6)));
      directions.add(Number(Math.atan2(impulse.x, impulse.y).toFixed(6)));
    }
    // Varied directions and magnitudes per die (randomized torque/tumble).
    expect(magnitudes.size).toBeGreaterThan(1);
    expect(directions.size).toBeGreaterThan(1);
    input.detach();
  });

  it('still rolls (and never impulses) in standard mode', () => {
    const host = createFakeHost({ mode: 'standard' });
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-standard'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    expect(host.calls.filter((call) => call.method === 'applyImpulse')).toHaveLength(0);
    input.detach();
  });

  it('scales continuous impulses by the configured dieMass', () => {
    const run = (/** @type {Record<string, any>} */ options) => {
      const host = createFakeHost({ mode: 'continuous' });
      const container = createFakeContainer();
      let now = 1000;
      const input = new PointerInput({
        container,
        rng: createSeededRandom('pointer-die-mass'),
        now: () => now,
        ...options
      });
      input.attach(host);
      container.dispatch('mousedown', mouseEvent(100, 100));
      now += 200;
      container.dispatch('mouseup', mouseEvent(100, 300));
      input.detach();
      return host.calls
        .filter((call) => call.method === 'applyImpulse')
        .map((call) => call.args[1]);
    };

    const defaultImpulses = run({});
    const lightImpulses = run({ dieMass: 100 });
    expect(lightImpulses).toHaveLength(defaultImpulses.length);
    // Same seed, so the only difference is the mass scale (300 -> 100).
    lightImpulses.forEach((impulse, index) => {
      expect(impulse.x).toBeCloseTo(defaultImpulses[index].x / 3, 6);
      expect(impulse.y).toBeCloseTo(defaultImpulses[index].y / 3, 6);
      expect(impulse.z).toBeCloseTo(defaultImpulses[index].z / 3, 6);
    });
  });

  it('honours the unified throw-strength setting in continuous mode', () => {
    const run = (/** @type {Record<string, any>} */ options) => {
      const host = createFakeHost({ mode: 'continuous' });
      const container = createFakeContainer();
      let now = 1000;
      const input = new PointerInput({
        container,
        rng: createSeededRandom('pointer-continuous-tune'),
        now: () => now,
        ...options
      });
      input.attach(host);
      container.dispatch('mousedown', mouseEvent(100, 100));
      now += 200;
      container.dispatch('mouseup', mouseEvent(100, 300));
      input.detach();
      return host.calls
        .filter((call) => call.method === 'applyImpulse')
        .map((call) => call.args[1]);
    };

    const [defaultImpulse] = run({});
    const [strongImpulse] = run({ throwStrength: 6 });
    // Double the default strength (3 -> 6), same seed: double the impulse.
    expect(strongImpulse.x).toBeCloseTo(defaultImpulse.x * 2, 6);
    expect(strongImpulse.z).toBeCloseTo(defaultImpulse.z * 2, 6);

    const [steepImpulse] = run({ continuousUpwardRatio: 3 });
    // Same horizontal impulse, double the upward ratio (1.5 -> 3).
    expect(steepImpulse.x).toBeCloseTo(defaultImpulse.x, 6);
    expect(steepImpulse.z).toBeCloseTo(defaultImpulse.z * 2, 6);
  });

  it('applies the same throw-strength setting to standard throws', () => {
    const run = (/** @type {Record<string, any>} */ options) => {
      const host = createFakeHost({ mode: 'standard' });
      const container = createFakeContainer();
      let now = 1000;
      const input = new PointerInput({
        container,
        rng: createSeededRandom('pointer-standard-strength'),
        now: () => now,
        ...options
      });
      input.attach(host);
      container.dispatch('mousedown', mouseEvent(100, 100));
      now += 200;
      container.dispatch('mouseup', mouseEvent(100, 300));
      input.detach();
      const rolls = host.calls.filter((call) => call.method === 'roll');
      expect(rolls).toHaveLength(1);
      return rolls[0].args[0].vectors;
    };

    const defaultVectors = run({});
    const strongVectors = run({ throwStrength: 6 });
    // Same seed: doubling the one throw-strength setting doubles every
    // standard-throw velocity component, exactly as in continuous mode.
    expect(strongVectors).toHaveLength(defaultVectors.length);
    strongVectors.forEach((vector, index) => {
      expect(vector.velocity.x).toBeCloseTo(defaultVectors[index].velocity.x * 2, 6);
      expect(vector.velocity.y).toBeCloseTo(defaultVectors[index].velocity.y * 2, 6);
      expect(vector.velocity.z).toBeCloseTo(defaultVectors[index].velocity.z * 2, 6);
    });
  });

  it('reads the host mode live so a switch after attach takes effect', () => {
    const host = createFakeHost({ mode: 'standard' });
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-live-mode'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    expect(host.calls.filter((call) => call.method === 'applyImpulse')).toHaveLength(0);

    host.mode = 'continuous';
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    expect(
      host.calls.filter((call) => call.method === 'applyImpulse')
    ).toHaveLength(3);
    input.detach();
  });

  it('does nothing in continuous mode when there are no live dice', () => {
    const host = createFakeHost({ mode: 'continuous', diceIds: [] });
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      dieCount: 5,
      rng: createSeededRandom('pointer-continuous-empty'),
      now: () => now
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));

    // In particular it must not fall back to a respawning roll.
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    expect(host.calls.filter((call) => call.method === 'applyImpulse')).toHaveLength(0);
    input.detach();
  });

  it('ignores sub-threshold moves in continuous mode', () => {
    const host = createFakeHost({ mode: 'continuous' });
    const container = createFakeContainer();
    const input = new PointerInput({ container });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(101, 101));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    expect(host.calls.filter((call) => call.method === 'applyImpulse')).toHaveLength(0);
    input.detach();
  });

  it('throws for drags past the 18px threshold even below the legacy swipe distance', () => {
    // A 30px flick is well below minSwipeThreshold for a 1000x600 scene
    // (~77px) but past the 18px visual threshold, so it now dispatches.
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({ container, now: () => now });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 130));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    input.detach();
  });

  it('cancels throws shorter than the 18px threshold', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({ container });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(100, 100 + THROW_VISUALIZER_THRESHOLD - 1));

    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);
    input.detach();
  });

  it('spawns dice around the projected pointer-down point', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-projection'),
      now: () => now
    });

    input.attach(host);
    // The fake container rect is 200x200, so a press at (150, 50) projects
    // to NDC (0.5, 0.5): scene (250, 150) on a 1000x600 scene.
    container.dispatch('mousedown', mouseEvent(150, 50));
    now += 200;
    container.dispatch('mouseup', mouseEvent(150, 250));

    const rolls = host.calls.filter((call) => call.method === 'roll');
    expect(rolls).toHaveLength(1);
    const vectors = rolls[0].args[0].vectors;
    expect(vectors.length).toBeGreaterThan(0);
    for (const vector of vectors) {
      // Every die spawns at the shared throw height near the projection.
      expect(vector.pos.z).toBe(300);
      expect(Math.hypot(vector.pos.x - 250, vector.pos.y - 150)).toBeLessThan(400);
    }
    input.detach();
  });

  it('drives the throw visualizer through down, move, up, and cancel', () => {
    vi.useFakeTimers();
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      rng: createSeededRandom('pointer-visualizer'),
      now: () => now
    });

    expect(input.visualizer).not.toBeNull();
    const visualizer = input.visualizer;

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    expect(visualizer.anchor).not.toBeNull();
    // Sub-threshold: the arrow stays hidden.
    container.dispatch('mousemove', mouseEvent(100, 110));
    expect(visualizer.visible).toBe(false);

    container.dispatch('mousemove', mouseEvent(100, 160));
    expect(visualizer.visible).toBe(true);
    expect(visualizer.length).toBeCloseTo(60, 6);
    expect(visualizer.powerRatio).toBeCloseTo(60 / visualizer.maxLength, 6);

    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    // Release starts the fade + scale snap; the arrow is no longer live.
    expect(visualizer.visible).toBe(false);
    vi.advanceTimersByTime(201);
    expect(visualizer.anchor).toBeNull();

    // A cancelled gesture hides the arrow and produces no roll.
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mousemove', mouseEvent(100, 160));
    expect(visualizer.visible).toBe(true);
    container.dispatch('touchcancel', mouseEvent(100, 160));
    expect(visualizer.visible).toBe(false);
    expect(visualizer.anchor).toBeNull();
    container.dispatch('mouseup', mouseEvent(100, 300));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);

    vi.useRealTimers();
    input.detach();
  });

  it('keeps tracking the arrow when the pointer moves on the window', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const fakeWindow = createFakeTarget();
    container.ownerDocument = { defaultView: fakeWindow };
    const input = new PointerInput({ container });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    fakeWindow.dispatch('mousemove', mouseEvent(100, 160));
    expect(input.visualizer.visible).toBe(true);
    input.detach();
  });

  it('honours an explicit visualizer threshold for both arrow and dispatch', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({
      container,
      visualizer: { threshold: 40 }
    });

    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mousemove', mouseEvent(100, 130));
    expect(input.visualizer.visible).toBe(false);
    container.dispatch('mouseup', mouseEvent(100, 130));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);

    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(100, 150));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    input.detach();
  });

  it('works without a visualizer overlay when disabled', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    let now = 1000;
    const input = new PointerInput({
      container,
      visualizer: false,
      rng: createSeededRandom('pointer-no-visualizer'),
      now: () => now
    });

    expect(input.visualizer).toBeNull();
    input.attach(host);
    container.dispatch('mousedown', mouseEvent(100, 100));
    container.dispatch('mouseup', mouseEvent(100, 117));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(0);

    container.dispatch('mousedown', mouseEvent(100, 100));
    now += 200;
    container.dispatch('mouseup', mouseEvent(100, 300));
    expect(host.calls.filter((call) => call.method === 'roll')).toHaveLength(1);
    input.detach();
  });

  it('produces deterministic continuous impulses for a fixed seed', () => {
    const run = () => {
      const host = createFakeHost({ mode: 'continuous' });
      const container = createFakeContainer();
      let now = 1000;
      const input = new PointerInput({
        container,
        rng: createSeededRandom('pointer-continuous-det'),
        now: () => now
      });
      input.attach(host);
      container.dispatch('mousedown', mouseEvent(100, 100));
      now += 200;
      container.dispatch('mouseup', mouseEvent(100, 300));
      input.detach();
      return host.calls
        .filter((call) => call.method === 'applyImpulse')
        .map((call) => call.args[1]);
    };

    const first = run();
    const second = run();
    expect(first).toHaveLength(3);
    expect(second).toEqual(first);
  });
});
