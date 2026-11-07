import { FaceShifter } from './FaceShifter.js';

/**
 * @typedef {Object} SettleConfig
 * @property {number} [velocityThreshold]
 * @property {number} [settleFrames]
 * @property {number} [maxIterations]
 * @property {number} [fixedStep]
 */

/**
 * @typedef {Object} PredictionSessionLike
 * @property {(options?: Record<string, any>) => void} stepUntilSettled
 * @property {() => number[]} getValues
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} DieDefinitionLike
 * @property {string} id
 * @property {number} faceCount
 * @property {[number, number]} labelRange
 * @property {() => number[]} createFaceMapping
 */

/**
 * Runs an isolated `PredictionSession` supplied by the world to settle and
 * then shift face mappings. The predictor never constructs a physics world or
 * touches the live world; the world owns session creation.
 */
export class OutcomePredictor {
  /** @type {SettleConfig} */
  #settleConfig;

  /**
   * @param {SettleConfig} [options]
   */
  constructor(options = {}) {
    this.#settleConfig = {
      velocityThreshold: options.velocityThreshold ?? 6,
      settleFrames: options.settleFrames ?? 3,
      maxIterations: options.maxIterations ?? 1000,
      fixedStep: options.fixedStep ?? 1 / 60
    };
  }

  /**
   * @returns {SettleConfig}
   */
  get settleConfig() {
    return { ...this.#settleConfig };
  }

  /**
   * Step an isolated session until it settles and return the natural values.
   * The caller owns session disposal unless `dispose` is requested.
   *
   * @param {PredictionSessionLike} session
   * @param {SettleConfig} [overrides]
   * @param {{ dispose?: boolean }} [options]
   * @returns {number[]}
   */
  predictNaturalValues(session, overrides, options = {}) {
    if (!session || typeof session.stepUntilSettled !== 'function' || typeof session.getValues !== 'function') {
      throw new TypeError('OutcomePredictor requires a prediction session.');
    }
    const settle = { ...this.#settleConfig, ...(overrides ?? {}) };
    try {
      session.stepUntilSettled(settle);
      return session.getValues().slice();
    } finally {
      if (options.dispose && typeof session.dispose === 'function') {
        session.dispose();
      }
    }
  }

  /**
   * Predict natural values in an isolated session and build face mappings
   * for the requested targets in the same step. The session is disposed
   * before this method returns.
   *
   * @param {{ session: PredictionSessionLike, definition: DieDefinitionLike, targetValues?: Array<number|undefined>, baseMappings?: number[][], settleConfig?: SettleConfig }} input
   * @returns {{ naturalValues: number[], faceMappings: number[][] }}
   */
  predictAndShift(input) {
    const session = input.session;
    const naturalValues = this.predictNaturalValues(
      session,
      input.settleConfig,
      { dispose: false }
    );
    try {
      const targets = input.targetValues ?? [];
      const faceMappings = FaceShifter.createFaceMappings(
        input.definition,
        naturalValues,
        targets,
        input.baseMappings
      );
      return { naturalValues, faceMappings };
    } finally {
      if (session && typeof session.dispose === 'function') {
        session.dispose();
      }
    }
  }
}
