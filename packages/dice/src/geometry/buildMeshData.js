import { vec3 } from '@dice/core';

import { chamferGeometry } from './chamfer.js';

/**
 * @typedef {import('../definitions/D6.js').DieDefinition} DieDefinition
 * @typedef {import('../definitions/D6.js').Vec3} Vec3
 */

/**
 * @typedef {Object} DiceUV
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} DiceMeshFace
 * @property {number} faceIndex Geometric face index, or `-1` for chamfer triangles.
 * @property {number[]} indices Triangle vertex indices.
 * @property {number} materialSlot Default material slot: `0` for chamfer, `1..N` for labels.
 * @property {Vec3} normal Outward unit normal.
 * @property {DiceUV[]} uvs Three UV coordinates matching `indices`.
 */

/**
 * @typedef {Object} DiceMeshData
 * @property {Vec3[]} vertices
 * @property {DiceMeshFace[]} faces
 * @property {number} boundingRadius
 */

const UV_TAB = 0.1;
const UV_ANGLE_OFFSET = Math.PI / 4;

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
 * @param {number} angle
 * @returns {DiceUV}
 */
function circularUv(angle) {
  return {
    x: (Math.cos(angle) + 1 + UV_TAB) / 2 / (1 + UV_TAB),
    y: (Math.sin(angle) + 1 + UV_TAB) / 2 / (1 + UV_TAB)
  };
}

/**
 * @param {Vec3[]} vertices
 * @param {number[]} indices
 * @returns {Vec3}
 */
function triangleNormal(vertices, indices) {
  const a = vertices[indices[0]];
  const b = vertices[indices[1]];
  const c = vertices[indices[2]];
  return vec3.normalize(
    vec3.cross(vec3.subtract(b, a), vec3.subtract(c, a))
  );
}

/**
 * @param {Vec3[]} vertices
 * @param {number[]} indices
 * @returns {Vec3}
 */
function triangleCentroid(vertices, indices) {
  return vec3.scale(
    vec3.add(vec3.add(vertices[indices[0]], vertices[indices[1]]), vertices[indices[2]]),
    1 / 3
  );
}

/**
 * Build renderer-agnostic mesh data for a die definition.
 *
 * Every triangle carries the stable geometric `faceIndex`. Chamfer triangles
 * use `faceIndex: -1` and `materialSlot: 0`; base triangles carry the default
 * material slot for their label. Winding is normalized so every normal points
 * away from the die center.
 *
 * @param {DieDefinition} definition
 * @param {{ radius?: number }} [options]
 * @returns {DiceMeshData}
 */
export function createDiceMeshData(definition, options = {}) {
  const radius = positiveRadius(options.radius);
  const chamfered = chamferGeometry(definition);
  const vertices = chamfered.vertices.map((vertex) => vec3.scale(vertex, radius));

  const labels = Array.from(
    new Set(definition.faces.map((face) => face.defaultLabel))
  ).sort((a, b) => a - b);
  /** @type {Map<number, number>} */
  const slotByLabel = new Map(labels.map((label, index) => [label, index + 1]));

  /** @type {DiceMeshFace[]} */
  const faces = [];

  for (const face of chamfered.faces) {
    const count = face.indices.length;
    const angleStep = (Math.PI * 2) / count;
    const sourceFace = face.faceIndex >= 0 ? definition.faces[face.faceIndex] : null;
    const materialSlot = sourceFace ? slotByLabel.get(sourceFace.defaultLabel) : 0;

    if (sourceFace && materialSlot === undefined) {
      throw new Error(
        `Die definition "${definition.id}" face ${sourceFace.index} has an unregistered default label.`
      );
    }

    for (let j = 0; j < count - 2; j++) {
      let indices = [
        face.indices[0],
        face.indices[j + 1],
        face.indices[j + 2]
      ];
      let uvs = [
        circularUv(UV_ANGLE_OFFSET),
        circularUv(angleStep * (j + 1) + UV_ANGLE_OFFSET),
        circularUv(angleStep * (j + 2) + UV_ANGLE_OFFSET)
      ];

      let normal = triangleNormal(vertices, indices);
      if (vec3.isZero(normal)) {
        throw new Error(`Degenerate triangle in face ${face.faceIndex}.`);
      }

      if (vec3.dot(normal, triangleCentroid(vertices, indices)) < 0) {
        indices = [indices[0], indices[2], indices[1]];
        uvs = [uvs[0], uvs[2], uvs[1]];
        normal = vec3.negate(normal);
      }

      faces.push({
        faceIndex: face.faceIndex,
        indices,
        materialSlot: materialSlot ?? 0,
        normal,
        uvs
      });
    }
  }

  return {
    vertices,
    faces,
    boundingRadius: radius
  };
}
