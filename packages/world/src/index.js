export { World } from './World.js';

export {
  DEFAULT_WORLD_CONFIG,
  DEFAULT_SETTLE_CONFIG,
  createWorldConfig,
  configFromContent
} from './config.js';

export {
  createDefaultPhysicsBackend,
  createDefaultPhysicsWorld,
  createDefaultPhysicsFactory,
  createDefaultRenderBackend,
  createDefaultRenderer,
  createDefaultRendererFactory
} from './backends.js';

export { DiceFactory } from './DiceFactory.js';
export { DiceSet } from './DiceSet.js';
export { TableVisual } from './TableVisual.js';
export { RollState } from './RollState.js';
export {
  DEFAULT_SPAWN_PROFILE,
  spawnProfile,
  createSpawnProfile,
  spawnPosition,
  randomizeDirection,
  buildThrowVectors,
  sampleSpawnPositions,
  clampSpawnPosition,
  clampToEnclosure,
  isSpawnPositionInside,
  isInsideEnclosure,
  resolveDieRadius,
  resolveCollisionDistance,
  resolveSpawnOrigin,
  resolveSpawnHeight,
  spawnDistance,
  MAX_THROW_ANGLE_DEVIATION,
  THROW_ANGLE_SPREAD,
  THROW_SPEED_JITTER,
  UPWARD_VELOCITY_RATIO,
  SPAWN_COLLISION_MARGIN,
  DEFAULT_SPAWN_DIE_RADIUS
} from './SpawnProfile.js';
export { MeshBodySync } from './MeshBodySync.js';
export { Viewport } from './Viewport.js';
export { PredictionSession, stateToTransform } from './prediction/PredictionSession.js';
