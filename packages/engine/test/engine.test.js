// @ts-nocheck
import { EVENTS, ManualScheduler } from '@dice/core';
import { describe, expect, it } from 'vitest';

import {
  BrowserScheduler,
  DiceEngine,
  RollCancelledError,
  createDiceEngine
} from '../src/index.js';
import { createFakeRenderer, metrics } from './fakes.js';

/**
 * @param {Record<string, any>} [overrides]
 * @returns {Promise<DiceEngine>}
 */
async function createHeadlessEngine(overrides = {}) {
  return createDiceEngine({
    headless: true,
    container: null,
    seed: 'engine-test',
    viewport: { ...metrics },
    ...overrides
  });
}

describe('headless engine rolls', () => {
  it('creates a headless engine with a ManualScheduler and rolls to a RollResult', async () => {
    const engine = await createHeadlessEngine();
    expect(engine.scheduler).toBeInstanceOf(ManualScheduler);
    expect(typeof globalThis.requestAnimationFrame).toBe('undefined');

    const settles = [];
    engine.events.on(EVENTS.ROLL_SETTLE, (payload) => settles.push(payload));

    const result = await engine.roll({ dice: 2, seed: 'roll-seed' });
    expect(result.values).toHaveLength(2);
    expect(result.total).toBe(result.values.reduce((a, b) => a + b, 0));
    expect(result.dice).toHaveLength(2);
    expect(result.seed).toBe('roll-seed');
    expect(result.request).toBeDefined();
    for (const value of result.values) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }

    // Exactly one public settle per roll, with the canonical payload.
    expect(settles).toHaveLength(1);
    expect(settles[0].rollId).toBe(result.id);
    expect(settles[0].result).toEqual(result);

    engine.destroy();
  });

  it('emits roll:start once and roll:settle exactly once per roll', async () => {
    const engine = await createHeadlessEngine();
    const starts = [];
    const settles = [];
    engine.events.on(EVENTS.ROLL_START, (payload) => starts.push(payload));
    engine.events.on(EVENTS.ROLL_SETTLE, (payload) => settles.push(payload));

    await engine.roll({ dice: 1, seed: 'one' });
    await engine.roll({ dice: 1, seed: 'two' });

    expect(starts).toHaveLength(2);
    expect(settles).toHaveLength(2);
    expect(starts[0].rollId).not.toBe(starts[1].rollId);

    engine.destroy();
  });

  it('rejects a second roll while one is active unless cancelActive is set', async () => {
    const engine = await createHeadlessEngine();
    // Continuous mode leaves the roll pending, so it stays "active".
    const first = engine.roll({ dice: 1, mode: 'continuous', seed: 'c1' });
    first.catch(() => {});

    await expect(engine.roll({ dice: 1, seed: 'c2' })).rejects.toMatchObject({
      name: 'RollInProgressError'
    });

    // cancelActive replaces the first roll: it rejects, the new one runs.
    const third = engine.roll({
      dice: 1,
      mode: 'continuous',
      seed: 'c3',
      cancelActive: true
    });
    third.catch(() => {});
    await expect(first).rejects.toBeInstanceOf(RollCancelledError);

    engine.cancelRoll('test-done');
    await expect(third).rejects.toBeInstanceOf(RollCancelledError);
    engine.destroy();
  });

  it('cancelRoll rejects the pending roll with RollCancelledError', async () => {
    const engine = await createHeadlessEngine();
    const cancels = [];
    engine.events.on(EVENTS.ROLL_CANCEL, (payload) => cancels.push(payload));

    const pending = engine.roll({ dice: 1, mode: 'continuous', seed: 'cancel-me' });
    engine.cancelRoll('test-cancel');

    await expect(pending).rejects.toMatchObject({ name: 'RollCancelledError' });
    expect(cancels).toHaveLength(1);
    engine.destroy();
  });

  it('rejects requested values without a mapping plugin', async () => {
    const engine = await createHeadlessEngine();
    await expect(engine.roll({ dice: 2, values: [6, 6] })).rejects.toMatchObject({
      name: 'UnsupportedRollOptionError'
    });
    engine.destroy();
  });

  it('simulate runs an isolated one-shot and never touches the live world', async () => {
    const engine = await createHeadlessEngine();
    const events = [];
    engine.events.on(EVENTS.ROLL_SETTLE, (payload) => events.push(payload));
    engine.events.on(EVENTS.ROLL_START, (payload) => events.push(payload));

    await engine.roll({ dice: 2, seed: 'live' });
    const liveIds = engine.world.getDiceIds();
    events.length = 0;

    const result = await engine.simulate({ dice: 3, seed: 'sim' });
    expect(result.values).toHaveLength(3);
    expect(events).toEqual([]);
    expect(engine.world.getDiceIds()).toEqual(liveIds);

    engine.destroy();
  });
});

describe('plugins', () => {
  it('attaches and detaches plugins and awaits async prepareRoll hooks', async () => {
    const engine = await createHeadlessEngine();
    const calls = [];
    const plugin = {
      id: 'recorder',
      attach(host) {
        calls.push(['attach', host === engine, typeof host.roll]);
      },
      detach() {
        calls.push(['detach']);
      },
      async prepareRoll(request) {
        calls.push(['prepareRoll', request.dice]);
        await Promise.resolve();
        return { request: { ...request, tagged: true } };
      },
      afterRoll(result) {
        calls.push(['afterRoll', result.values.length]);
      }
    };

    engine.use(plugin);
    expect(calls[0]).toEqual(['attach', true, 'function']);

    const result = await engine.roll({ dice: 1, seed: 'plugin' });
    expect(calls).toContainEqual(['prepareRoll', 1]);
    expect(calls).toContainEqual(['afterRoll', 1]);
    expect(result.request.tagged).toBe(true);

    engine.unuse('recorder');
    expect(calls).toContainEqual(['detach']);

    engine.destroy();
  });

  it('merges determinism-style face mappings into the world spawn request', async () => {
    const engine = await createHeadlessEngine();
    const mapping = [6, 5, 4, 3, 2, 1];
    engine.use({
      id: 'fake-determinism',
      attach() {},
      async prepareRoll(request) {
        return { request, faceMappings: [mapping, mapping] };
      }
    });

    const result = await engine.roll({ dice: 2, values: [6, 6], seed: 'mapped' });
    expect(result.request.faceMappings).toEqual([mapping, mapping]);
    expect(result.values).toHaveLength(2);

    engine.destroy();
  });

  it('rejects duplicate plugin ids', async () => {
    const engine = await createHeadlessEngine();
    const plugin = { id: 'dup', attach() {} };
    engine.use(plugin);
    expect(() => engine.use(plugin)).toThrow();
    engine.destroy();
  });
});

describe('lifecycle and configuration', () => {
  it('supports start, pause, resume, and stop', async () => {
    const engine = await createHeadlessEngine();
    engine.start();
    engine.pause();
    engine.resume();
    engine.stop();
    engine.stop();
    engine.destroy();
  });

  it('applies mode, enclosure, camera, dice, settle, and loop config', async () => {
    const engine = await createHeadlessEngine();

    engine.setMode('continuous');
    expect(engine.mode).toBe('continuous');
    engine.setMode('standard');

    engine.setEnclosure('sphere');
    expect(engine.world.enclosureId).toBe('sphere');
    engine.setEnclosure('box');

    engine.setEnclosure('sphere');
    engine.setEnclosureScale(1.5);
    // Headless test metrics are 1000x600, so the sphere default radius is 900.
    expect(engine.world.enclosure.radius).toBeCloseTo(1350, 10);
    engine.setEnclosure('box');
    engine.setEnclosureScale(1);

    engine.setCamera({ distance: 2, near: 1, far: 0 });
    engine.resetCamera();

    engine.setDiceConfig({ count: 3 });
    expect(engine.world.getConfig().diceCount).toBe(3);

    const settle = engine.setSettleConfig({ velocityThreshold: 4 });
    expect(settle.velocityThreshold).toBe(4);

    engine.setLoopConfig({ fixedStep: 1 / 30, maxSubSteps: 2 });
    expect(engine.loop.fixedStep).toBeCloseTo(1 / 30);

    const result = await engine.roll({ seed: 'configured' });
    expect(result.values).toHaveLength(3);

    engine.clear();
    expect(engine.world.getDiceIds()).toEqual([]);
    engine.reset();

    engine.destroy();
  });

  it('applies the loop maxFrames safety cap to the next roll strategy', async () => {
    const engine = await createHeadlessEngine();
    expect(() =>
      engine.setLoopConfig({ maxFrames: 0 })
    ).toThrow(/maxFrames must be a positive integer/);
    expect(() =>
      engine.setLoopConfig({ maxFrames: 2.5 })
    ).toThrow(/maxFrames must be a positive integer/);

    engine.setLoopConfig({ maxFrames: 7 });
    await engine.roll({ dice: 1, seed: 'maxframes' });
    expect(engine.loop.strategy.maxFrames).toBe(7);

    engine.destroy();
  });

  it('resizes from explicit metrics and emits engine:resize', async () => {
    const engine = await createHeadlessEngine();
    const seen = [];
    engine.events.on(EVENTS.ENGINE_RESIZE, (payload) => seen.push(payload));

    const used = engine.resize({ ...metrics, containerWidth: 640 });
    expect(used.containerWidth).toBe(640);
    expect(seen).toHaveLength(1);
    expect(seen[0].containerWidth).toBe(640);

    engine.destroy();
  });

  it('implements the InputHost surface for input plugins', async () => {
    const engine = await createHeadlessEngine();
    await engine.roll({ dice: 2, seed: 'host' });

    expect(engine.getDiceIds()).toHaveLength(2);
    expect(engine.getSelection()).toEqual([]);
    engine.setSelection([engine.getDiceIds()[0]]);
    expect(engine.getSelection()).toHaveLength(1);
    engine.toggleSelection(engine.getDiceIds()[0]);
    expect(engine.getSelection()).toEqual([]);
    expect(engine.getMetrics()).toBeDefined();
    expect(engine.getSpawnProfile()).toBeDefined();
    expect(engine.pick({ x: 0, y: 0 })).toBeNull();
    expect(engine.events).toBe(engine.events);

    engine.setGravity(0, 0, -1000);
    engine.applyImpulse(engine.getDiceIds(), { x: 10, y: 0, z: 0 });

    engine.destroy();
  });

  it('destroy is idempotent and rejects later work', async () => {
    const engine = await createHeadlessEngine();
    engine.destroy();
    engine.destroy();
    expect(engine.destroyed).toBe(true);
    await expect(engine.roll({ dice: 1 })).rejects.toThrow();
  });
});

describe('browser mode', () => {
  it('uses BrowserScheduler when a container is present', async () => {
    const container = { clientWidth: 800, clientHeight: 600, children: [] };
    const renderer = createFakeRenderer();
    const engine = await createDiceEngine({
      container,
      headless: false,
      seed: 'browser-test',
      rendererFactory: async () => renderer
    });

    expect(engine.scheduler).toBeInstanceOf(BrowserScheduler);
    expect(engine.world.renderer).not.toBeNull();

    // Resize reads the container size.
    const used = engine.resize();
    expect(used.containerWidth).toBe(800);

    engine.setLight({ position: { x: 1, y: 0.5, z: 2 } });
    expect(renderer.calls.light).toEqual({
      position: { x: 1, y: 0.5, z: 2 }
    });

    engine.destroy();
  });
});
