import { quat } from '@dice/core';
import { describe, expect, it, vi } from 'vitest';

import { D6, DiceEntity, createFaceMapping } from '../src/index.js';

const identity = quat.identity();

/**
 * @param {{ x: number, y: number, z: number, w: number }} [initialQuaternion]
 */
function createBody(initialQuaternion = identity) {
  let position = { x: 0, y: 0, z: 10 };
  let quaternion = initialQuaternion;

  return {
    getPosition: () => ({ ...position }),
    getQuaternion: () => ({ ...quaternion }),
    /**
     * @param {{ position?: { x: number, y: number, z: number }, quaternion?: { x: number, y: number, z: number, w: number } }} transform
     */
    setTransform(transform) {
      if (transform.position) position = { ...transform.position };
      if (transform.quaternion) quaternion = { ...transform.quaternion };
    }
  };
}

function createVisual() {
  return {
    setFaceMapping: vi.fn(),
    setTransform: vi.fn(),
    dispose: vi.fn()
  };
}

describe('DiceEntity', () => {
  it('requires an id assigned by the world and a definition', () => {
    expect(
      () => new DiceEntity(/** @type {any} */ ({ definition: D6 }))
    ).toThrow(/non-empty id/);
    expect(
      () => new DiceEntity(/** @type {any} */ ({ id: 'die-1' }))
    ).toThrow(/die definition/);
  });

  it('starts with the identity mapping, idle state, and unselected', () => {
    const entity = new DiceEntity({
      id: 'die-1-1',
      definition: D6,
      body: createBody(),
      visual: createVisual()
    });

    expect(entity.faceMapping).toEqual(createFaceMapping(D6));
    expect(entity.state).toBe('idle');
    expect(entity.selected).toBe(false);
    expect(entity.value).toBe(6);
  });

  it('reads the value through the body quaternion and current mapping', () => {
    const body = createBody(quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI));
    const entity = new DiceEntity({
      id: 'die-1-1',
      definition: D6,
      body,
      faceMapping: [1, 2, 3, 4, 5, 6]
    });

    expect(entity.value).toBe(1);

    entity.setFaceMapping([6, 5, 4, 3, 2, 1]);
    expect(entity.value).toBe(6);
  });

  it('pushes mapping changes and transforms through the visual handle', () => {
    const visual = createVisual();
    const entity = new DiceEntity({
      id: 'die-1-1',
      definition: D6,
      body: createBody(),
      visual
    });

    entity.setFaceMapping([6, 5, 4, 3, 2, 1]);
    expect(visual.setFaceMapping).toHaveBeenCalledWith([6, 5, 4, 3, 2, 1]);

    entity.sync();
    expect(visual.setTransform).toHaveBeenCalledWith({
      position: { x: 0, y: 0, z: 10 },
      quaternion: identity
    });
  });

  it('resets its transform and returns to idle', () => {
    const body = createBody();
    const entity = new DiceEntity({ id: 'die-1-1', definition: D6, body });
    entity.state = 'settled';

    entity.reset({
      position: { x: 5, y: 0, z: 20 },
      quaternion: quat.fromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)
    });

    expect(entity.state).toBe('idle');
    expect(body.getPosition()).toEqual({ x: 5, y: 0, z: 20 });
    expect(entity.value).toBe(5);
  });

  it('disposes the visual once, clears selection, and becomes removed', () => {
    const visual = createVisual();
    const entity = new DiceEntity({
      id: 'die-1-1',
      definition: D6,
      body: createBody(),
      visual,
      selected: true
    });

    entity.dispose();
    entity.dispose();

    expect(visual.dispose).toHaveBeenCalledTimes(1);
    expect(entity.selected).toBe(false);
    expect(entity.state).toBe('removed');
    expect(entity.visual).toBeNull();
    expect(entity.value).toBeNull();
  });

  it('validates a supplied face mapping', () => {
    expect(
      () =>
        new DiceEntity({
          id: 'die-1-1',
          definition: D6,
          faceMapping: [1, 2, 3]
        })
    ).toThrow(/exactly 6 entries/);
  });
});
