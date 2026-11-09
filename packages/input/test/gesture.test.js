import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import {
  MAX_THROW_ANGLE_DEVIATION,
  buildThrowVectors,
  clampSpawnPosition,
  clientToNdc,
  evaluateGesture,
  gestureBoost,
  gestureDistance,
  isSpawnPositionInside,
  minSwipeThreshold,
  normalizeVector,
  randomizeDirection,
  resolveCollisionDistance,
  sampleSpawnPositions,
  spawnDistance,
  spawnPosition,
  vectorFromDelta
} from '../src/index.js';

/**
 * @param {Array<{ pos: { x: number, y: number, z: number } }>} vectors
 * @returns {number}
 */
function minimumPairwiseDistance(vectors) {
  let minimum = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      minimum = Math.min(minimum, spawnDistance(vectors[i].pos, vectors[j].pos));
    }
  }
  return minimum;
}

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
      // Upward lob: Vz is positive and scaled with the throw force.
      expect(vector.velocity.z).toBeGreaterThan(0);
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
    // Origin-anchored: near the table centre, not at the tray edges.
    expect(Math.abs(box.x)).toBeLessThanOrEqual(900);
    expect(Math.abs(box.y)).toBeLessThanOrEqual(540);
    expect(Math.hypot(box.x, box.y)).toBeLessThanOrEqual(300);
    expect(box.z).toBe(300);
    expect(isSpawnPositionInside(box, metrics, { mode: 'box' })).toBe(true);

    const sphere = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('sphere'),
      metrics,
      { mode: 'sphere', radius: 700 }
    );
    expect(sphere.z).toBe(700 * 1.35);
    expect(
      Math.hypot(sphere.x, sphere.y, sphere.z - 700)
    ).toBeLessThanOrEqual(700 - 40.5);
    expect(isSpawnPositionInside(sphere, metrics, { mode: 'sphere', radius: 700 })).toBe(true);

    const cylinder = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('cylinder'),
      metrics,
      { mode: 'cylinder', radius: 700 }
    );
    expect(cylinder.z).toBe(700 * 0.5);
    expect(Math.hypot(cylinder.x, cylinder.y)).toBeLessThanOrEqual(700 - 40.5);
    expect(isSpawnPositionInside(cylinder, metrics, { mode: 'cylinder', radius: 700 })).toBe(
      true
    );
  });
});

describe('origin-anchored throw generation (Phase 1)', () => {
  const metrics = { sceneWidth: 1000, sceneHeight: 600 };

  it('is deterministic for a fixed seed across all enclosures', () => {
    for (const spawnProfile of [
      { mode: 'box' },
      { mode: 'sphere', radius: 700 },
      { mode: 'cylinder', radius: 700 }
    ]) {
      const build = () =>
        buildThrowVectors({
          direction: { x: 0.6, y: 0.8 },
          boost: 250,
          count: 6,
          rng: createSeededRandom('phase1-seed'),
          metrics,
          spawnProfile,
          dieInertia: 13
        });
      expect(build()).toEqual(build());
    }
  });

  it('never spawns two dice within collision distance of each other', () => {
    const collisionDistance = resolveCollisionDistance(metrics, { mode: 'box' });
    // Die diameter (2 * 40.5) plus the spawn margin.
    expect(collisionDistance).toBeCloseTo(81 + 10, 10);

    for (const spawnProfile of [
      { mode: 'box' },
      { mode: 'sphere', radius: 450 },
      { mode: 'cylinder', radius: 270 }
    ]) {
      const vectors = buildThrowVectors({
        direction: { x: 1, y: 0 },
        boost: 300,
        count: 8,
        rng: createSeededRandom(`overlap-${spawnProfile.mode}`),
        metrics,
        spawnProfile
      });
      expect(vectors).toHaveLength(8);
      expect(minimumPairwiseDistance(vectors)).toBeGreaterThanOrEqual(
        collisionDistance - 1e-9
      );
    }
  });

  it('keeps every spawn inside the box, sphere, and cylinder bounds', () => {
    const cases = [
      { spawnProfile: { mode: 'box' }, check: (/** @type {any} */ p) => {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(1000 * 0.93 - 40.5);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(600 * 0.93 - 40.5);
        expect(p.z).toBeGreaterThanOrEqual(40.5);
        expect(p.z).toBeLessThanOrEqual(2700);
      } },
      { spawnProfile: { mode: 'sphere', radius: 450 }, check: (/** @type {any} */ p) => {
        expect(Math.hypot(p.x, p.y, p.z - 450)).toBeLessThanOrEqual(450 - 40.5);
      } },
      { spawnProfile: { mode: 'cylinder', radius: 270 }, check: (/** @type {any} */ p) => {
        expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(270 - 40.5);
        expect(p.z).toBeGreaterThanOrEqual(40.5);
      } }
    ];

    for (const { spawnProfile, check } of cases) {
      const vectors = buildThrowVectors({
        direction: { x: -0.8, y: 0.6 },
        boost: 400,
        count: 10,
        rng: createSeededRandom(`bounds-${spawnProfile.mode}`),
        metrics,
        spawnProfile
      });
      for (const vector of vectors) {
        check(vector.pos);
        expect(isSpawnPositionInside(vector.pos, metrics, spawnProfile)).toBe(true);
      }
    }
  });

  it('anchors spawns at a supplied origin at the shared throw height', () => {
    const origin = { x: 120, y: -80, z: 250 };
    const positions = sampleSpawnPositions({
      count: 6,
      rng: createSeededRandom('origin'),
      metrics,
      spawnProfile: { mode: 'box' },
      origin
    });
    expect(positions).toHaveLength(6);
    for (const pos of positions) {
      expect(pos.z).toBe(250);
      expect(Math.hypot(pos.x - origin.x, pos.y - origin.y)).toBeLessThanOrEqual(350);
      expect(isSpawnPositionInside(pos, metrics, { mode: 'box' })).toBe(true);
    }

    // An origin outside the enclosure is still clamped inside it.
    const clamped = sampleSpawnPositions({
      count: 4,
      rng: createSeededRandom('origin-outside'),
      metrics,
      spawnProfile: { mode: 'box' },
      origin: { x: 5000, y: -5000, z: 250 }
    });
    for (const pos of clamped) {
      expect(isSpawnPositionInside(pos, metrics, { mode: 'box' })).toBe(true);
    }
  });

  it('gives positive Vz scaled with throw force, within the angle cone', () => {
    const direction = { x: 0.6, y: 0.8 };
    const soft = buildThrowVectors({
      direction,
      boost: 100,
      count: 6,
      rng: createSeededRandom('lob'),
      metrics,
      spawnProfile: { mode: 'box' }
    });
    const hard = buildThrowVectors({
      direction,
      boost: 400,
      count: 6,
      rng: createSeededRandom('lob'),
      metrics,
      spawnProfile: { mode: 'box' }
    });

    const deviations = new Set();
    soft.forEach((vector, index) => {
      expect(vector.velocity.z).toBeGreaterThan(0);
      // Same seed => the same jitter sequence, so Vz scales with boost.
      expect(hard[index].velocity.z).toBeCloseTo(vector.velocity.z * 4, 6);

      const horizontal = Math.hypot(vector.velocity.x, vector.velocity.y);
      // Per-die speed jitter is bounded to ±15% of the boost.
      expect(horizontal / 100).toBeGreaterThanOrEqual(0.85 - 1e-9);
      expect(horizontal / 100).toBeLessThanOrEqual(1.15 + 1e-9);
      expect(vector.velocity.z).toBeCloseTo(horizontal * 0.5, 6);

      const dot =
        (vector.velocity.x * direction.x + vector.velocity.y * direction.y) /
        horizontal;
      const deviation = Math.acos(Math.max(-1, Math.min(1, dot)));
      expect(deviation).toBeLessThanOrEqual(MAX_THROW_ANGLE_DEVIATION + 1e-9);
      deviations.add(Number(deviation.toFixed(6)));

      // 3D spin: every axis is exercised and varies per die.
      expect(Math.hypot(vector.angle.x, vector.angle.y, vector.angle.z)).toBeGreaterThan(0);
    });
    // Angular variation: the dice do not all fly in exactly the same direction.
    expect(deviations.size).toBeGreaterThan(1);

    // Spin scales with throw power: the same seed at a higher boost tumbles harder.
    const softSpin = Math.hypot(soft[0].angle.x, soft[0].angle.y, soft[0].angle.z);
    const hardSpin = Math.hypot(hard[0].angle.x, hard[0].angle.y, hard[0].angle.z);
    expect(hardSpin).toBeGreaterThan(softSpin);
    expect(soft.some((vector) => vector.angle.z !== 0)).toBe(true);
  });

  it('keeps a following spawn clear of an already placed die', () => {
    const first = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('placed'),
      metrics,
      { mode: 'box' }
    );
    const second = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('placed'),
      metrics,
      { mode: 'box' },
      { placed: [first] }
    );
    expect(spawnDistance(first, second)).toBeGreaterThanOrEqual(
      resolveCollisionDistance(metrics, { mode: 'box' }) - 1e-9
    );
  });

  it('clamps out-of-bounds positions into each enclosure', () => {
    const box = clampSpawnPosition({ x: 9999, y: -9999, z: 9999 }, metrics, { mode: 'box' });
    expect(isSpawnPositionInside(box, metrics, { mode: 'box' })).toBe(true);

    const sphere = clampSpawnPosition(
      { x: 9999, y: 0, z: 9999 },
      metrics,
      { mode: 'sphere', radius: 700 }
    );
    expect(isSpawnPositionInside(sphere, metrics, { mode: 'sphere', radius: 700 })).toBe(true);

    const cylinder = clampSpawnPosition(
      { x: 9999, y: 9999, z: 1 },
      metrics,
      { mode: 'cylinder', radius: 700 }
    );
    expect(isSpawnPositionInside(cylinder, metrics, { mode: 'cylinder', radius: 700 })).toBe(
      true
    );
    expect(cylinder.z).toBeGreaterThanOrEqual(40.5);
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
