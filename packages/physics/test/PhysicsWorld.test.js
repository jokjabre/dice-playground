import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GRAVITY,
  DEFAULT_MASS,
  PhysicsWorld,
  createCannonEsBackend
} from '../src/index.js';

const identity = Object.freeze({ x: 0, y: 0, z: 0, w: 1 });

/**
 * @param {PhysicsWorld} world
 * @param {string} [material]
 */
function createDeskPlane(world, material = 'desk') {
  return world.createBody({
    id: `${material}-plane`,
    shape: { type: 'plane', normal: { x: 0, y: 0, z: 1 } },
    mass: 0,
    material
  });
}

describe('PhysicsWorld', () => {
  it('applies the authoritative legacy defaults', () => {
    const world = new PhysicsWorld();

    expect(DEFAULT_GRAVITY).toEqual({ x: 0, y: 0, z: -2940 });
    expect(DEFAULT_MASS).toBe(300);
    expect(world.getGravity()).toEqual(DEFAULT_GRAVITY);
    expect(world.getContactMaterial('die', 'desk')).toEqual({
      friction: 0.01,
      restitution: 0.5
    });

    world.dispose();
  });

  it('changes gravity dynamically for a falling body', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: 0, z: 0 } });
    const body = world.createBody({
      shape: { type: 'sphere', radius: 10 },
      mass: 1,
      transform: { position: { x: 0, y: 0, z: 100 }, quaternion: identity }
    });

    for (let i = 0; i < 30; i++) world.step(1 / 60);
    expect(body.getPosition().z).toBeCloseTo(100, 5);

    world.setGravity(0, 0, -980);
    expect(world.getGravity()).toEqual({ x: 0, y: 0, z: -980 });

    for (let i = 0; i < 30; i++) world.step(1 / 60);
    expect(body.getPosition().z).toBeLessThan(100);
    expect(body.getVelocity().z).toBeLessThan(0);

    world.dispose();
  });

  it('contains a dropping body on a static plane', () => {
    const world = new PhysicsWorld();
    createDeskPlane(world);

    const body = world.createBody({
      shape: { type: 'sphere', radius: 10 },
      mass: 300,
      transform: { position: { x: 0, y: 0, z: 200 }, quaternion: identity }
    });

    for (let i = 0; i < 120; i++) world.step(1 / 60);

    expect(body.getPosition().z).toBeCloseTo(9.91, 1);
    expect(Math.abs(body.getVelocity().z)).toBeLessThan(0.01);

    world.dispose();
  });

  it('updates and introspects named contact materials at runtime', () => {
    const world = new PhysicsWorld();

    expect(world.getMaterialNames()).toEqual(
      expect.arrayContaining([
        'die',
        'desk',
        'screen',
        'barrier_left',
        'barrier_right',
        'barrier_top',
        'barrier_bottom',
        'sphere_boundary',
        'glass_boundary'
      ])
    );

    world.setContactMaterial('die', 'desk', {
      friction: 0.4,
      restitution: 0.2
    });
    expect(world.getContactMaterial('die', 'desk')).toEqual({
      friction: 0.4,
      restitution: 0.2
    });
    expect(world.getContactMaterial('desk', 'die')).toEqual({
      friction: 0.4,
      restitution: 0.2
    });

    world.setFriction('die', 'desk', 0.7);
    expect(world.getContactMaterial('die', 'desk')).toEqual({
      friction: 0.7,
      restitution: 0.2
    });

    world.setRestitution('die', 'desk', 0.9);
    expect(world.getContactMaterial('die', 'desk')).toEqual({
      friction: 0.7,
      restitution: 0.9
    });

    expect(world.getContactMaterial('die', 'unknown')).toBeNull();

    expect(() => world.setSolverIterations(0)).toThrow(/at least 1/);
    expect(() => world.setSolverIterations(32)).not.toThrow();

    world.dispose();
  });

  it('supports body add/remove, snapshots, mass, damping, impulses, and disposal', () => {
    const world = new PhysicsWorld();
    const body = world.createBody({
      id: 'die-1',
      shape: { type: 'sphere', radius: 10 },
      mass: 10,
      transform: { position: { x: 1, y: 2, z: 3 }, quaternion: identity }
    });

    expect(world.getBodies()).toHaveLength(1);
    expect(body.id).toBe('die-1');
    expect(body.isStatic).toBe(false);
    expect(body.getTransform()).toEqual({
      position: { x: 1, y: 2, z: 3 },
      quaternion: identity
    });

    const snapshot = body.getPosition();
    snapshot.x = 999;
    expect(body.getPosition().x).toBe(1);

    body.setTransform({
      position: { x: 4, y: 5, z: 6 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    expect(body.getPosition()).toEqual({ x: 4, y: 5, z: 6 });

    body.setMass(20);
    expect(body.mass).toBe(20);
    body.setDamping(0.2, 0.3);
    expect(body.getDamping()).toEqual({ linear: 0.2, angular: 0.3 });

    body.applyImpulse({ x: 200, y: 0, z: 0 });
    expect(body.getVelocity().x).toBeCloseTo(10, 10);

    world.removeBody(body);
    expect(world.getBodies()).toHaveLength(0);
    expect(() => world.removeBody(body)).not.toThrow();

    world.dispose();
    world.dispose();
    expect(() => world.createBody({ shape: { type: 'sphere', radius: 1 } })).toThrow(
      /disposed/
    );
  });

  it('runs and removes post-step callbacks', () => {
    const world = new PhysicsWorld();
    /** @type {Array<{ world: PhysicsWorld, dt: number }>} */
    const calls = [];

    const unsubscribe = world.addPostStep((currentWorld, dt) => {
      calls.push({ world: currentWorld, dt });
    });

    world.step(1 / 60);
    expect(calls).toHaveLength(1);
    expect(calls[0].world).toBe(world);
    expect(calls[0].dt).toBeCloseTo(1 / 60);

    unsubscribe();
    world.step(1 / 60);
    expect(calls).toHaveLength(1);

    world.dispose();
  });

  it('accepts an injected backend and keeps backend objects private', () => {
    const backend = createCannonEsBackend();
    const world = new PhysicsWorld({ backend });
    const body = world.createBody({ shape: { type: 'sphere', radius: 5 } });

    for (const value of [
      body.getPosition(),
      body.getQuaternion(),
      body.getVelocity(),
      body.getAngularVelocity()
    ]) {
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    }

    expect(Object.getOwnPropertyNames(body)).toEqual(['id']);
    expect('instance' in world).toBe(false);
    expect('world' in world).toBe(false);
    expect('backend' in world).toBe(false);

    world.dispose();
  });

  it('rejects invalid bodies, shapes, and deltas', () => {
    const world = new PhysicsWorld();

    expect(() => world.createBody(/** @type {any} */ ({}))).toThrow(
      /shape descriptor/
    );
    expect(() =>
      world.createBody({ shape: { type: 'sphere', radius: -1 } })
    ).toThrow(/greater than zero/);
    expect(() => world.step(0)).toThrow(/positive delta time/);

    world.dispose();
  });
});
