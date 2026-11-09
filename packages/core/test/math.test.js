import { describe, expect, it } from 'vitest';

import { quat, vec3 } from '../src/index.js';

describe('vec3', () => {
  it('performs arithmetic without mutating inputs', () => {
    const a = { x: 1, y: 2, z: 3 };
    const b = { x: 4, y: 5, z: 6 };

    expect(vec3.add(a, b)).toEqual({ x: 5, y: 7, z: 9 });
    expect(vec3.subtract(b, a)).toEqual({ x: 3, y: 3, z: 3 });
    expect(vec3.scale(a, 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(vec3.dot(a, b)).toBe(32);
    expect(vec3.cross(a, b)).toEqual({ x: -3, y: 6, z: -3 });
    expect(a).toEqual({ x: 1, y: 2, z: 3 });
    expect(b).toEqual({ x: 4, y: 5, z: 6 });
  });

  it('computes length, normalization, distance, and equality', () => {
    const vector = { x: 3, y: 4, z: 0 };
    const normalized = vec3.normalize(vector);

    expect(vec3.length(vector)).toBe(5);
    expect(vec3.length(normalized)).toBeCloseTo(1);
    expect(vec3.distance(vector, { x: 0, y: 0, z: 0 })).toBe(5);
    expect(vec3.equals(vector, { x: 3, y: 4, z: 0 })).toBe(true);
    expect(vec3.equals(vector, { x: 3, y: 4, z: 0.001 })).toBe(false);
    expect(vec3.normalize({ x: 0, y: 0, z: 0 })).toEqual({
      x: 0,
      y: 0,
      z: 0
    });
  });
});

describe('quat', () => {
  it('rotates vectors around an axis', () => {
    const rotation = quat.fromAxisAngle({ x: 0, y: 0, z: 1 }, Math.PI / 2);
    const rotated = quat.rotateVec3(rotation, { x: 1, y: 0, z: 0 });

    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
    expect(rotated.z).toBeCloseTo(0);
  });

  it('normalizes, inverts, and interpolates quaternions', () => {
    const rotation = quat.fromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 3);
    const normalized = quat.normalize(rotation);
    const inverted = quat.invert(normalized);
    const halfway = quat.slerp(quat.identity(), rotation, 0.5);

    expect(quat.length(normalized)).toBeCloseTo(1);
    expect(quat.equals(quat.multiply(normalized, inverted), quat.identity())).toBe(
      true
    );
    expect(quat.length(halfway)).toBeCloseTo(1);
  });
});
