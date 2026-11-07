import { describe, expect, it } from 'vitest';

import {
  BoxEnclosure,
  CylinderEnclosure,
  ENCLOSURE_IDS,
  SphereEnclosure,
  createEnclosure,
  getEnclosureDefinition
} from '../src/index.js';
import { createFakePhysicsWorld, createFakeRenderScene } from './fakes.js';

const metrics = {
  containerWidth: 1000,
  containerHeight: 600,
  sceneWidth: 500,
  sceneHeight: 300,
  scale: 45,
  aspect: 1,
  wallHeight: 1000,
  pixelRatio: 1
};

const wideMetrics = {
  ...metrics,
  containerWidth: 1600,
  containerHeight: 1000,
  sceneWidth: 800,
  sceneHeight: 500,
  scale: 50
};

/**
 * @param {any} physics
 * @param {{ x: number, y: number, z: number }} position
 * @param {{ x: number, y: number, z: number }} [velocity]
 * @returns {any}
 */
function createDie(physics, position, velocity = { x: 0, y: 0, z: 0 }) {
  const body = physics.createBody({
    id: 'die-1',
    shape: { type: 'sphere', radius: 20 },
    mass: 300,
    transform: {
      position,
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    }
  });

  body.setVelocity(velocity);
  return body;
}

describe('box enclosure', () => {
  it('contains a falling die for a fixed number of headless steps', () => {
    const physics = createFakePhysicsWorld();
    const enclosure = new BoxEnclosure();

    enclosure.createPhysics(physics, metrics);
    expect(physics.getBodies()).toHaveLength(6);

    const die = createDie(physics, { x: 0, y: 0, z: 200 }, {
      x: 2500,
      y: 1500,
      z: 0
    });

    for (let step = 0; step < 240; step += 1) {
      physics.step(1 / 60);
    }

    const position = die.getPosition();
    const bounds = { halfWidth: 465, halfHeight: 279, ceilingHeight: 2700 };

    expect(position.x).toBeLessThanOrEqual(bounds.halfWidth);
    expect(position.x).toBeGreaterThanOrEqual(-bounds.halfWidth);
    expect(position.y).toBeLessThanOrEqual(bounds.halfHeight);
    expect(position.y).toBeGreaterThanOrEqual(-bounds.halfHeight);
    expect(position.z).toBeGreaterThanOrEqual(0);
    expect(position.z).toBeLessThanOrEqual(bounds.ceilingHeight);

    enclosure.dispose();
    expect(
      physics
        .getBodies()
        .map((/** @type {any} */ body) => body.id)
    ).toEqual(['die-1']);
  });

  it('omits the ceiling body when the ceiling is disabled', () => {
    const physics = createFakePhysicsWorld();
    const enclosure = new BoxEnclosure({ ceiling: false });

    enclosure.createPhysics(physics, metrics);

    const ids = physics.getBodies().map((/** @type {any} */ body) => body.id);
    expect(ids).toHaveLength(5);
    expect(ids.some((/** @type {string} */ id) => id.endsWith('screen'))).toBe(
      false
    );

    enclosure.dispose();
  });
});

describe('sphere enclosure', () => {
  it('contains a falling die for a fixed number of headless steps', () => {
    const physics = createFakePhysicsWorld();
    const enclosure = new SphereEnclosure({
      radius: 400,
      dieRadius: 40,
      segments: 32
    });

    enclosure.createPhysics(physics, metrics);

    const die = createDie(physics, { x: 0, y: 0, z: 300 });

    for (let step = 0; step < 240; step += 1) {
      physics.step(1 / 60);
    }

    const position = die.getPosition();
    const distance = Math.hypot(position.x, position.y, position.z);

    expect(distance).toBeLessThanOrEqual(358 + 1e-6);

    enclosure.dispose();
  });

  it('reflects outward radial velocity at the containment boundary', () => {
    const physics = createFakePhysicsWorld({ gravity: { x: 0, y: 0, z: 0 } });
    const enclosure = new SphereEnclosure({
      radius: 400,
      dieRadius: 40,
      segments: 20
    });

    enclosure.createPhysics(physics, metrics);

    const die = createDie(
      physics,
      { x: 0, y: 0, z: 400 },
      { x: 0, y: 0, z: 1000 }
    );

    const callbacks = [...physics.postSteps];
    expect(callbacks).toHaveLength(1);
    callbacks[0](physics, 1 / 60);

    const position = die.getPosition();
    const distance = Math.hypot(position.x, position.y, position.z);

    expect(distance).toBeCloseTo(358, 6);
    expect(die.getVelocity().z).toBeLessThan(0);

    enclosure.dispose();
    expect(physics.postSteps.size).toBe(0);
  });
});

describe('cylinder enclosure', () => {
  it('contains a falling die for a fixed number of headless steps', () => {
    const physics = createFakePhysicsWorld();
    const enclosure = new CylinderEnclosure({ segments: 16 });

    enclosure.createPhysics(physics, metrics);

    const die = createDie(physics, { x: 0, y: 0, z: 300 }, {
      x: 1500,
      y: 1200,
      z: 0
    });

    for (let step = 0; step < 240; step += 1) {
      physics.step(1 / 60);
    }

    const position = die.getPosition();
    const radialDistance = Math.hypot(position.x, position.y);

    expect(radialDistance).toBeLessThanOrEqual(200);
    expect(position.z).toBeGreaterThanOrEqual(0);

    enclosure.dispose();
  });

  it('moves wall bodies and visuals together when metrics change', () => {
    const physics = createFakePhysicsWorld();
    const renderScene = createFakeRenderScene();
    const enclosure = new CylinderEnclosure({ segments: 16 });

    enclosure.createPhysics(physics, metrics);
    enclosure.createVisuals(renderScene, metrics);

    expect(physics.getBodies()).toHaveLength(17);
    expect(renderScene.visuals).toHaveLength(1);

    const wallBefore = physics
      .getBodies()
      .find((/** @type {any} */ body) => body.id.endsWith('wall-0'));
    expect(
      Math.hypot(wallBefore.position.x, wallBefore.position.y)
    ).toBeCloseTo(200, 6);
    expect(wallBefore.position.z).toBeCloseTo(300, 6);
    expect(renderScene.visuals[0].descriptor).toMatchObject({
      type: 'cylinder-shell',
      radius: 200,
      height: 600
    });
    expect(renderScene.visuals[0].position.z).toBeCloseTo(300, 6);

    enclosure.update(wideMetrics);

    const wallAfter = physics
      .getBodies()
      .find((/** @type {any} */ body) => body.id.endsWith('wall-0'));
    expect(Math.hypot(wallAfter.position.x, wallAfter.position.y)).toBeCloseTo(
      225,
      6
    );
    expect(wallAfter.position.z).toBeCloseTo(350, 6);
    expect(physics.getBodies()).toHaveLength(17);
    expect(renderScene.visuals).toHaveLength(1);
    expect(renderScene.visuals[0].descriptor).toMatchObject({
      type: 'cylinder-shell',
      radius: 225,
      height: 700
    });
    expect(renderScene.visuals[0].position.z).toBeCloseTo(350, 6);

    enclosure.dispose();
    expect(physics.getBodies()).toHaveLength(0);
    expect(renderScene.visuals).toHaveLength(0);
  });
});

describe('enclosure lifecycle', () => {
  it('leaves no stale bodies or visuals when switching enclosures', () => {
    const physics = createFakePhysicsWorld();
    const renderScene = createFakeRenderScene();

    const box = new BoxEnclosure();
    box.createPhysics(physics, metrics);
    box.createVisuals(renderScene, metrics);

    expect(renderScene.visuals[0].descriptor.type).toBe('box-outline');

    box.dispose();
    expect(physics.getBodies()).toHaveLength(0);
    expect(renderScene.visuals).toHaveLength(0);

    const sphere = new SphereEnclosure({ segments: 20 });
    sphere.createPhysics(physics, metrics);
    sphere.createVisuals(renderScene, metrics);

    expect(
      physics
        .getBodies()
        .every((/** @type {any} */ body) => body.id.startsWith('enclosure-wall-'))
    ).toBe(true);
    expect(renderScene.visuals[0].descriptor.type).toBe('sphere-shell');

    sphere.dispose();
    expect(physics.getBodies()).toHaveLength(0);
    expect(physics.postSteps.size).toBe(0);
    expect(renderScene.visuals).toHaveLength(0);
  });

  it('exposes built-in definitions and rejects unknown ids', () => {
    expect(ENCLOSURE_IDS).toEqual(['box', 'sphere', 'cylinder']);
    expect(getEnclosureDefinition('box').type).toBe('box');
    expect(getEnclosureDefinition('sphere').label).toBe('Sphere');
    expect(() => getEnclosureDefinition('pyramid')).toThrow(
      /Unknown enclosure id/
    );

    expect(createEnclosure('cylinder')).toBeInstanceOf(CylinderEnclosure);
    expect(createEnclosure('box')).toBeInstanceOf(BoxEnclosure);
    expect(() =>
      createEnclosure(
        /** @type {any} */ ({ id: 'pyramid', type: 'pyramid' })
      )
    ).toThrow(/Unknown enclosure type/);
  });
});
