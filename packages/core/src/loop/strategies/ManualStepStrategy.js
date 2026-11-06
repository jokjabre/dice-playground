/**
 * Manual step strategy.
 *
 * Used for headless simulation and tests where the caller owns advancement and
 * decides when the run is complete. It never settles on its own.
 */
export class ManualStepStrategy {
  constructor() {
    /** @type {string} */
    this.mode = 'manual';
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
