// @ts-nocheck
/**
 * Integration regression test: a flick in continuous mode must actually
 * move the live dice through the real engine + physics stack.
 *
 * Previously the impulse was built at throw-velocity scale (~400) and
 * physics divides impulses by the die mass (300), so the dice only gained
 * ~1 unit of velocity and the flick looked unregistered.
 */
import { createSeededRandom } from '@dice/core';
import { createDiceEngine } from '@dice/engine';
import { PointerInput } from '@dice/input';
import { describe, expect, it } from 'vitest';

function createFakeContainer() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1000, height: 600 };
    },
    dispatch(type, event) {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
    }
  };
}

/**
 * @returns {Promise<{ engine: any, container: any, input: any, now: () => number, advance: (ms: number) => void }>}
 */
async function createContinuousHarness() {
  const engine = await createDiceEngine({
    headless: true,
    container: null,
    seed: 'continuous-flick',
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

  const container = createFakeContainer();
  let now = 1000;
  const input = new PointerInput({
    container,
    rng: createSeededRandom('continuous-flick'),
    now: () => now
  });
  engine.use(input);

  engine.setMode('continuous');
  const pending = engine.roll({ dice: 3, mode: 'continuous', seed: 'c1' });
  pending.catch(() => {});
  // The roll setup is async; wait for the live dice to exist.
  for (let i = 0; i < 50 && engine.getDiceIds().length === 0; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return {
    engine,
    container,
    input,
    now: () => now,
    advance: (ms) => {
      now += ms;
    }
  };
}

describe('continuous-mode flick (engine + input integration)', () => {
  it('applies a boost-scale velocity change to every live die', async () => {
    const { engine, container, input, advance } = await createContinuousHarness();
    expect(engine.getDiceIds()).toHaveLength(3);
    expect(engine.mode).toBe('continuous');

    const idsBefore = [...engine.getDiceIds()];
    const velocitiesBefore = engine.world
      .getDice()
      .map((die) => die.body.getVelocity());
    const spinsBefore = engine.world
      .getDice()
      .map((die) => die.body.getAngularVelocity());

    // Flick down-screen (scene -Y), 200px in 200ms.
    container.dispatch('mousedown', { clientX: 100, clientY: 100 });
    advance(200);
    container.dispatch('mouseup', { clientX: 100, clientY: 300 });

    // Continuous mode never clears or respawns dice.
    expect(engine.getDiceIds()).toEqual(idsBefore);

    const velocitiesAfter = engine.world
      .getDice()
      .map((die) => die.body.getVelocity());
    const spinsAfter = engine.world
      .getDice()
      .map((die) => die.body.getAngularVelocity());

    expect(velocitiesAfter).toHaveLength(3);
    /** @type {number[]} */
    const spinDeltas = [];
    velocitiesAfter.forEach((velocity, index) => {
      const before = velocitiesBefore[index];
      const delta = {
        x: velocity.x - before.x,
        y: velocity.y - before.y,
        z: velocity.z - before.z
      };
      // The flick is registered: a visible, boost-scale velocity change
      // (over a thousand units at the default strength), not a ~1-unit
      // nudge, and directed steeply off the floor (Vz > horizontal).
      expect(Math.hypot(delta.x, delta.y)).toBeGreaterThan(500);
      expect(delta.y).toBeLessThan(0);
      expect(delta.z).toBeGreaterThan(Math.hypot(delta.x, delta.y));

      // The impulses are applied away from each die's centre of mass, so
      // every die also tumbles: a real angular-velocity change, varied
      // per die by the cone/jitter sampling.
      const spinBefore = spinsBefore[index];
      const spinAfter = spinsAfter[index];
      const spinDelta = Math.hypot(
        spinAfter.x - spinBefore.x,
        spinAfter.y - spinBefore.y,
        spinAfter.z - spinBefore.z
      );
      expect(spinDelta).toBeGreaterThan(1);
      spinDeltas.push(spinDelta);
    });
    expect(new Set(spinDeltas.map((value) => value.toFixed(3))).size).toBeGreaterThan(1);

    input.detach();
    engine.cancelRoll('test-done');
    engine.destroy();
  });

  it('ignores sub-threshold drags without touching the live dice', async () => {
    const { engine, container, input, advance } = await createContinuousHarness();
    expect(engine.getDiceIds()).toHaveLength(3);

    const velocitiesBefore = engine.world
      .getDice()
      .map((die) => die.body.getVelocity());

    // 10px: below the 18px throw threshold, so the tap stays a tap.
    container.dispatch('mousedown', { clientX: 100, clientY: 100 });
    advance(200);
    container.dispatch('mouseup', { clientX: 110, clientY: 100 });

    const velocitiesAfter = engine.world
      .getDice()
      .map((die) => die.body.getVelocity());
    velocitiesAfter.forEach((velocity, index) => {
      expect(velocity).toEqual(velocitiesBefore[index]);
    });

    input.detach();
    engine.cancelRoll('test-done');
    engine.destroy();
  });
});
