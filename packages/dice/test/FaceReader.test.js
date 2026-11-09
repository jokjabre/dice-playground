import { quat } from '@dice/core';
import { describe, expect, it } from 'vitest';

import { D6, FaceReader, createFaceMapping } from '../src/index.js';

const identity = quat.identity();
const mapping = createFaceMapping(D6);

/**
 * @param {number} dx
 * @param {number} dy
 * @param {number} dz
 * @param {number} angle
 * @returns {{ x: number, y: number, z: number, w: number }}
 */
function axisAngle(dx, dy, dz, angle) {
  return quat.fromAxisAngle({ x: dx, y: dy, z: dz }, angle);
}

describe('FaceReader', () => {
  it('reads the top face from a body quaternion', () => {
    // With no rotation the +Z face (geometric face 5) points up.
    expect(FaceReader.getTopFace(D6, identity)).toBe(5);
    expect(FaceReader.getValue(D6, identity, mapping)).toBe(6);

    // 180 degrees around X turns the -Z face (geometric face 0) upward.
    expect(FaceReader.getValue(D6, axisAngle(1, 0, 0, Math.PI), mapping)).toBe(1);

    // 90 degrees around X turns the +Y face (geometric face 3) upward.
    expect(FaceReader.getValue(D6, axisAngle(1, 0, 0, Math.PI / 2), mapping)).toBe(4);

    // 90 degrees around Y turns the -X face (geometric face 4) upward.
    expect(FaceReader.getValue(D6, axisAngle(0, 1, 0, Math.PI / 2), mapping)).toBe(5);

    // -90 degrees around Y turns the +X face (geometric face 1) upward.
    expect(FaceReader.getValue(D6, axisAngle(0, 1, 0, -Math.PI / 2), mapping)).toBe(2);
  });

  it('matches legacy material labels for known quaternions', () => {
    const goldens = [
      { quaternion: identity, label: 6 },
      { quaternion: axisAngle(1, 0, 0, Math.PI / 2), label: 4 },
      { quaternion: axisAngle(1, 0, 0, Math.PI), label: 1 },
      { quaternion: axisAngle(0, 1, 0, Math.PI / 2), label: 5 }
    ];

    for (const { quaternion, label } of goldens) {
      const topFace = FaceReader.getTopFace(D6, quaternion);
      expect(D6.faces[topFace].defaultLabel).toBe(label);
    }
  });

  it('respects an alternate up vector', () => {
    expect(
      FaceReader.getValue(D6, identity, mapping, { x: 0, y: 0, z: -1 })
    ).toBe(1);
    expect(
      FaceReader.getValue(D6, identity, mapping, { x: 1, y: 0, z: 0 })
    ).toBe(2);
  });

  it('reads values from dice-like objects', () => {
    const dice = [
      {
        definition: D6,
        faceMapping: mapping,
        body: { getQuaternion: () => identity }
      },
      {
        definition: D6,
        faceMapping: mapping,
        quaternion: axisAngle(1, 0, 0, Math.PI)
      }
    ];

    expect(FaceReader.getValues(dice)).toEqual([6, 1]);
  });

  it('rejects a zero up vector and malformed dice', () => {
    expect(() =>
      FaceReader.getTopFace(D6, identity, { x: 0, y: 0, z: 0 })
    ).toThrow(/zero vector/);
    expect(() =>
      FaceReader.getValues([/** @type {any} */ (null)])
    ).toThrow(/requires dice with a definition/);
  });
});
