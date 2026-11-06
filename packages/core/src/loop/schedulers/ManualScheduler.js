/**
 * Scheduler for headless runs and tests.
 *
 * It never calls `requestAnimationFrame`, `setTimeout`, or `performance.now`.
 * The loop is driven explicitly with `GameLoop.step(dt)`.
 */
export class ManualScheduler {
  /**
   * @param {number} [time] Initial scheduler time in milliseconds.
   */
  constructor(time = 0) {
    /** @type {number} */
    this.time = time;
    /** @type {number} */
    this.nextId = 1;
  }

  /**
   * @returns {number} Current scheduler time in milliseconds.
   */
  now() {
    return this.time;
  }

  /**
   * Manual schedulers never invoke the callback. The id is returned so the
   * loop can cancel it consistently with a browser scheduler.
   *
   * @param {(time: number) => void} _callback
   * @returns {number}
   */
  requestFrame(_callback) {
    return this.nextId++;
  }

  /**
   * @param {number} _id
   */
  cancelFrame(_id) {
    // Nothing is scheduled in manual mode.
  }

  /**
   * Advance the scheduler clock without running the loop.
   *
   * @param {number} milliseconds
   * @returns {number} New scheduler time.
   */
  advance(milliseconds) {
    this.time += milliseconds;
    return this.time;
  }

  /**
   * Set the scheduler clock explicitly.
   *
   * @param {number} milliseconds
   */
  setTime(milliseconds) {
    this.time = milliseconds;
  }
}
