import { quat } from '@dice/core';

import { MeshBodySync } from '../MeshBodySync.js';
import { RollState } from '../RollState.js';

/**
 * @typedef {Object} PredictionSessionOptions
 * @property {any} physics Isolated physics world owned by the session.
 * @property {any|null} enclosure Enclosure built on the isolated physics world.
 * @property {any[]} dice DiceEntity objects with bodies in the isolated world.
 * @property {any} [settleConfig] Settle thresholds for stepUntilSettled.
 * @property {string} [idPrefix] Prefix for session die ids; keeps prediction ids distinct.
 */

/**
 * An isolated headless simulation for outcome prediction. It owns its own
 * physics world, enclosure, and dice bodies, never renders, and never touches
 * the live world.
 */
export class PredictionSession {
  /** @type {any} */
  #physics;

  /** @type {any|null} */
  #enclosure;

  /** @type {any[]} */
  #dice;

  /** @type {RollState} */
  #rollState;

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {PredictionSessionOptions} options
   */
  constructor(options) {
    if (!options || !options.physics) {
      throw new TypeError('PredictionSession requires an isolated physics world.');
    }

    this.#physics = options.physics;
    this.#enclosure = options.enclosure ?? null;
    this.#dice = options.dice ?? [];
    this.#rollState = new RollState(options.settleConfig);
    this.#rollState.beginRoll({
      rollId: 'prediction',
      mode: 'standard',
      diceIds: this.#dice.map((/** @type {any} */ die) => die.id)
    });
  }

  /**
   * @returns {any[]}
   */
  get dice() {
    return [...this.#dice];
  }

  /**
   * @returns {any}
   */
  get physics() {
    return this.#physics;
  }

  /**
   * @param {number} dt
   * @returns {void}
   */
  step(dt) {
    if (this.#disposed) return;
    if (!(dt > 0)) {
      throw new RangeError('PredictionSession.step requires a positive delta time.');
    }
    this.#physics.step(dt);
    MeshBodySync.syncList(this.#dice);
    this.#rollState.update(this.#dice);
  }

  /**
   * Step until settled or until the iteration cap. The live world is never
   * touched: only this session's physics world and dice advance.
   *
   * @param {{ velocityThreshold?: number, settleFrames?: number, maxIterations?: number, fixedStep?: number }} [settle]
   * @returns {{ settled: boolean, iterations: number, values: number[] }}
   */
  stepUntilSettled(settle = {}) {
    if (this.#disposed) {
      return { settled: true, iterations: 0, values: this.getValues() };
    }

    const config = this.#rollState.setSettleConfig(settle);
    const fixedStep = config.fixedStep ?? 1 / 60;
    const maxIterations = config.maxIterations ?? 1000;

    let iterations = 0;
    let settled = false;

    while (iterations < maxIterations) {
      this.step(fixedStep);
      iterations += 1;
      if (this.#rollState.areSettled()) {
        settled = true;
        break;
      }
    }

    return { settled, iterations, values: this.getValues() };
  }

  /**
   * @returns {number[]}
   */
  getValues() {
    /** @type {number[]} */
    const values = [];
    for (const die of this.#dice) {
      if (die && typeof die.value === 'number') {
        values.push(die.value);
      }
    }
    return values;
  }

  /**
   * Dispose bodies, the enclosure, and the isolated physics world.
   * Idempotent.
   *
   * @returns {void}
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    for (const die of this.#dice) {
      try {
        die.dispose?.();
      } catch {
        // Ignore entity teardown errors during session disposal.
      }
      if (die.body) {
        try {
          this.#physics.removeBody(die.body);
        } catch {
          // Ignore body teardown errors during session disposal.
        }
      }
    }
    this.#dice = [];

    if (this.#enclosure) {
      try {
        this.#enclosure.dispose(this.#physics, null);
      } catch {
        // Ignore enclosure teardown errors during session disposal.
      }
      this.#enclosure = null;
    }

    try {
      this.#physics.dispose();
    } catch {
      // Ignore physics teardown errors during session disposal.
    }
  }
}

/**
 * Normalise a dice-state entry into DiceFactory create options. Accepts both
 * the world throw-vector shape and the plain dice-state shape.
 *
 * @param {any} state
 * @param {number} index
 * @returns {{ position: { x: number, y: number, z: number }, velocity: { x: number, y: number, z: number }, angularVelocity: { x: number, y: number, z: number }, quaternion: { x: number, y: number, z: number, w: number } }}
 */
export function stateToTransform(state, index) {
  const position = state?.position ?? state?.pos ?? { x: 0, y: 0, z: 200 };
  const velocity = state?.velocity ?? { x: 0, y: 0, z: 0 };
  const angularVelocity =
    state?.angularVelocity ?? state?.angle ?? { x: 0, y: 0, z: 0 };

  /** @type {{ x: number, y: number, z: number, w: number }} */
  let quaternion = { x: 0, y: 0, z: 0, w: 1 };
  if (state?.quaternion) {
    quaternion = { ...state.quaternion };
  } else if (state?.axis) {
    const angle =
      state.axis.a !== undefined ? state.axis.a * Math.PI * 2 : 0;
    quaternion = quat.fromAxisAngle(
      { x: state.axis.x, y: state.axis.y, z: state.axis.z },
      angle
    );
  } else if (state?.angle && state?.axis === undefined && index !== undefined) {
    quaternion = quat.identity();
  }

  return {
    position: { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
    velocity: { x: velocity.x ?? 0, y: velocity.y ?? 0, z: velocity.z ?? 0 },
    angularVelocity: {
      x: angularVelocity.x ?? 0,
      y: angularVelocity.y ?? 0,
      z: angularVelocity.z ?? 0
    },
    quaternion
  };
}
