import { DEFAULT_SETTLE_CONFIG } from './config.js';

/**
 * @typedef {Object} SettleConfig
 * @property {number} velocityThreshold
 * @property {number} settleFrames
 * @property {number} maxIterations
 * @property {number} fixedStep
 */

/**
 * Tracks per-die settle counters for one active roll.
 *
 * The update rule mirrors the legacy settle check: a die counts as still for
 * one frame when every linear and angular velocity component is below the
 * threshold; it is settled after being still for more than `settleFrames`
 * consecutive frames. Continuous mode never reports settled.
 */
export class RollState {
  /** @type {SettleConfig} */
  #settleConfig;

  /** @type {'standard'|'continuous'|'manual'} */
  #mode = 'standard';

  /** @type {string|null} */
  #rollId = null;

  /** @type {Map<string, number>} */
  #stillCounts = new Map();

  /** @type {boolean} */
  #settled = false;

  /** @type {number} */
  #iterations = 0;

  /**
   * @param {Partial<SettleConfig>|null|undefined} [settleConfig]
   */
  constructor(settleConfig = DEFAULT_SETTLE_CONFIG) {
    this.#settleConfig = {
      velocityThreshold: settleConfig?.velocityThreshold ?? 6,
      settleFrames: settleConfig?.settleFrames ?? 3,
      maxIterations: settleConfig?.maxIterations ?? 1000,
      fixedStep: settleConfig?.fixedStep ?? 1 / 60
    };
  }

  /**
   * @returns {SettleConfig}
   */
  getSettleConfig() {
    return { ...this.#settleConfig };
  }

  /**
   * @param {Partial<SettleConfig>|null|undefined} partial
   * @returns {SettleConfig}
   */
  setSettleConfig(partial = {}) {
    if (partial?.velocityThreshold !== undefined) {
      this.#settleConfig.velocityThreshold = partial.velocityThreshold;
    }
    if (partial?.settleFrames !== undefined) {
      this.#settleConfig.settleFrames = partial.settleFrames;
    }
    if (partial?.maxIterations !== undefined) {
      this.#settleConfig.maxIterations = partial.maxIterations;
    }
    if (partial?.fixedStep !== undefined) {
      this.#settleConfig.fixedStep = partial.fixedStep;
    }
    return this.getSettleConfig();
  }

  /**
   * @returns {string|null}
   */
  get rollId() {
    return this.#rollId;
  }

  /**
   * @returns {'standard'|'continuous'|'manual'}
   */
  get mode() {
    return this.#mode;
  }

  /**
   * @returns {boolean}
   */
  get settled() {
    return this.#settled;
  }

  /**
   * @returns {number}
   */
  get iteration() {
    return this.#iterations;
  }

  /**
   * @param {{ rollId?: string|null, mode?: 'standard'|'continuous'|'manual', diceIds?: string[] }} [options]
   * @returns {void}
   */
  beginRoll(options = {}) {
    this.#rollId = options.rollId ?? null;
    this.#mode = options.mode ?? 'standard';
    this.#settled = false;
    this.#iterations = 0;
    this.#stillCounts = new Map();
    for (const id of options.diceIds ?? []) {
      this.#stillCounts.set(id, 0);
    }
  }

  /**
   * @param {{ rollId?: string|null, mode?: 'standard'|'continuous'|'manual' }} [options]
   * @returns {void}
   */
  reset(options = {}) {
    if (options.rollId !== undefined) this.#rollId = options.rollId;
    if (options.mode !== undefined) this.#mode = options.mode;
    this.#settled = false;
    this.#iterations = 0;
    this.#stillCounts.clear();
  }

  /**
   * Advance settle counters from the current dice velocities. Called once per
   * physics step by the world; reading `settled` afterwards is side-effect free.
   *
   * @param {any[]} dice DiceEntity-like objects with body handles.
   * @returns {{ settled: boolean, iteration: number }}
   */
  update(dice) {
    this.#iterations += 1;

    if (this.#mode === 'continuous') {
      this.#settled = false;
      return { settled: false, iteration: this.#iterations };
    }

    const threshold = this.#settleConfig.velocityThreshold;
    const frames = this.#settleConfig.settleFrames;
    let allSettled = dice.length > 0;

    for (const die of dice) {
      if (!die || !die.body || die.state === 'removed') {
        continue;
      }

      const velocity = die.body.getVelocity();
      const angular = die.body.getAngularVelocity();
      const still =
        Math.abs(angular.x) < threshold &&
        Math.abs(angular.y) < threshold &&
        Math.abs(angular.z) < threshold &&
        Math.abs(velocity.x) < threshold &&
        Math.abs(velocity.y) < threshold &&
        Math.abs(velocity.z) < threshold;

      if (still) {
        this.#stillCounts.set(die.id, (this.#stillCounts.get(die.id) ?? 0) + 1);
      } else {
        this.#stillCounts.set(die.id, 0);
        allSettled = false;
        continue;
      }

      if ((this.#stillCounts.get(die.id) ?? 0) <= frames) {
        allSettled = false;
      }
    }

    this.#settled = allSettled;
    return { settled: this.#settled, iteration: this.#iterations };
  }

  /**
   * @returns {boolean}
   */
  areSettled() {
    return this.#settled;
  }
}
