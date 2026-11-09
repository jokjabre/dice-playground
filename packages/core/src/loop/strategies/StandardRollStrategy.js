/**
 * Standard turn-based roll strategy.
 *
 * The strategy asks the world whether dice have settled. It does not know
 * velocity thresholds or backends, and it never emits the public
 * `roll:settle` event; the engine owns the canonical settle payload.
 */
export class StandardRollStrategy {
  /**
   * @param {Object} [options]
   * @param {number} [options.minFramesBeforeCheck] Frames to run before the first settle check.
   * @param {number} [options.maxFrames] Safety cap; settle after this many frames.
   */
  constructor(options = {}) {
    /** @type {string} */
    this.mode = 'standard';
    /** @type {number} */
    this.minFramesBeforeCheck = options.minFramesBeforeCheck ?? 10;
    /** @type {number} */
    this.maxFrames = options.maxFrames ?? 1000;
    /** @type {import('../../contracts.js').WorldContract|null} */
    this.world = null;
  }

  /**
   * @param {import('../GameLoop.js').GameLoop} loop
   */
  init(loop) {
    this.world = loop.world ?? null;
  }

  /**
   * @param {import('../GameLoop.js').GameLoop} loop
   * @param {number} _dt
   * @returns {import('../../contracts.js').StepResult}
   */
  update(loop, _dt) {
    const world = loop.world ?? this.world;
    if (!world) {
      return { continue: true, settled: false };
    }

    if (loop.iteration < this.minFramesBeforeCheck) {
      return { continue: true, settled: false };
    }

    if (loop.iteration >= this.maxFrames) {
      return { continue: false, settled: true };
    }

    const settled = world.areDiceSettled();
    return { continue: !settled, settled };
  }
}
