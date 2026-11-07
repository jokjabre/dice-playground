/**
 * Parity fixture captured from the legacy demo tuning values in
 * `legacy/dice/objects/physics.js`. These values are authoritative; the
 * cannon-es migration must not silently change them.
 */
export const LEGACY_PHYSICS_TUNING = Object.freeze({
  gravity: Object.freeze({ x: 0, y: 0, z: -2940 }),
  dieMass: 300,
  dieFriction: Object.freeze({
    die: 0,
    desk: 0.01,
    barrier_left: 0,
    barrier_right: 0,
    barrier_top: 0,
    barrier_bottom: 0,
    screen: 0
  }),
  dieRestitution: Object.freeze({
    die: 0.5,
    desk: 0.5,
    barrier_left: 1.0,
    barrier_right: 1.0,
    barrier_top: 1.0,
    barrier_bottom: 1.0,
    screen: 0.5
  })
});

/**
 * A deterministic drop/settle fixture: a 10-unit sphere dropped onto the
 * default desk plane under legacy gravity must come to rest on the plane.
 */
export const DROP_SETTLE_FIXTURE = Object.freeze({
  fixedStep: 1 / 60,
  frames: 120,
  radius: 10,
  startHeight: 200,
  expectedRestHeight: 9.9113406,
  heightTolerance: 0.01,
  velocityTolerance: 0.01
});
