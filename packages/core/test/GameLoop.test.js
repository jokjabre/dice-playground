import { describe, expect, it, vi } from 'vitest';

import {
  ContinuousMotionStrategy,
  EVENTS,
  EventBus,
  GameLoop,
  ManualScheduler,
  ManualStepStrategy,
  StandardRollStrategy
} from '../src/index.js';

class FakeScheduler {
  /**
   * @param {number} [time]
   */
  constructor(time = 0) {
    this.time = time;
    /** @type {((time: number) => void)|null} */
    this.callback = null;
    this.nextId = 1;
    /** @type {number[]} */
    this.cancelled = [];
  }

  now() {
    return this.time;
  }

  /**
   * @param {(time: number) => void} callback
   */
  requestFrame(callback) {
    this.callback = callback;
    return this.nextId++;
  }

  /**
   * @param {number} id
   */
  cancelFrame(id) {
    this.cancelled.push(id);
    this.callback = null;
  }

  /**
   * @param {number} milliseconds
   */
  advance(milliseconds) {
    this.time += milliseconds;
  }

  /**
   * @param {number} [time]
   */
  frame(time = this.time) {
    const callback = this.callback;
    this.callback = null;
    if (callback) callback(time);
  }
}

/**
 * @param {boolean} settled
 * @returns {import('../src/contracts.js').WorldContract}
 */
function createWorld(settled) {
  return {
    areDiceSettled: () => settled,
    getValues: () => [1, 2, 3],
    getDice: () => []
  };
}

describe('GameLoop', () => {
  it('advances fixed steps from scheduler time', () => {
    const scheduler = new FakeScheduler();
    /** @type {number[]} */
    const deltas = [];
    const loop = new GameLoop({
      step: (dt) => deltas.push(dt),
      world: createWorld(false),
      scheduler,
      fixedStep: 0.1,
      maxSubSteps: 4,
      maxFrameGap: 1
    });

    loop.start(new ContinuousMotionStrategy());
    scheduler.advance(250);
    scheduler.frame();

    expect(deltas).toHaveLength(2);
    expect(deltas[0]).toBeCloseTo(0.1);
    expect(deltas[1]).toBeCloseTo(0.1);
    expect(loop.iteration).toBe(2);

    loop.stop();
  });

  it('caps sub-steps and drops excess backlog', () => {
    const scheduler = new FakeScheduler();
    /** @type {number[]} */
    const deltas = [];
    const loop = new GameLoop({
      step: (dt) => deltas.push(dt),
      world: createWorld(false),
      scheduler,
      fixedStep: 0.1,
      maxSubSteps: 4,
      maxFrameGap: 10
    });

    loop.start(new ContinuousMotionStrategy());
    scheduler.advance(2000);
    scheduler.frame();

    expect(deltas).toHaveLength(4);
    expect(loop.accumulator).toBeLessThan(loop.fixedStep);

    loop.stop();
  });

  it('settles through StandardRollStrategy without emitting roll:settle', () => {
    const scheduler = new FakeScheduler();
    const bus = new EventBus();
    const settled = vi.fn();
    const stopped = vi.fn();

    bus.on(EVENTS.ROLL_SETTLE, settled);
    bus.on(EVENTS.LOOP_STOP, stopped);

    const loop = new GameLoop({
      step: () => {},
      world: createWorld(true),
      scheduler,
      eventBus: bus,
      fixedStep: 0.1,
      maxSubSteps: 4
    });

    loop.start(new StandardRollStrategy({ minFramesBeforeCheck: 0 }));
    scheduler.advance(100);
    scheduler.frame();

    expect(loop.running).toBe(false);
    expect(loop.iteration).toBe(1);
    expect(settled).not.toHaveBeenCalled();
    expect(stopped).toHaveBeenCalledWith({ runId: 1, reason: 'settled' });
  });

  it('never auto-stops with ContinuousMotionStrategy', () => {
    const scheduler = new FakeScheduler();
    const loop = new GameLoop({
      step: () => {},
      world: createWorld(true),
      scheduler,
      fixedStep: 0.1,
      maxSubSteps: 4
    });

    loop.start(new ContinuousMotionStrategy());

    for (let i = 0; i < 5; i += 1) {
      scheduler.advance(100);
      scheduler.frame();
    }

    expect(loop.running).toBe(true);
    expect(loop.iteration).toBe(5);

    loop.stop();
  });

  it('supports manual stepping with ManualScheduler', () => {
    const scheduler = new ManualScheduler();
    const loop = new GameLoop({
      step: () => {},
      world: createWorld(false),
      scheduler,
      fixedStep: 0.05
    });

    loop.start(new ManualStepStrategy());
    loop.step();
    loop.step(0.05);

    expect(loop.iteration).toBe(2);
    expect(loop.running).toBe(true);

    loop.stop();
  });

  it('pauses, resumes, and stops with loop events', () => {
    const scheduler = new FakeScheduler();
    const bus = new EventBus();
    /** @type {Array<[string, any]>} */
    const events = [];

    bus.on(EVENTS.LOOP_START, (payload) => events.push(['start', payload]));
    bus.on(EVENTS.LOOP_PAUSE, (payload) => events.push(['pause', payload]));
    bus.on(EVENTS.LOOP_RESUME, (payload) => events.push(['resume', payload]));
    bus.on(EVENTS.LOOP_STOP, (payload) => events.push(['stop', payload]));

    const loop = new GameLoop({
      step: () => {},
      world: createWorld(false),
      scheduler,
      eventBus: bus
    });

    loop.start(new ContinuousMotionStrategy());
    loop.pause();
    loop.resume();
    loop.stop('test');

    expect(events.map(([name]) => name)).toEqual([
      'start',
      'pause',
      'resume',
      'stop'
    ]);
    expect(events[3][1]).toEqual({ runId: 1, reason: 'test' });
  });

  it('clamps large frame gaps', () => {
    const scheduler = new FakeScheduler();
    /** @type {number[]} */
    const deltas = [];
    const loop = new GameLoop({
      step: (dt) => deltas.push(dt),
      world: createWorld(false),
      scheduler,
      fixedStep: 0.1,
      maxSubSteps: 10,
      maxFrameGap: 0.25
    });

    loop.start(new ContinuousMotionStrategy());
    scheduler.advance(5000);
    scheduler.frame();

    expect(deltas).toHaveLength(2);
    expect(deltas.reduce((sum, dt) => sum + dt, 0)).toBeCloseTo(0.2);

    loop.stop();
  });
});
