import { vec3 } from '@dice/core';

import { DEFAULT_CYLINDER_SEGMENTS } from './config/defaults.js';

/**
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} PlaneShapeDescriptor
 * @property {'plane'} type
 * @property {Vec3Like} normal
 */

/**
 * @typedef {Object} BoxShapeDescriptor
 * @property {'box'} type
 * @property {Vec3Like} halfExtents
 */

/**
 * @typedef {Object} SphereShapeDescriptor
 * @property {'sphere'} type
 * @property {number} radius
 */

/**
 * @typedef {Object} ConvexShapeDescriptor
 * @property {'convex'} type
 * @property {Vec3Like[]} vertices
 * @property {number[][]} faces
 */

/**
 * @typedef {Object} CylinderShapeDescriptor
 * @property {'cylinder'} type
 * @property {number} radius
 * @property {number} height
 * @property {number} [segments]
 * @property {'x'|'y'|'z'} [axis]
 */

/**
 * @typedef {PlaneShapeDescriptor|BoxShapeDescriptor|SphereShapeDescriptor|ConvexShapeDescriptor|CylinderShapeDescriptor} ShapeDescriptor
 */

export const SHAPE_TYPES = Object.freeze([
  'plane',
  'box',
  'sphere',
  'convex',
  'cylinder'
]);

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function positiveNumber(value, label) {
  const number = finiteNumber(value, label);
  if (number <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }
  return number;
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Vec3Like}
 */
function vector(value, label) {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`${label} must be a vector with x, y, and z.`);
  }

  const source = /** @type {Record<string, unknown>} */ (value);
  return {
    x: finiteNumber(source.x, `${label}.x`),
    y: finiteNumber(source.y, `${label}.y`),
    z: finiteNumber(source.z, `${label}.z`)
  };
}

/**
 * Normalize a shape descriptor into a fresh, validated plain-data object.
 * Inputs are never mutated and the result never references backend classes.
 *
 * @param {ShapeDescriptor} shape
 * @returns {ShapeDescriptor}
 */
export function normalizeShape(shape) {
  if (!shape || typeof shape !== 'object') {
    throw new TypeError('Physics shape descriptor must be an object.');
  }

  switch (shape.type) {
    case 'plane': {
      const normal = vec3.normalize(vector(shape.normal, 'shape.normal'));
      if (vec3.isZero(normal)) {
        throw new RangeError('shape.normal must not be a zero vector.');
      }
      return { type: 'plane', normal };
    }
    case 'box': {
      const halfExtents = vector(shape.halfExtents, 'shape.halfExtents');
      return {
        type: 'box',
        halfExtents: {
          x: positiveNumber(halfExtents.x, 'shape.halfExtents.x'),
          y: positiveNumber(halfExtents.y, 'shape.halfExtents.y'),
          z: positiveNumber(halfExtents.z, 'shape.halfExtents.z')
        }
      };
    }
    case 'sphere': {
      return {
        type: 'sphere',
        radius: positiveNumber(shape.radius, 'shape.radius')
      };
    }
    case 'convex': {
      if (!Array.isArray(shape.vertices) || shape.vertices.length < 4) {
        throw new RangeError('shape.vertices must contain at least four vertices.');
      }
      if (!Array.isArray(shape.faces) || shape.faces.length < 4) {
        throw new RangeError('shape.faces must contain at least four faces.');
      }

      const vertices = shape.vertices.map((vertex, index) =>
        vector(vertex, `shape.vertices[${index}]`)
      );

      const faces = shape.faces.map((face, faceIndex) => {
        if (!Array.isArray(face) || face.length < 3) {
          throw new RangeError(`shape.faces[${faceIndex}] must contain at least three indices.`);
        }
        return face.map((index, vertexIndex) => {
          if (!Number.isInteger(index) || index < 0 || index >= vertices.length) {
            throw new RangeError(
              `shape.faces[${faceIndex}][${vertexIndex}] is not a valid vertex index.`
            );
          }
          return index;
        });
      });

      return { type: 'convex', vertices, faces };
    }
    case 'cylinder': {
      const axis = shape.axis === undefined ? 'z' : shape.axis;
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') {
        throw new RangeError("shape.axis must be 'x', 'y', or 'z'.");
      }

      const segments = shape.segments === undefined
        ? DEFAULT_CYLINDER_SEGMENTS
        : shape.segments;
      if (!Number.isInteger(segments) || segments < 3) {
        throw new RangeError('shape.segments must be an integer of at least 3.');
      }

      return {
        type: 'cylinder',
        radius: positiveNumber(shape.radius, 'shape.radius'),
        height: positiveNumber(shape.height, 'shape.height'),
        segments,
        axis
      };
    }
    default:
      throw new RangeError(
        `Unknown physics shape type: ${String(/** @type {any} */ (shape).type)}`
      );
  }
}
