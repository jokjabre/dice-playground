import { mergeConfig } from '@dice/core';

/**
 * @typedef {Object} EngineConfig
 * @property {any|null} [container] Render target; null means headless.
 * @property {boolean} [headless]
 * @property {string|number} [seed]
 * @property {string} [engineId]
 * @property {Record<string, any>|null} [content] Serializable content pack.
 * @property {Record<string, any>} [physics] Physics/world config overrides.
 * @property {Record<string, any>} [rendering] Rendering config overrides.
 * @property {{ count?: number, dice?: number, definition?: string, style?: string|any }} [dice]
 * @property {{ fixedStep?: number, maxSubSteps?: number, maxFrameGap?: number }} [loop]
 * @property {Record<string, any>} [settle] Settle config overrides.
 * @property {any[]} [plugins] Plugins to attach after creation.
 * @property {Record<string, any>} [viewport] Initial metrics.
 * @property {any} [rng] Injected RandomSource.
 * @property {(options: any) => any} [worldFactory] World factory override (tests).
 * @property {(config?: any) => any} [physicsFactory] Forwarded to the world.
 * @property {(options?: any) => any} [rendererFactory] Forwarded to the world.
 * @property {any} [diceRegistry] Forwarded to the world.
 */

/**
 * @type {Readonly<Record<string, any>>}
 */
export const DEFAULT_ENGINE_CONFIG = Object.freeze({
  container: null,
  headless: false,
  seed: undefined,
  content: null,
  physics: Object.freeze({}),
  rendering: Object.freeze({}),
  dice: Object.freeze({ count: 6, definition: 'd6', style: 'classic' }),
  loop: Object.freeze({ fixedStep: 1 / 60, maxSubSteps: 4, maxFrameGap: 0.25 }),
  settle: Object.freeze({})
});

/**
 * Merge engine config layers without mutating any layer.
 *
 * @param {Partial<EngineConfig>|Record<string, any>} [overrides]
 * @returns {EngineConfig}
 */
export function createEngineConfig(overrides = {}) {
  const merged = mergeConfig(
    /** @type {Record<string, any>} */ (DEFAULT_ENGINE_CONFIG),
    /** @type {Record<string, any>} */ (overrides)
  );

  return /** @type {EngineConfig} */ ({
    container: merged.container ?? null,
    headless: Boolean(merged.headless),
    seed: merged.seed,
    engineId: merged.engineId,
    content: merged.content ?? null,
    physics: merged.physics ?? {},
    rendering: merged.rendering ?? {},
    dice: merged.dice ?? {},
    loop: {
      fixedStep: merged.loop?.fixedStep ?? 1 / 60,
      maxSubSteps: merged.loop?.maxSubSteps ?? 4,
      maxFrameGap: merged.loop?.maxFrameGap ?? 0.25
    },
    settle: merged.settle ?? {},
    plugins: overrides.plugins ?? [],
    viewport: overrides.viewport,
    rng: overrides.rng,
    worldFactory: overrides.worldFactory,
    physicsFactory: overrides.physicsFactory,
    rendererFactory: overrides.rendererFactory,
    diceRegistry: overrides.diceRegistry
  });
}

/**
 * Translate engine config into world config overrides. Content packs are
 * passed through as plain data; the world extracts what it needs.
 *
 * @param {EngineConfig} config
 * @returns {Record<string, any>}
 */
export function engineConfigToWorldConfig(config) {
  /** @type {Record<string, any>} */
  const worldConfig = {};

  const diceCount = config.dice?.count ?? config.dice?.dice;
  if (diceCount !== undefined) worldConfig.diceCount = diceCount;
  if (config.dice?.definition !== undefined) {
    worldConfig.diceDefinition = config.dice.definition;
  }
  if (config.dice?.style !== undefined) worldConfig.diceStyle = config.dice.style;

  if (config.physics && Object.keys(config.physics).length > 0) {
    if (config.physics.gravity !== undefined) worldConfig.gravity = config.physics.gravity;
    if (config.physics.iterations !== undefined) {
      worldConfig.physicsIterations = config.physics.iterations;
    }
    if (config.physics.mass !== undefined) worldConfig.mass = config.physics.mass;
  }

  if (config.rendering && Object.keys(config.rendering).length > 0) {
    worldConfig.render = { ...config.rendering };
  }

  if (config.settle && Object.keys(config.settle).length > 0) {
    worldConfig.settle = { ...config.settle };
  }

  return worldConfig;
}
