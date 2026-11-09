import { describe, expect, it } from 'vitest';

import { PhysicsWorld, normalizeShape } from '../src/index.js';

const identity = { x: 0, y: 0, z: 0, w: 1 };

/**
 * @param {PhysicsWorld} world
 * @param {import('../src/shapes.js').ShapeDescriptor} shape
 * @param {string} material
 */
function staticShape(world, shape, material) {
  return world.createBody({
    id: 'fixture',
    shape,
    mass: 0,
    material
  });
}

/**
 * @param {PhysicsWorld} world
 * @param {number} startHeight
 */
function dropSphere(world, startHeight) {
  return world.createBody({
    id: 'die',
    shape: { type: 'sphere', radius: 10 },
    mass: 30,
    transform: { position: { x: 0, y: 0, z: startHeight }, quaternion: identity }
  });
}

describe('shape descriptors', () => {
  it('normalizes descriptors without mutating the input', () => {
    const input = {
      type: /** @type {'box'} */ ('box'),
      halfExtents: { x: 1, y: 2, z: 3 }
    };
    const result = normalizeShape(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(/** @type {any} */ (result).halfExtents).not.toBe(input.halfExtents);

    const plane = normalizeShape({
      type: 'plane',
      normal: { x: 0, y: 0, z: 10 }
    });
    expect(plane).toEqual({
      type: 'plane',
      normal: { x: 0, y: 0, z: 1 }
    });

    const cylinder = normalizeShape({
      type: 'cylinder',
      radius: 10,
      height: 20
    });
    expect(cylinder).toEqual({
      type: 'cylinder',
      radius: 10,
      height: 20,
      segments: 24,
      axis: 'z'
    });
  });

  it('rejects malformed descriptors', () => {
    expect(() => normalizeShape(/** @type {any} */ ({}))).toThrow(/Unknown/);
    expect(() =>
      normalizeShape({ type: 'plane', normal: { x: 0, y: 0, z: 0 } })
    ).toThrow(/zero vector/);
    expect(() =>
      normalizeShape({ type: 'box', halfExtents: { x: 0, y: 1, z: 1 } })
    ).toThrow(/greater than zero/);
    expect(() =>
      normalizeShape({ type: 'cylinder', radius: 1, height: 1, segments: 2 })
    ).toThrow(/at least 3/);
  });

  it('contains a die on a static box', () => {
    const world = new PhysicsWorld();
    world.setContactMaterial('die', 'desk', { friction: 0.4, restitution: 0 });
    staticShape(
      world,
      { type: 'box', halfExtents: { x: 100, y: 100, z: 10 } },
      'desk'
    );
    const body = dropSphere(world, 100);

    for (let i = 0; i < 120; i++) world.step(1 / 60);
    expect(body.getPosition().z).toBeCloseTo(20, 1);

    world.dispose();
  });

  it('contains a die on a static sphere', () => {
    const world = new PhysicsWorld();
    world.setContactMaterial('die', 'desk', { friction: 0.4, restitution: 0 });
    staticShape(world, { type: 'sphere', radius: 50 }, 'desk');
    const body = dropSphere(world, 200);

    for (let i = 0; i < 180; i++) world.step(1 / 60);
    expect(body.getPosition().z).toBeCloseTo(60, 1);

    world.dispose();
  });

  it('converts Z-up cylinders to the cannon-es local axis', () => {
    const world = new PhysicsWorld();
    world.setContactMaterial('die', 'glass_boundary', {
      friction: 0.4,
      restitution: 0
    });
    staticShape(
      world,
      {
        type: 'cylinder',
        radius: 200,
        height: 100,
        segments: 24,
        axis: 'z'
      },
      'glass_boundary'
    );
    const body = dropSphere(world, 300);

    for (let i = 0; i < 120; i++) world.step(1 / 60);

    // The top cap is at z = 50, so a radius-10 die rests near 60. A failed
    // orientation conversion would use the 200-unit radius along Z instead.
    expect(body.getPosition().z).toBeGreaterThan(50);
    expect(body.getPosition().z).toBeLessThan(100);
    expect(body.getPosition().z).toBeCloseTo(60, 1);

    world.dispose();
  });

  it('accepts convex descriptors through the public body API', () => {
    const world = new PhysicsWorld();
    const body = world.createBody({
      shape: {
        type: 'convex',
        vertices: [
          { x: 1, y: 1, z: 1 },
          { x: -1, y: -1, z: 1 },
          { x: -1, y: 1, z: -1 },
          { x: 1, y: -1, z: -1 }
        ],
        faces: [
          [0, 1, 2],
          [0, 3, 1],
          [0, 2, 3],
          [1, 3, 2]
        ]
      },
      mass: 1
    });

    expect(body.mass).toBe(1);
    world.step(1 / 60);

    world.dispose();
  });
});
