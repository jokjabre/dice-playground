// @ts-nocheck
import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { PointerInput } from '../src/index.js';
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
    expect(container.listenerCount()).toBe(5);

    input.detach();
    expect(input.enabled).toBe(false);
    expect(container.listenerCount()).toBe(0);
  });
});
