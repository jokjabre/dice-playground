/**
 * Event names used across the engine.
 *
 * Handlers receive the payload types declared in `contracts.js`. Event names
 * are constants so packages never depend on magic strings.
 *
 * @type {Readonly<{
 *   ENGINE_READY: 'engine:ready',
 *   ENGINE_RESIZE: 'engine:resize',
 *   ENGINE_ERROR: 'engine:error',
 *   LOOP_START: 'loop:start',
 *   LOOP_PAUSE: 'loop:pause',
 *   LOOP_RESUME: 'loop:resume',
 *   LOOP_STOP: 'loop:stop',
 *   TICK: 'tick',
 *   ROLL_START: 'roll:start',
 *   ROLL_PROGRESS: 'roll:progress',
 *   ROLL_SETTLE: 'roll:settle',
 *   ROLL_CANCEL: 'roll:cancel',
 *   DIE_SPAWN: 'die:spawn',
 *   DIE_REMOVE: 'die:remove',
 *   DIE_PICK: 'die:pick',
 *   DIE_SELECT: 'die:select',
 *   ENCLOSURE_CHANGE: 'enclosure:change',
 *   PHYSICS_GRAVITY: 'physics:gravity',
 *   MOTION_STATUS: 'motion:status',
 *   RESULT_PRESENT: 'result:present'
 * }>}
 */
export const EVENTS = Object.freeze({
  ENGINE_READY: 'engine:ready',
  ENGINE_RESIZE: 'engine:resize',
  ENGINE_ERROR: 'engine:error',
  LOOP_START: 'loop:start',
  LOOP_PAUSE: 'loop:pause',
  LOOP_RESUME: 'loop:resume',
  LOOP_STOP: 'loop:stop',
  TICK: 'tick',
  ROLL_START: 'roll:start',
  ROLL_PROGRESS: 'roll:progress',
  ROLL_SETTLE: 'roll:settle',
  ROLL_CANCEL: 'roll:cancel',
  DIE_SPAWN: 'die:spawn',
  DIE_REMOVE: 'die:remove',
  DIE_PICK: 'die:pick',
  DIE_SELECT: 'die:select',
  ENCLOSURE_CHANGE: 'enclosure:change',
  PHYSICS_GRAVITY: 'physics:gravity',
  MOTION_STATUS: 'motion:status',
  RESULT_PRESENT: 'result:present'
});

/**
 * Every public event name, useful for validation and debugging.
 */
export const EVENT_NAMES = Object.freeze(
  /** @type {string[]} */ (Object.values(EVENTS))
);
