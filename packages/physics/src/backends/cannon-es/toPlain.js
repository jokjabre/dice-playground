import * as CANNON from 'cannon-es';

/**
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} QuatLike
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @param {Vec3Like} vector
 * @returns {{ x: number, y: number, z: number }}
 */
export function toPlainVec(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

/**
 * @param {QuatLike} quaternion
 * @returns {{ x: number, y: number, z: number, w: number }}
 */
export function toPlainQuat(quaternion) {
  return {
    x: quaternion.x,
    y: quaternion.y,
    z: quaternion.z,
    w: quaternion.w
  };
}

/**
 * @param {Vec3Like} vector
 * @returns {CANNON.Vec3}
 */
export function toCannonVec(vector) {
  return new CANNON.Vec3(vector.x, vector.y, vector.z);
}

/**
 * @param {QuatLike} quaternion
 * @returns {CANNON.Quaternion}
 */
export function toCannonQuat(quaternion) {
  return new CANNON.Quaternion(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w
  );
}

/**
 * @param {number} sleepState
 * @returns {'awake'|'sleepy'|'sleeping'|'unknown'}
 */
export function sleepStateToName(sleepState) {
  if (sleepState === CANNON.Body.AWAKE) return 'awake';
  if (sleepState === CANNON.Body.SLEEPY) return 'sleepy';
  if (sleepState === CANNON.Body.SLEEPING) return 'sleeping';
  return 'unknown';
}
