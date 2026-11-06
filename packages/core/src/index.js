export { EventBus } from './events/EventBus.js';
export { EVENTS, EVENT_NAMES } from './events/catalog.js';

export { GameLoop, GameLoopStrategy } from './loop/GameLoop.js';
export { ManualScheduler } from './loop/schedulers/ManualScheduler.js';
export { StandardRollStrategy } from './loop/strategies/StandardRollStrategy.js';
export { ContinuousMotionStrategy } from './loop/strategies/ContinuousMotionStrategy.js';
export { ManualStepStrategy } from './loop/strategies/ManualStepStrategy.js';

export {
  RandomSource,
  createSeededRandom,
  createBrowserRandom
} from './random/RandomSource.js';

export { mergeConfig } from './config/mergeConfig.js';

export * as vec3 from './math/vec3.js';
export * as quat from './math/quat.js';

export { computeViewportMetrics } from './viewport/metrics.js';

export {
  DiceError,
  UnsupportedRollOptionError,
  InvalidRollTargetError,
  RollInProgressError,
  ConfigurationError
} from './errors.js';
