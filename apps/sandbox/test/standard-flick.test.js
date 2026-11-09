// @ts-nocheck
/**
 * Integration test: a flick in standard mode must spawn dice through the
 * real engine + physics stack, scattered around the projected pointer-down
 * point (P_start), with an upward lob and per-die variation.
 *
 * The throw vectors are captured at the `engine.roll()` boundary: the dice
 * settle inside the headless loop, so post-roll body velocities (~0) cannot
 * prove the lob — the vectors themselves carry the spawn/velocity proof.
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
 * Create a headless engine with a fake-but-sized container and a
 * PointerInput attached. Roll requests are recorded so the throw vectors
 * built from the flick can be asserted directly.
 *
 * @param {{ dieCount?: number }} [options]
 * @returns {Promise<{ engine: any, container: any, input: any, rolls: any[], flick: (start: any, end: any, durationMs?: number) => Promise<void> }>}
 */
async function createHarness(options = {}) {
  const engine = await createDiceEngine({
    headless: true,
    container: null,
    seed: 'standard-flick',
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
    rng: createSeededRandom('standard-flick'),
    now: () => now,
    dieCount: options.dieCount ?? 6
  });

  /** @type {any[]} */
  const rolls = [];
  const originalRoll = engine.roll.bind(engine);
  engine.roll = (request) => {
    rolls.push(request);
    return originalRoll(request);
  };

  engine.use(input);

  /**
   * @param {{ x: number, y: number }} start
   * @param {{ x: number, y: number }} end
   * @param {number} [durationMs]
   */
  async function flick(start, end, durationMs = 200) {
    container.dispatch('mousedown', { clientX: start.x, clientY: start.y });
    now += durationMs;
    container.dispatch('mouseup', { clientX: end.x, clientY: end.y });
    // The roll setup is async; wait for the spawn to land.
    for (let i = 0; i < 50 && engine.getDiceIds().length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  return { engine, container, input, rolls, flick };
}

/**
 * Poll until the headless roll settles.
 *
 * @param {any} engine
 */
async function settle(engine) {
  for (let i = 0; i < 100 && engine.loop.running; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('standard-mode flick (engine + input integration)', () => {
  it('spawns dice around the projected pointer-down point with an upward lob', async () => {
    const { engine, input, rolls, flick } = await createHarness();

    // Flick down-screen (scene -Y) from (100, 100), 200px in 200ms.
    await flick({ x: 100, y: 100 }, { x: 100, y: 300 });

    expect(rolls).toHaveLength(1);
    const vectors = rolls[0].vectors;
    expect(vectors).toHaveLength(6);

    // The spawn origin is the projected P_start: (100, 100) on a 1000x600
    // rect maps to world (-400, 200) at the box throw height (NDC -0.8 /
    // 0.667 over half-scene 500 / 300). Dice scatter around it.
    const origin = { x: -400, y: 200 };
    const centroid = vectors
      .reduce(
        (acc, vector) => ({ x: acc.x + vector.pos.x, y: acc.y + vector.pos.y }),
        { x: 0, y: 0 }
      );
    centroid.x /= vectors.length;
    centroid.y /= vectors.length;
    expect(Math.hypot(centroid.x - origin.x, centroid.y - origin.y)).toBeLessThan(300);
    for (const vector of vectors) {
      expect(Math.hypot(vector.pos.x - origin.x, vector.pos.y - origin.y)).toBeLessThan(600);
    }

    // All dice share the box Z_spawn.
    expect(new Set(vectors.map((vector) => vector.pos.z)).size).toBe(1);

    // No two dice spawn closer than the die diameter plus margin
    // (dieRadius = max(10, 50 * 0.9) = 45 -> 100).
    for (let i = 0; i < vectors.length; i += 1) {
      for (let j = i + 1; j < vectors.length; j += 1) {
        const distance = Math.hypot(
          vectors[i].pos.x - vectors[j].pos.x,
          vectors[i].pos.y - vectors[j].pos.y,
          vectors[i].pos.z - vectors[j].pos.z
        );
        expect(distance).toBeGreaterThanOrEqual(100 - 1e-6);
      }
    }

    // Box enclosure bounds: half scene (930 / 558) minus the die radius.
    for (const vector of vectors) {
      expect(Math.abs(vector.pos.x)).toBeLessThanOrEqual(930 - 45 + 1e-6);
      expect(Math.abs(vector.pos.y)).toBeLessThanOrEqual(558 - 45 + 1e-6);
      expect(vector.pos.z).toBeGreaterThanOrEqual(45 - 1e-6);
    }

    // Upward lob: every die launches with positive Vz, directional -Y,
    // within the +-10-degree cone, with per-die speed jitter and spin.
    const horizontalSpeeds = [];
    for (const vector of vectors) {
      expect(vector.velocity.z).toBeGreaterThan(0);
      // Vz is half the horizontal speed (the throw ratio).
      expect(vector.velocity.z).toBeCloseTo(
        Math.hypot(vector.velocity.x, vector.velocity.y) / 2,
        6
      );
      expect(vector.velocity.y).toBeLessThan(0);
      const angle = Math.atan2(Math.abs(vector.velocity.x), -vector.velocity.y);
      expect(angle).toBeLessThanOrEqual(Math.PI / 18 + 1e-6);
      horizontalSpeeds.push(Math.hypot(vector.velocity.x, vector.velocity.y));
      expect(Math.hypot(vector.angle.x, vector.angle.y, vector.angle.z)).toBeGreaterThan(0);
    }
    // Speed jitter is bounded: speeds stay within the +-15% band.
    expect(Math.max(...horizontalSpeeds) / Math.min(...horizontalSpeeds)).toBeLessThanOrEqual(
      1.15 / 0.85 + 1e-6
    );

    // The engine actually spawned the dice from these vectors.
    await settle(engine);
    expect(engine.getDiceIds()).toHaveLength(6);

    input.detach();
    engine.cancelRoll('test-done');
    engine.destroy();
  });

  it('anchors spawns to the pointer-down point, not the table centre', async () => {
    const { engine, input, rolls, flick } = await createHarness();

    // Two flicks from opposite corners project to opposite world corners.
    await flick({ x: 100, y: 100 }, { x: 100, y: 300 });
    await flick({ x: 900, y: 500 }, { x: 900, y: 300 });

    expect(rolls).toHaveLength(2);
    const centroids = rolls.map((request) => {
      const centroid = request.vectors.reduce(
        (acc, vector) => ({ x: acc.x + vector.pos.x, y: acc.y + vector.pos.y }),
        { x: 0, y: 0 }
      );
      centroid.x /= request.vectors.length;
      centroid.y /= request.vectors.length;
      return centroid;
    });
    // (100,100) -> (-400, 200); (900,500) -> (400, -200).
    expect(centroids[0].x).toBeLessThan(0);
    expect(centroids[0].y).toBeGreaterThan(0);
    expect(centroids[1].x).toBeGreaterThan(0);
    expect(centroids[1].y).toBeLessThan(0);
    expect(
      Math.hypot(centroids[1].x - centroids[0].x, centroids[1].y - centroids[0].y)
    ).toBeGreaterThan(400);

    input.detach();
    engine.cancelRoll('test-done');
    engine.destroy();
  });

  it('cancels sub-threshold drags without rolling', async () => {
    const { engine, input, rolls, flick } = await createHarness();

    // 10px: below the 18px throw threshold, so the tap stays a tap.
    await flick({ x: 100, y: 100 }, { x: 110, y: 100 });

    expect(rolls).toHaveLength(0);
    expect(engine.getDiceIds()).toHaveLength(0);

    input.detach();
    engine.destroy();
  });

  it.each(['box', 'sphere', 'cylinder'])(
    'spawns inside the %s enclosure bounds',
    async (enclosureId) => {
      const { engine, input, rolls, flick } = await createHarness();
      engine.setEnclosure(enclosureId);

      await flick({ x: 100, y: 100 }, { x: 100, y: 300 });

      expect(rolls).toHaveLength(1);
      const vectors = rolls[0].vectors;
      expect(vectors).toHaveLength(6);
      expect(engine.getSpawnProfile().mode).toBe(enclosureId);

      if (enclosureId === 'box') {
        for (const vector of vectors) {
          expect(Math.abs(vector.pos.x)).toBeLessThanOrEqual(930 - 45 + 1e-6);
          expect(Math.abs(vector.pos.y)).toBeLessThanOrEqual(558 - 45 + 1e-6);
          expect(vector.pos.z).toBeGreaterThanOrEqual(45 - 1e-6);
        }
      } else if (enclosureId === 'sphere') {
        const radius = engine.getSpawnProfile().radius;
        // Spawn height is the sphere's upper-inner 1.35 * radius.
        expect(vectors.every((vector) => vector.pos.z === radius * 1.35)).toBe(true);
        for (const vector of vectors) {
          const distance = Math.hypot(
            vector.pos.x - 0,
            vector.pos.y - 0,
            vector.pos.z - radius
          );
          expect(distance).toBeLessThanOrEqual(radius - 45 + 1e-6);
        }
      } else {
        const radius = engine.getSpawnProfile().radius;
        // Spawn height is the cylinder's 0.5 * radius.
        expect(vectors.every((vector) => vector.pos.z === radius * 0.5)).toBe(true);
        for (const vector of vectors) {
          expect(Math.hypot(vector.pos.x, vector.pos.y)).toBeLessThanOrEqual(radius - 45 + 1e-6);
        }
      }

      // Every enclosed spawn still lobs upward.
      for (const vector of vectors) {
        expect(vector.velocity.z).toBeGreaterThan(0);
      }

      input.detach();
      engine.cancelRoll('test-done');
      engine.destroy();
    }
  );
});
