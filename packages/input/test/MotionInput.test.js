// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { MotionInput, clamp01, lowPassVec3 } from '../src/index.js';
import { createFakeHost, createFakeTarget } from './fakes.js';

describe('motion low-pass filter', () => {
  it('converges toward the target and clamps the coefficient', () => {
    let current = { x: 0, y: 0, z: 0 };
    const target = { x: 100, y: -50, z: 0 };
    for (let i = 0; i < 200; i += 1) {
      current = lowPassVec3(current, target, 0.15);
    }
    expect(current.x).toBeCloseTo(100, 6);
    expect(current.y).toBeCloseTo(-50, 6);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('MotionInput', () => {
  it('maps orientation to gravity through the host', async () => {
    const host = createFakeHost();
    const target = createFakeTarget();
    const input = new MotionInput({
      target,
      smoothing: 1,
      watchdogMs: 0,
      gravityMagnitude: 1000
    });

    input.attach(host);
    await expect(input.enable()).resolves.toBe(true);

    target.dispatch('deviceorientation', { beta: 0, gamma: 90 });
    const gravityCalls = host.calls.filter((call) => call.method === 'setGravity');
    expect(gravityCalls).toHaveLength(1);
    // gamma 90 -> full +X gravity with smoothing 1.
    expect(gravityCalls[0].args[0]).toBeCloseTo(1000, 6);
    input.detach();
  });

  it('maps shake spikes to impulses through the host', async () => {
    const host = createFakeHost();
    const target = createFakeTarget();
    let now = 0;
    const input = new MotionInput({
      target,
      shakeSmoothing: 1,
      watchdogMs: 0,
      now: () => now
    });

    input.attach(host);
    await input.enable();
    now = 1000;
    target.dispatch('devicemotion', {
      acceleration: { x: 30, y: 0, z: 0 }
    });

    const impulses = host.calls.filter((call) => call.method === 'applyImpulse');
    expect(impulses).toHaveLength(1);
    expect(impulses[0].args[0]).toEqual(['die-1', 'die-2', 'die-3']);
    expect(impulses[0].args[1].x).toBeLessThan(0);
    input.detach();
  });

  it('emits a denied status and attaches no listeners when permission is denied', async () => {
    const host = createFakeHost();
    const target = createFakeTarget();
    const input = new MotionInput({
      target,
      watchdogMs: 0,
      requestPermission: () => 'denied'
    });
    const statuses = [];
    host.events.on('motion:status', (payload) => statuses.push(payload));

    input.attach(host);
    await expect(input.enable()).resolves.toBe(false);

    expect(input.status).toBe('denied');
    expect(input.enabled).toBe(false);
    expect(target.listenerCount()).toBe(0);
    expect(statuses.some((payload) => payload.status === 'denied')).toBe(true);
    input.detach();
  });

  it('reports unsupported without a target', async () => {
    const host = createFakeHost();
    const input = new MotionInput({ target: { isSecureContext: true }, watchdogMs: 0 });
    input.attach(host);
    await expect(input.enable()).resolves.toBe(false);
    expect(input.status).toBe('unsupported');
    input.detach();
  });

  it('removes every listener on detach', async () => {
    const host = createFakeHost();
    const target = createFakeTarget();
    const input = new MotionInput({ target, watchdogMs: 0 });

    input.attach(host);
    await input.enable();
    expect(target.listenerCount()).toBe(3);

    input.detach();
    expect(input.enabled).toBe(false);
    expect(target.listenerCount()).toBe(0);
  });
});
