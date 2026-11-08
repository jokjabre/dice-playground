import { DiceEngine } from './DiceEngine.js';

/**
 * Async factory for the dice engine. Async because the rendering backend
 * may load the vendored Three script; headless engines use the same path.
 *
 * @param {import('./config.js').EngineConfig} [config]
 * @returns {Promise<DiceEngine>}
 */
export async function createDiceEngine(config = {}) {
  return DiceEngine.create(config);
}
