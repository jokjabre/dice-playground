import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CONTACT_MATERIALS,
  DEFAULT_GRAVITY,
  DEFAULT_MASS,
  PhysicsWorld
} from '../src/index.js';
import { DROP_SETTLE_FIXTURE, LEGACY_PHYSICS_TUNING } from './fixtures/legacy-parity.js';

describe('legacy parity', () => {
  it('keeps the legacy gravity, mass, friction, and restitution tables', () => {
    expect(DEFAULT_GRAVITY).toEqual(LEGACY_PHYSICS_TUNING.gravity);
    expect(DEFAULT_MASS).toBe(LEGACY_PHYSICS_TUNING.dieMass);

    for (const [surface, friction] of Object.entries(
      LEGACY_PHYSICS_TUNING.dieFriction
    )) {
      const contact = DEFAULT_CONTACT_MATERIALS[`die:${surface}`];
      expect(contact.friction).toBe(friction);
    }

    for (const [surface, restitution] of Object.entries(
      LEGACY_PHYSICS_TUNING.dieRestitution
    )) {
      const contact = DEFAULT_CONTACT_MATERIALS[`die:${surface}`];
      expect(contact.restitution).toBe(restitution);
    }

    expect(DEFAULT_CONTACT_MATERIALS['die:sphere_boundary'].restitution).toBe(0.6);
  });

  it('captures the drop/settle fixture behavior', () => {
    const world = new PhysicsWorld();
    world.createBody({
      id: 'desk',
      shape: { type: 'plane', normal: { x: 0, y: 0, z: 1 } },
      mass: 0,
      material: 'desk'
    });
    const body = world.createBody({
      shape: { type: 'sphere', radius: DROP_SETTLE_FIXTURE.radius },
      mass: DEFAULT_MASS,
      transform: {
        position: { x: 0, y: 0, z: DROP_SETTLE_FIXTURE.startHeight },
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
      }
    });

    for (let frame = 0; frame < DROP_SETTLE_FIXTURE.frames; frame++) {
      world.step(DROP_SETTLE_FIXTURE.fixedStep);
    }

    expect(body.getPosition().z).toBeCloseTo(
      DROP_SETTLE_FIXTURE.expectedRestHeight,
      1
    );
    expect(
      Math.abs(body.getPosition().z - DROP_SETTLE_FIXTURE.expectedRestHeight)
    ).toBeLessThan(DROP_SETTLE_FIXTURE.heightTolerance);
    expect(Math.abs(body.getVelocity().z)).toBeLessThan(
      DROP_SETTLE_FIXTURE.velocityTolerance
    );

    world.dispose();
  });
});
