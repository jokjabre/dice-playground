import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import {
  buildThrowVectors,
  clientToNdc,
  evaluateGesture,
  gestureBoost,
  gestureDistance,
  minSwipeThreshold,
  normalizeVector,
  randomizeDirection,
  spawnPosition,
  vectorFromDelta
} from '../src/index.js';

describe('gesture distance and boost math', () => {
  it('measures distance from the delta vector', () => {
    expect(gestureDistance({ x: 3, y: 4 })).toBe(5);
    expect(gestureDistance({ x: 0, y: 0 })).toBe(0);
    expect(vectorFromDelta({ x: 10, y: 10 }, { x: 13, y: 6 })).toEqual({
      x: 3,
      y: 4
    });
  });

  it('computes boost from the legacy curve', () => {
    // sqrt((2500 - t) / 2500) * dist * 2, with t clamped to [0, 2000].
    expect(gestureBoost(100, 0)).toBeCloseTo(200, 10);
    expect(gestureBoost(100, 2000)).toBeCloseTo(
      Math.sqrt(500 / 2500) * 100 * 2,
      10
    );
    expect(gestureBoost(100, 9999)).toBeCloseTo(
      Math.sqrt(500 / 2500) * 100 * 2,
      10
    );
    expect(gestureBoost(50, 500)).toBeCloseTo(
      Math.sqrt(2000 / 2500) * 50 * 2,
      10
    );
  });

  it('derives the swipe threshold from scene size', () => {
    expect(minSwipeThreshold({ sceneWidth: 1000, sceneHeight: 600 })).toBeCloseTo(
      Math.sqrt(1000 * 600 * 0.01),
      10
    );
    expect(
      minSwipeThreshold({ scene_width: 500, scene_height: 500 })
    ).toBeCloseTo(Math.sqrt(500 * 500 * 0.01), 10);
  });

  it('normalizes and evaluates gestures', () => {
    expect(normalizeVector({ x: 3, y: 4 })).toEqual({ x: 0.6, y: 0.8 });
    expect(normalizeVector({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });

    const metrics = { sceneWidth: 1000, sceneHeight: 600 };
    const swipe = evaluateGesture({
      start: { x: 0, y: 0 },
      end: { x: 0, y: -200 },
      durationMs: 300,
      metrics
    });
    expect(swipe.vector).toEqual({ x: 0, y: 200 });
    expect(swipe.distance).toBe(200);
    expect(swipe.isSwipe).toBe(true);
    expect(swipe.boost).toBeGreaterThan(0);

    const tap = evaluateGesture({
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      durationMs: 50,
      metrics
    });
    expect(tap.isSwipe).toBe(false);
  });
});

describe('throw vector generation', () => {
  const metrics = { sceneWidth: 1000, sceneHeight: 600 };

  it('jitters the direction deterministically for a seeded source', () => {
    const a = randomizeDirection({ x: 1, y: 0 }, createSeededRandom('seed'));
    const b = randomizeDirection({ x: 1, y: 0 }, createSeededRandom('seed'));
    expect(a).toEqual(b);
    expect(a.x).not.toBe(0);
  });

  it('builds one vector per die with a seeded source', () => {
    const first = buildThrowVectors({
      direction: { x: 0.6, y: 0.8 },
      boost: 200,
      count: 3,
      rng: createSeededRandom('vectors'),
      metrics,
      spawnProfile: { mode: 'box' },
      dieInertia: 13
    });
    const second = buildThrowVectors({
      direction: { x: 0.6, y: 0.8 },
      boost: 200,
      count: 3,
      rng: createSeededRandom('vectors'),
      metrics,
      spawnProfile: { mode: 'box' },
      dieInertia: 13
    });

    expect(first).toHaveLength(3);
    expect(first).toEqual(second);
    for (const vector of first) {
      expect(vector.velocity.z).toBe(-10);
      expect(Number.isFinite(vector.pos.x)).toBe(true);
      expect(Number.isFinite(vector.angle.x)).toBe(true);
    }
  });

  it('spawns inside the active enclosure profile', () => {
    const box = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('box'),
      metrics,
      { mode: 'box' }
    );
    expect(Math.abs(box.x)).toBeLessThanOrEqual(900);
    expect(Math.abs(box.y)).toBeLessThanOrEqual(540);
    expect(box.z).toBeGreaterThanOrEqual(200);
    expect(box.z).toBeLessThanOrEqual(400);

    const sphere = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('sphere'),
      metrics,
      { mode: 'sphere', radius: 700 }
    );
    expect(Math.hypot(sphere.x, sphere.y)).toBeLessThanOrEqual(700 * 0.28 * Math.SQRT2);
    expect(sphere.z).toBeGreaterThanOrEqual(700 * 0.4);
  });
});

describe('normalized device coordinates', () => {
  it('maps the rect center to the origin and corners to +/-1', () => {
    const rect = { left: 50, top: 20, width: 200, height: 100 };
    expect(clientToNdc(150, 70, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToNdc(50, 20, rect)).toEqual({ x: -1, y: 1 });
    expect(clientToNdc(250, 120, rect)).toEqual({ x: 1, y: -1 });
  });

  it('rejects an empty rect', () => {
    expect(() =>
      clientToNdc(10, 10, { left: 0, top: 0, width: 0, height: 10 })
    ).toThrow(/rect with positive width and height/);
  });
});
