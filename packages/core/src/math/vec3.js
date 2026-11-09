/**
 * Pure three-dimensional vector helpers.
 *
 * All functions accept and return plain `{ x, y, z }` objects. They never read
 * or mutate shared state and they do not depend on Three.js.
 *
 * @typedef {import('../contracts.js').Vec3} Vec3
 */

/**
 * @param {number} [x]
 * @param {number} [y]
 * @param {number} [z]
 * @returns {Vec3}
 */
export function create(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

/**
 * @param {Vec3} vector
 * @returns {Vec3}
 */
export function clone(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/**
 * @param {Vec3} vector
 * @param {number} scalar
 * @returns {Vec3}
 */
export function scale(vector, scalar) {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

/**
 * @param {Vec3} vector
 * @returns {Vec3}
 */
export function negate(vector) {
  return { x: -vector.x, y: -vector.y, z: -vector.z };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {number}
 */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {Vec3}
 */
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

/**
 * @param {Vec3} vector
 * @returns {number}
 */
export function lengthSquared(vector) {
  return dot(vector, vector);
}

/**
 * @param {Vec3} vector
 * @returns {number}
 */
export function length(vector) {
  return Math.sqrt(lengthSquared(vector));
}

/**
 * @param {Vec3} vector
 * @returns {Vec3}
 */
export function normalize(vector) {
  const magnitude = length(vector);
  if (magnitude === 0) {
    return create();
  }
  return scale(vector, 1 / magnitude);
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {number} t
 * @returns {Vec3}
 */
export function lerp(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t
  };
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @returns {number}
 */
export function distance(a, b) {
  return length(subtract(a, b));
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 * @param {number} [epsilon]
 * @returns {boolean}
 */
export function equals(a, b, epsilon = 1e-9) {
  return (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(a.z - b.z) <= epsilon
  );
}

/**
 * @param {Vec3} vector
 * @param {number} [epsilon]
 * @returns {boolean}
 */
export function isZero(vector, epsilon = 1e-9) {
  return lengthSquared(vector) <= epsilon * epsilon;
}

/**
 * @param {Vec3} vector
 * @returns {[number, number, number]}
 */
export function toArray(vector) {
  return [vector.x, vector.y, vector.z];
}
