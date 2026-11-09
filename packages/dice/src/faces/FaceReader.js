import { quat, vec3 } from '@dice/core';

import { createFaceMapping, getFaceLabel } from './faceMapping.js';

/**
 * @typedef {import('../definitions/D6.js').DieDefinition} DieDefinition
 * @typedef {import('../definitions/D6.js').Vec3} Vec3
 */

/**
 * @typedef {Object} Quaternion
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @typedef {Object} DiceLike
 * @property {DieDefinition} definition
 * @property {number[]} [faceMapping]
 * @property {{ getQuaternion?: () => Quaternion }} [body]
 * @property {Quaternion} [quaternion]
 */

const DEFAULT_UP = Object.freeze({ x: 0, y: 0, z: 1 });

/**
 * Reads the face pointing most closely at a configurable up vector from a
 * physics body quaternion. It never traverses meshes or imports a renderer.
 */
export class FaceReader {
  /**
   * @param {DieDefinition} definition
   * @param {Quaternion} [quaternion]
   * @param {Vec3} [up]
   * @returns {number}
   */
  static getTopFace(definition, quaternion = quat.identity(), up = DEFAULT_UP) {
    const direction = vec3.normalize(up);
    if (vec3.isZero(direction)) {
      throw new RangeError('FaceReader up vector must not be the zero vector.');
    }

    let topFace = -1;
    let closest = -Infinity;

    for (const face of definition.faces) {
      const normal = quat.rotateVec3(quaternion, vec3.normalize(face.normal));
      const alignment = vec3.dot(normal, direction);

      if (alignment > closest) {
        closest = alignment;
        topFace = face.index;
      }
    }

    if (topFace < 0) {
      throw new Error(`Die definition "${definition.id}" has no faces.`);
    }

    return topFace;
  }

  /**
   * @param {DieDefinition} definition
   * @param {Quaternion} [quaternion]
   * @param {number[]} [faceMapping]
   * @param {Vec3} [up]
   * @returns {number}
   */
  static getValue(
    definition,
    quaternion = quat.identity(),
    faceMapping = createFaceMapping(definition),
    up = DEFAULT_UP
  ) {
    const topFace = FaceReader.getTopFace(definition, quaternion, up);
    return getFaceLabel(definition, faceMapping, topFace);
  }

  /**
   * @param {Array<DiceLike | null | undefined>} dice
   * @param {Vec3} [up]
   * @returns {number[]}
   */
  static getValues(dice, up = DEFAULT_UP) {
    return dice.map((die) => {
      if (!die || !die.definition) {
        throw new TypeError('FaceReader.getValues requires dice with a definition.');
      }

      return FaceReader.getValue(
        die.definition,
        FaceReader.getQuaternion(die),
        die.faceMapping ?? createFaceMapping(die.definition),
        up
      );
    });
  }

  /**
   * @param {DiceLike | null | undefined} die
   * @returns {Quaternion}
   */
  static getQuaternion(die) {
    const source = /** @type {any} */ (die);

    if (source && typeof source.getQuaternion === 'function') {
      return source.getQuaternion();
    }

    if (source && source.body && typeof source.body.getQuaternion === 'function') {
      return source.body.getQuaternion();
    }

    if (source && source.quaternion) {
      return source.quaternion;
    }

    return quat.identity();
  }
}
