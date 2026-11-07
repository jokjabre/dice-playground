// @ts-nocheck
import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { PointerInput } from '../src/index.js';
import { createFakeContainer, createFakeHost, mouseEvent } from './fakes.js';

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
    expect(request.vectors[0].velocity.z).toBe(-10);

    const metrics = host.calls.filter((call) => call.method === 'getMetrics');
    const profiles = host.calls.filter((call) => call.method === 'getSpawnProfile');
    expect(metrics).toHaveLength(1);
    expect(profiles).toHaveLength(1);
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

  it('removes every listener on detach', () => {
    const host = createFakeHost();
    const container = createFakeContainer();
    const input = new PointerInput({ container });

    input.attach(host);
    expect(input.enabled).toBe(true);
    expect(container.listenerCount()).toBe(6);

    input.detach();
    expect(input.enabled).toBe(false);
    expect(container.listenerCount()).toBe(0);
  });
});
