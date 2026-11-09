// @ts-nocheck
import { createSeededRandom } from '@dice/core';
import { describe, expect, it } from 'vitest';

import {
  World,
  buildThrowVectors,
  clampSpawnPosition,
  isSpawnPositionInside,
  resolveCollisionDistance,
  sampleSpawnPositions,
  spawnDistance,
  spawnPosition,
  MAX_THROW_ANGLE_DEVIATION,
  THROW_STRENGTH
} from '../src/index.js';
import { metrics } from './fakes.js';

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

describe('SpawnProfile throw generation (Phase 1)', () => {
  it('is deterministic for a fixed seed', () => {
    const build = () =>
      buildThrowVectors({
        direction: { x: 0.6, y: 0.8 },
        boost: 250,
        count: 6,
        rng: createSeededRandom('world-phase1'),
        metrics,
        spawnProfile: { mode: 'box', radius: 700 },
        dieInertia: 13
      });
    const first = build();
    expect(first).toEqual(build());
    expect(first).toHaveLength(6);
  });

  it('never spawns two dice within collision distance of each other', () => {
    const collisionDistance = resolveCollisionDistance(metrics, { mode: 'box' });
    // metrics.scale is 45 => die radius 40.5, diameter 81, plus margin 10.
    expect(collisionDistance).toBeCloseTo(91, 10);

    for (const spawnProfile of [
      { mode: 'box', radius: 700 },
      { mode: 'sphere', radius: 450 },
      { mode: 'cylinder', radius: 270 }
    ]) {
      const vectors = buildThrowVectors({
        direction: { x: 1, y: 0 },
        boost: 300,
        count: 8,
        rng: createSeededRandom(`world-overlap-${spawnProfile.mode}`),
        metrics,
        spawnProfile
      });
      expect(minimumPairwiseDistance(vectors)).toBeGreaterThanOrEqual(
        collisionDistance - 1e-9
      );
    }
  });

  it('keeps every spawn inside the box, sphere, and cylinder bounds', () => {
    const cases = [
      {
        spawnProfile: { mode: 'box', radius: 700 },
        check: (/** @type {any} */ p) => {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(metrics.sceneWidth * 0.93 - 40.5);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(metrics.sceneHeight * 0.93 - 40.5);
          expect(p.z).toBeGreaterThanOrEqual(40.5);
          expect(p.z).toBeLessThanOrEqual(2700);
        }
      },
      {
        spawnProfile: { mode: 'sphere', radius: 450 },
        check: (/** @type {any} */ p) => {
          expect(Math.hypot(p.x, p.y, p.z - 450)).toBeLessThanOrEqual(450 - 40.5);
        }
      },
      {
        spawnProfile: { mode: 'cylinder', radius: 270 },
        check: (/** @type {any} */ p) => {
          expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(270 - 40.5);
          expect(p.z).toBeGreaterThanOrEqual(40.5);
        }
      }
    ];

    for (const { spawnProfile, check } of cases) {
      const vectors = buildThrowVectors({
        direction: { x: -0.8, y: 0.6 },
        boost: 400,
        count: 8,
        rng: createSeededRandom(`world-bounds-${spawnProfile.mode}`),
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
    const origin = { x: 60, y: 40, z: 280 };
    const positions = sampleSpawnPositions({
      count: 6,
      rng: createSeededRandom('world-origin'),
      metrics,
      spawnProfile: { mode: 'box', radius: 700 },
      origin
    });
    expect(positions).toHaveLength(6);
    for (const pos of positions) {
      expect(pos.z).toBe(280);
      expect(Math.hypot(pos.x - origin.x, pos.y - origin.y)).toBeLessThanOrEqual(350);
      expect(isSpawnPositionInside(pos, metrics, { mode: 'box', radius: 700 })).toBe(true);
    }
  });

  it('gives positive Vz scaled with throw force, within the angle cone', () => {
    const direction = { x: 0.6, y: 0.8 };
    const soft = buildThrowVectors({
      direction,
      boost: 100,
      count: 6,
      rng: createSeededRandom('world-lob'),
      metrics,
      spawnProfile: { mode: 'box', radius: 700 }
    });
    const hard = buildThrowVectors({
      direction,
      boost: 400,
      count: 6,
      rng: createSeededRandom('world-lob'),
      metrics,
      spawnProfile: { mode: 'box', radius: 700 }
    });

    const deviations = new Set();
    soft.forEach((vector, index) => {
      expect(vector.velocity.z).toBeGreaterThan(0);
      expect(hard[index].velocity.z).toBeCloseTo(vector.velocity.z * 4, 6);

      const horizontal = Math.hypot(vector.velocity.x, vector.velocity.y);
      // Unified throw strength: velocity is boost x THROW_STRENGTH (± jitter).
      expect(horizontal / (100 * THROW_STRENGTH)).toBeGreaterThanOrEqual(0.85 - 1e-9);
      expect(horizontal / (100 * THROW_STRENGTH)).toBeLessThanOrEqual(1.15 + 1e-9);
      expect(vector.velocity.z).toBeCloseTo(horizontal * 0.5, 6);

      const dot =
        (vector.velocity.x * direction.x + vector.velocity.y * direction.y) /
        horizontal;
      const deviation = Math.acos(Math.max(-1, Math.min(1, dot)));
      expect(deviation).toBeLessThanOrEqual(MAX_THROW_ANGLE_DEVIATION + 1e-9);
      deviations.add(Number(deviation.toFixed(6)));

      expect(Math.hypot(vector.angle.x, vector.angle.y, vector.angle.z)).toBeGreaterThan(0);
    });
    expect(deviations.size).toBeGreaterThan(1);

    const softSpin = Math.hypot(soft[0].angle.x, soft[0].angle.y, soft[0].angle.z);
    const hardSpin = Math.hypot(hard[0].angle.x, hard[0].angle.y, hard[0].angle.z);
    expect(hardSpin).toBeGreaterThan(softSpin);
    expect(soft.some((vector) => vector.angle.z !== 0)).toBe(true);
  });

  it('clamps out-of-bounds positions into each enclosure', () => {
    expect(
      isSpawnPositionInside(
        clampSpawnPosition({ x: 9999, y: -9999, z: 9999 }, metrics, { mode: 'box' }),
        metrics,
        { mode: 'box' }
      )
    ).toBe(true);
    expect(
      isSpawnPositionInside(
        clampSpawnPosition(
          { x: 9999, y: 0, z: 9999 },
          metrics,
          { mode: 'sphere', radius: 450 }
        ),
        metrics,
        { mode: 'sphere', radius: 450 }
      )
    ).toBe(true);
    expect(
      isSpawnPositionInside(
        clampSpawnPosition(
          { x: 9999, y: 9999, z: 1 },
          metrics,
          { mode: 'cylinder', radius: 270 }
        ),
        metrics,
        { mode: 'cylinder', radius: 270 }
      )
    ).toBe(true);
  });

  it('keeps a following spawnPosition clear of an already placed die', () => {
    const first = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('world-placed'),
      metrics,
      { mode: 'box', radius: 700 }
    );
    const second = spawnPosition(
      { x: 1, y: 0 },
      createSeededRandom('world-placed'),
      metrics,
      { mode: 'box', radius: 700 },
      { placed: [first] }
    );
    expect(spawnDistance(first, second)).toBeGreaterThanOrEqual(
      resolveCollisionDistance(metrics, { mode: 'box' }) - 1e-9
    );
  });
});

describe('World throw plans use the Phase 1 generation', () => {
  /**
   * @param {string} enclosure
   * @returns {Promise<World>}
   */
  async function createHeadlessWorld(enclosure) {
    const world = new World({
      rng: createSeededRandom('world-plan'),
      headless: true,
      container: null
    });
    await world.init({ ...metrics });
    if (enclosure !== 'box') world.setEnclosure(enclosure);
    return world;
  }

  it('produces deterministic, non-overlapping, in-bounds plans with Vz > 0', async () => {
    const collisionDistance = resolveCollisionDistance(metrics, { mode: 'box' });

    for (const enclosure of ['box', 'sphere', 'cylinder']) {
      const world = await createHeadlessWorld(enclosure);
      const first = world.createThrowPlan({ dice: 6, seed: 'fixed-seed' });
      const second = world.createThrowPlan({ dice: 6, seed: 'fixed-seed' });
      expect(first.vectors).toEqual(second.vectors);
      expect(first.vectors).toHaveLength(6);

      const profile = world.getSpawnProfile();
      for (const vector of first.vectors) {
        expect(vector.velocity.z).toBeGreaterThan(0);
        expect(isSpawnPositionInside(vector.pos, world.getMetrics(), profile)).toBe(true);
        // Auto-generated plans keep their calibrated boost: the unified
        // flick strength (3x) must not multiply them. Max auto boost is
        // 4 * hypot(1000, 600) ~ 4660, so horizontal speed stays below that
        // (plus jitter) instead of tripling toward ~14000.
        expect(Math.hypot(vector.velocity.x, vector.velocity.y)).toBeLessThan(6000);
      }
      expect(minimumPairwiseDistance(first.vectors)).toBeGreaterThanOrEqual(
        collisionDistance - 1e-9
      );

      world.dispose();
    }
  });
});
