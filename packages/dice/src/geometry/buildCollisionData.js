import { vec3 } from '@dice/core';

/**
 * @typedef {import('../definitions/D6.js').DieDefinition} DieDefinition
 * @typedef {import('../definitions/D6.js').Vec3} Vec3
 */

/**
 * @typedef {Object} DiceCollisionData
 * @property {'convex'} type
 * @property {Vec3[]} vertices
 * @property {number[][]} faces
 * @property {number[]} faceIndices Geometric face index for each collision face.
 * @property {number} boundingRadius
 */

/**
 * @param {unknown} radius
 * @returns {number}
 */
function positiveRadius(radius) {
  if (typeof radius !== 'number' || !Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('radius must be a finite number greater than zero.');
  }
  return radius;
}

/**
 * Build a backend-neutral convex collision descriptor for a die definition.
 *
 * The descriptor uses the un-chamfered base polyhedron, matching the legacy
 * physics shape while staying independent of Cannon. Physics converts it to its
 * native convex shape.
 *
 * @param {DieDefinition} definition
 * @param {{ radius?: number }} [options]
 * @returns {DiceCollisionData}
 */
export function createDiceCollisionData(definition, options = {}) {
  const radius = positiveRadius(options.radius);

  return {
    type: 'convex',
    vertices: definition.vertices.map((vertex) =>
      vec3.scale(vec3.normalize(vertex), radius)
    ),
    faces: definition.faces.map((face) => face.indices.slice()),
    faceIndices: definition.faces.map((face) => face.index),
    boundingRadius: radius
  };
}
