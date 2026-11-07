import { DiceError } from '@dice/core';
import { D6, createFaceMapping } from '@dice/dice';

import { FaceShifter } from './FaceShifter.js';
import { OutcomePredictor } from './OutcomePredictor.js';

/**
 * @typedef {Record<string, any>} RollRequest
 * @typedef {Object} PredictionSessionLike
 * @property {(options?: Record<string, any>) => void} stepUntilSettled
 * @property {() => number[]} getValues
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} DeterminismPluginOptions
 * @property {'predict-and-shift'|'predict-only'} [mode]
 * @property {number} [velocityThreshold]
 * @property {number} [settleFrames]
 * @property {number} [maxIterations]
 * @property {number} [fixedStep]
 * @property {any} [definition]
 * @property {{ get: (id: string) => any }} [registry]
 * @property {(world: any, request: RollRequest) => any} [createSession]
 */

/**
 * Create the optional determinism engine plugin.
 *
 * The plugin captures `engine.world` in `attach` and runs prediction through
 * an isolated session created by `world.createPredictionSession`. It never
 * imports physics or rendering and never constructs a physics world itself.
 *
 * @param {DeterminismPluginOptions} [options]
 * @returns {{ id: string, attach: (engine: any) => void, detach: () => void, prepareRoll: (request: RollRequest) => Promise<{ request: RollRequest, faceMappings: number[][], diagnostics: Record<string, any> }> }}
 */
export function createDeterminismPlugin(options = {}) {
  const mode = options.mode ?? 'predict-and-shift';
  if (mode !== 'predict-and-shift' && mode !== 'predict-only') {
    throw new DiceError(
      `Unknown determinism mode: ${String(mode)}. Expected "predict-and-shift" or "predict-only".`,
      { code: 'UNKNOWN_DETERMINISM_MODE' }
    );
  }

  const predictor = new OutcomePredictor({
    velocityThreshold: options.velocityThreshold,
    settleFrames: options.settleFrames,
    maxIterations: options.maxIterations,
    fixedStep: options.fixedStep
  });

  /** @type {any} */
  let world = null;

  /**
   * @param {any} [request]
   * @returns {any}
   */
  function resolveDefinition(request) {
    if (options.definition) return options.definition;
    const requested = request?.definition;
    if (typeof requested === 'string' && options.registry) {
      return options.registry.get(requested);
    }
    if (requested && typeof requested === 'object' && requested.id) return requested;
    return D6;
  }

  return {
    id: 'determinism',

    /**
     * @param {any} engine
     * @returns {void}
     */
    attach(engine) {
      world = engine?.world ?? null;
      if (!world || typeof world.createPredictionSession !== 'function') {
        throw new DiceError(
          'Determinism plugin requires an engine with a world that provides createPredictionSession().',
          { code: 'MISSING_PREDICTION_WORLD' }
        );
      }
    },

    /**
     * @returns {void}
     */
    detach() {
      world = null;
    },

    /**
     * @param {RollRequest} request
     * @returns {Promise<{ request: RollRequest, faceMappings: number[][], diagnostics: Record<string, any> }>}
     */
    async prepareRoll(request) {
      if (!world) {
        throw new DiceError(
          'Determinism plugin is not attached to an engine world.',
          { code: 'MISSING_PREDICTION_WORLD' }
        );
      }
      const targetValues = request?.values ?? [];
      const definition = resolveDefinition(request);

      /** @type {PredictionSessionLike} */
      const session = options.createSession
        ? options.createSession(world, request)
        : world.createPredictionSession({
            vectors: request?.vectors,
            diceStates: request?.diceStates,
            dice: request?.dice,
            enclosure: request?.enclosure,
            seed: request?.seed
          });

      try {
        const naturalValues = predictor.predictNaturalValues(session);
        const diagnostics = {
          mode,
          naturalValues,
          targetValues: targetValues.slice(),
          requestedValues: targetValues.slice()
        };

        if (mode === 'predict-only' || targetValues.length === 0) {
          return { request, faceMappings: [], diagnostics };
        }

        const baseMappings = request?.faceMappings
          ? request.faceMappings
          : naturalValues.map(() => createFaceMapping(definition));
        const faceMappings = FaceShifter.createFaceMappings(
          definition,
          naturalValues,
          targetValues,
          baseMappings
        );
        return { request, faceMappings, diagnostics };
      } finally {
        if (session && typeof session.dispose === 'function') {
          session.dispose();
        }
      }
    }
  };
}
