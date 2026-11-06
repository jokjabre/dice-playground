/**
 * Continuous motion strategy.
 *
 * Used for live sandbox motion and motion-sensor modes. It never auto-stops;
 * the caller stops the loop explicitly.
 */
export class ContinuousMotionStrategy {
  constructor() {
    /** @type {string} */
    this.mode = 'continuous';
  }

  /**
   * @param {import('../GameLoop.js').GameLoop} _loop
   */
  init(_loop) {}

  /**
   * @param {import('../GameLoop.js').GameLoop} _loop
   * @param {number} _dt
   * @returns {import('../../contracts.js').StepResult}
   */
  update(_loop, _dt) {
    return { continue: true, settled: false };
  }
}
