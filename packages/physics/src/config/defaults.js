/**
 * Authoritative physics defaults carried over from the legacy demo.
 *
 * Gravity, die mass, friction, and restitution values are parity values. Do not
 * replace them with cannon-es or newer engine defaults without a parity test
 * update and an explicit decision.
 */

/** @type {{ x: number, y: number, z: number }} */
export const DEFAULT_GRAVITY = Object.freeze({ x: 0, y: 0, z: -2940 });

export const DEFAULT_MASS = 300;
export const DEFAULT_SOLVER_ITERATIONS = 20;
export const DEFAULT_CYLINDER_SEGMENTS = 24;
export const DEFAULT_LINEAR_DAMPING = 0.01;
export const DEFAULT_ANGULAR_DAMPING = 0.01;
export const DEFAULT_BODY_MATERIAL = 'die';

/**
 * Named contact-material pairs. Keys use sorted `materialA:materialB` names.
 * Each value holds the friction and restitution between the two materials.
 *
 * @type {Readonly<Record<string, { friction: number, restitution: number }>>}
 */
export const DEFAULT_CONTACT_MATERIALS = Object.freeze({
  'die:die': Object.freeze({ friction: 0, restitution: 0.5 }),
  'die:desk': Object.freeze({ friction: 0.01, restitution: 0.5 }),
  'die:screen': Object.freeze({ friction: 0, restitution: 0.5 }),
  'die:barrier_left': Object.freeze({ friction: 0, restitution: 1 }),
  'die:barrier_right': Object.freeze({ friction: 0, restitution: 1 }),
  'die:barrier_top': Object.freeze({ friction: 0, restitution: 1 }),
  'die:barrier_bottom': Object.freeze({ friction: 0, restitution: 1 }),
  'die:sphere_boundary': Object.freeze({ friction: 0, restitution: 0.6 }),
  'die:glass_boundary': Object.freeze({ friction: 0, restitution: 0.4 })
});
