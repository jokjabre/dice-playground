import { describe, expect, it } from 'vitest';

import * as core from '../src/index.js';

describe('@dice/core public entry', () => {
  it('exports the public primitives from one entry point', () => {
    expect(typeof core.EventBus).toBe('function');
    expect(typeof core.GameLoop).toBe('function');
    expect(typeof core.ManualScheduler).toBe('function');
    expect(typeof core.StandardRollStrategy).toBe('function');
    expect(typeof core.ContinuousMotionStrategy).toBe('function');
    expect(typeof core.ManualStepStrategy).toBe('function');
    expect(typeof core.RandomSource).toBe('function');
    expect(typeof core.createSeededRandom).toBe('function');
    expect(typeof core.createBrowserRandom).toBe('function');
    expect(typeof core.mergeConfig).toBe('function');
    expect(typeof core.computeViewportMetrics).toBe('function');
    expect(typeof core.vec3.add).toBe('function');
    expect(typeof core.quat.multiply).toBe('function');
    expect(core.EVENTS.ROLL_SETTLE).toBe('roll:settle');
  });

  it('imports without browser animation globals', () => {
    expect(typeof globalThis.requestAnimationFrame).not.toBe('function');
  });
});
