import {
  DEFAULT_CONTACT_MATERIALS,
  DEFAULT_GRAVITY,
  DEFAULT_MASS,
  DEFAULT_SOLVER_ITERATIONS
} from '@dice/physics';

/**
 * Physics lab content and defaults.
 *
 * Defaults come from `@dice/physics` so the lab always resets to the same
 * values the world starts with. Contact-material pairs are the named pairs
 * the physics package registers by default.
 */

export const LAB_DICE_COUNT = 6;

/**
 * @typedef {Object} ContactSurface
 * @property {string} id Stable id used in the UI select.
 * @property {string} label Human-readable label.
 * @property {string} materialA First material name.
 * @property {string} materialB Second material name.
 * @property {number} friction Default friction from the physics defaults.
 * @property {number} restitution Default restitution from the physics defaults.
 */

/**
 * Surfaces offered in the lab, with labels for the enclosure parts they
 * model. Order is stable for tests and the UI.
 *
 * @type {ReadonlyArray<ContactSurface>}
 */
export const LAB_SURFACES = Object.freeze([
  {
    id: 'desk',
    label: 'Die vs desk (floor)',
    materialA: 'die',
    materialB: 'desk',
    friction: DEFAULT_CONTACT_MATERIALS['die:desk'].friction,
    restitution: DEFAULT_CONTACT_MATERIALS['die:desk'].restitution
  },
  {
    id: 'die',
    label: 'Die vs die',
    materialA: 'die',
    materialB: 'die',
    friction: DEFAULT_CONTACT_MATERIALS['die:die'].friction,
    restitution: DEFAULT_CONTACT_MATERIALS['die:die'].restitution
  },
  {
    id: 'barrier',
    label: 'Die vs box walls',
    materialA: 'die',
    materialB: 'barrier_left',
    friction: DEFAULT_CONTACT_MATERIALS['die:barrier_left'].friction,
    restitution: DEFAULT_CONTACT_MATERIALS['die:barrier_left'].restitution
  },
  {
    id: 'sphere',
    label: 'Die vs sphere boundary',
    materialA: 'die',
    materialB: 'sphere_boundary',
    friction: DEFAULT_CONTACT_MATERIALS['die:sphere_boundary'].friction,
    restitution: DEFAULT_CONTACT_MATERIALS['die:sphere_boundary'].restitution
  },
  {
    id: 'glass',
    label: 'Die vs glass boundary',
    materialA: 'die',
    materialB: 'glass_boundary',
    friction: DEFAULT_CONTACT_MATERIALS['die:glass_boundary'].friction,
    restitution: DEFAULT_CONTACT_MATERIALS['die:glass_boundary'].restitution
  }
]);

/**
 * @param {string} id
 * @returns {ContactSurface}
 */
export function getLabSurface(id) {
  const surface = LAB_SURFACES.find((entry) => entry.id === id);
  if (!surface) {
    throw new Error(`Unknown lab surface: ${id}`);
  }
  return surface;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isLabSurface(id) {
  return LAB_SURFACES.some((entry) => entry.id === id);
}

/**
 * Live, mutable physics settings for the lab. Every control writes here and
 * the app applies the values to the running world. Returned fresh so resets
 * never share references with the frozen physics defaults.
 *
 * @typedef {Object} LabPhysicsSettings
 * @property {{ x: number, y: number, z: number }} gravity
 * @property {number} mass
 * @property {number} linearDamping
 * @property {number} angularDamping
 * @property {number} friction
 * @property {number} restitution
 * @property {number} solverIterations
 * @property {number} fixedStep
 * @property {number} velocityThreshold
 * @property {number} settleFrames
 */

/**
 * Defaults matching a fresh world. Damping defaults to the world's own
 * values (0.1), which are what spawned dice actually use.
 *
 * @returns {LabPhysicsSettings}
 */
export function defaultLabSettings() {
  return {
    gravity: { ...DEFAULT_GRAVITY },
    mass: DEFAULT_MASS,
    linearDamping: 0.1,
    angularDamping: 0.1,
    friction: LAB_SURFACES[0].friction,
    restitution: LAB_SURFACES[0].restitution,
    solverIterations: DEFAULT_SOLVER_ITERATIONS,
    fixedStep: 1 / 60,
    velocityThreshold: 6,
    settleFrames: 3
  };
}

/**
 * Friction/restitution slider limits. Physics requires values of zero or
 * greater; the lab caps restitution at 1.5 for sanity.
 */
export const LAB_CONTACT_LIMITS = Object.freeze({
  friction: Object.freeze({ min: 0, max: 2, step: 0.01 }),
  restitution: Object.freeze({ min: 0, max: 1.5, step: 0.01 })
});

/**
 * Clamp a numeric control value into `[min, max]`, falling back to the
 * current value when the input is not finite.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
export function clampControlValue(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
