import { describe, expect, it, vi } from 'vitest';

import { EVENTS, EventBus } from '../src/index.js';

describe('EventBus', () => {
  it('subscribes, emits, and returns an unsubscribe function', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const unsubscribe = bus.on(EVENTS.ROLL_START, handler);
    bus.emit(EVENTS.ROLL_START, { rollId: 'roll-1', request: {} });
    unsubscribe();
    bus.emit(EVENTS.ROLL_START, { rollId: 'roll-2', request: {} });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ rollId: 'roll-1', request: {} });
  });

  it('supports off and once subscriptions', () => {
    const bus = new EventBus();
    const offHandler = vi.fn();
    const onceHandler = vi.fn();

    bus.on(EVENTS.TICK, offHandler);
    bus.off(EVENTS.TICK, offHandler);
    bus.once(EVENTS.TICK, onceHandler);

    bus.emit(EVENTS.TICK, { iteration: 1, dt: 0.016, elapsed: 0.016 });
    bus.emit(EVENTS.TICK, { iteration: 2, dt: 0.016, elapsed: 0.032 });

    expect(offHandler).not.toHaveBeenCalled();
    expect(onceHandler).toHaveBeenCalledTimes(1);
    expect(onceHandler).toHaveBeenCalledWith({
      iteration: 1,
      dt: 0.016,
      elapsed: 0.016
    });
  });

  it('isolates listener errors and reports them through engine:error', () => {
    const bus = new EventBus();
    const second = vi.fn();
    /** @type {import('../src/contracts.js').EngineErrorPayload[]} */
    const errors = [];

    bus.on(EVENTS.ROLL_CANCEL, () => {
      throw new Error('boom');
    });
    bus.on(EVENTS.ROLL_CANCEL, second);
    bus.on(EVENTS.ENGINE_ERROR, (payload) => {
      errors.push(payload);
    });

    expect(() => {
      bus.emit(EVENTS.ROLL_CANCEL, { rollId: 'roll-1', reason: 'test' });
    }).not.toThrow();

    expect(second).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].scope).toBe('event:roll:cancel');
    expect(errors[0].error.message).toBe('boom');
  });

  it('swallows errors thrown by engine:error listeners', () => {
    const bus = new EventBus();

    bus.on(EVENTS.ENGINE_ERROR, () => {
      throw new Error('error listener failed');
    });

    expect(() => {
      bus.emit(EVENTS.ENGINE_ERROR, {
        scope: 'test',
        error: new Error('original')
      });
    }).not.toThrow();
  });

  it('clears one event or every listener', () => {
    const bus = new EventBus();
    const tick = vi.fn();
    const start = vi.fn();

    bus.on(EVENTS.TICK, tick);
    bus.on(EVENTS.LOOP_START, start);

    bus.clear(EVENTS.TICK);
    bus.emit(EVENTS.TICK, { iteration: 1, dt: 0.016, elapsed: 0.016 });
    bus.emit(EVENTS.LOOP_START, { runId: 1, mode: 'standard' });

    expect(tick).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledTimes(1);

    bus.clear();
    bus.emit(EVENTS.LOOP_START, { runId: 2, mode: 'standard' });
    expect(start).toHaveBeenCalledTimes(1);
  });
});
