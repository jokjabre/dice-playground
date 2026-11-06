import {
  create as createVec3,
  dot as dotVec3,
  scale as scaleVec3
} from './vec3.js';

/**
 * Pure quaternion helpers using plain `{ x, y, z, w }` objects.
 *
 * @typedef {import('../contracts.js').Quat} Quat
 * @typedef {import('../contracts.js').Vec3} Vec3
 */

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @param {number} [w]
 * @returns {Quat}
 */
export function create(x = 0, y = 0, z = 0, w = 1) {
  return { x, y, z, w };
}

/**
 * @returns {Quat}
 */
export function identity() {
  return create();
}

/**
 * @param {Quat} quaternion
 * @returns {Quat}
 */
export function clone(quaternion) {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  };
}

/**
 * Hamilton product `a * b`.
 *
 * @param {Quat} a
 * @param {Quat} b
 * @returns {Quat}
 */
export function multiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

/**
 * @param {Quat} quaternion
 * @returns {Quat}
 */
export function conjugate(quaternion) {
  return {
    x: -quaternion.x,
    y: -quaternion.y,
    z: -quaternion.z,
    w: quaternion.w
  };
}

/**
 * @param {Quat} quaternion
 * @returns {number}
 */
export function lengthSquared(quaternion) {
  return (
    quaternion.x * quaternion.x +
    quaternion.y * quaternion.y +
    quaternion.z * quaternion.z +
    quaternion.w * quaternion.w
  );
}

/**
 * @param {Quat} quaternion
 * @returns {number}
 */
export function length(quaternion) {
  return Math.sqrt(lengthSquared(quaternion));
}

/**
 * @param {Quat} quaternion
 * @returns {Quat}
 */
export function normalize(quaternion) {
  const magnitude = length(quaternion);
  if (magnitude === 0) return identity();

  return {
    x: quaternion.x / magnitude,
    y: quaternion.y / magnitude,
    z: quaternion.z / magnitude,
    w: quaternion.w / magnitude
  };
}

/**
 * @param {Quat} quaternion
 * @returns {Quat}
 */
export function invert(quaternion) {
  const magnitudeSquared = lengthSquared(quaternion);
  if (magnitudeSquared === 0) return identity();

  return {
    x: -quaternion.x / magnitudeSquared,
    y: -quaternion.y / magnitudeSquared,
    z: -quaternion.z / magnitudeSquared,
    w: quaternion.w / magnitudeSquared
  };
}

/**
 * @param {Quat} a
 * @param {Quat} b
 * @returns {number}
 */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

/**
 * Rotate a vector by a unit quaternion.
 *
 * @param {Quat} quaternion
 * @param {Vec3} vector
 * @returns {Vec3}
 */
export function rotateVec3(quaternion, vector) {
  const q = normalize(quaternion);
  const vectorQuat = create(vector.x, vector.y, vector.z, 0);
  const rotated = multiply(multiply(q, vectorQuat), conjugate(q));
  return createVec3(rotated.x, rotated.y, rotated.z);
}

/**
 * @param {Vec3} axis
 * @param {number} angle Angle in radians.
 * @returns {Quat}
 */
export function fromAxisAngle(axis, angle) {
  const axisLength = Math.sqrt(dotVec3(axis, axis));
  if (axisLength === 0) return identity();

  const unit = scaleVec3(axis, 1 / axisLength);
  const half = angle / 2;
  const sine = Math.sin(half);

  return create(unit.x * sine, unit.y * sine, unit.z * sine, Math.cos(half));
}

/**
 * Spherical interpolation.
 *
 * @param {Quat} a
 * @param {Quat} b
 * @param {number} t
 * @returns {Quat}
 */
export function slerp(a, b, t) {
  let cosine = dot(a, b);

  /** @type {Quat} */
  let target = b;
  if (cosine < 0) {
    cosine = -cosine;
    target = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
  }

  if (cosine > 0.9995) {
    return normalize({
      x: a.x + (target.x - a.x) * t,
      y: a.y + (target.y - a.y) * t,
      z: a.z + (target.z - a.z) * t,
      w: a.w + (target.w - a.w) * t
    });
  }

  const theta = Math.acos(cosine);
  const sine = Math.sin(theta);
  const scaleA = Math.sin((1 - t) * theta) / sine;
  const scaleB = Math.sin(t * theta) / sine;

  return {
    x: a.x * scaleA + target.x * scaleB,
    y: a.y * scaleA + target.y * scaleB,
    z: a.z * scaleA + target.z * scaleB,
    w: a.w * scaleA + target.w * scaleB
  };
}

/**
 * @param {Quat} a
 * @param {Quat} b
 * @param {number} [epsilon]
 * @returns {boolean}
 */
export function equals(a, b, epsilon = 1e-9) {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon &&
    Math.abs(a.w - b.w) <= epsilon
  );
}

/**
 * @param {Quat} quaternion
 * @returns {[number, number, number, number]}
 */
export function toArray(quaternion) {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}
