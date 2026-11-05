/**
 * Main Engine Facade
 * Provides high-level public exports for the Modular 3D Dice Game Engine.
 */

export { DiceEngine } from './core/DiceEngine.js';
export { EventBus } from './core/EventBus.js';
export { GameLoop, GameLoopStrategy, StandardRollStrategy, ContinuousMotionStrategy } from './core/GameLoop.js';

export { PhysicsWorld } from './physics/PhysicsWorld.js';
export { ContactManager } from './physics/ContactManager.js';

export { Enclosure } from './enclosures/Enclosure.js';
export { BoxEnclosure } from './enclosures/BoxEnclosure.js';
export { SphereEnclosure } from './enclosures/SphereEnclosure.js';
export { CylinderEnclosure } from './enclosures/CylinderEnclosure.js';

export { RenderScene } from './rendering/RenderScene.js';
export { CameraController } from './rendering/CameraController.js';
export { LightingRig } from './rendering/LightingRig.js';
export { MeshBodySync } from './rendering/MeshBodySync.js';

export { DiceEntity } from './dice/DiceEntity.js';
export { DiceFactory } from './dice/DiceFactory.js';
export { GeometryBuilder } from './dice/GeometryBuilder.js';
export { TextureGenerator } from './dice/TextureGenerator.js';

export { FaceReader } from './determinism/FaceReader.js';
export { FaceShifter } from './determinism/FaceShifter.js';
export { OutcomePredictor } from './determinism/OutcomePredictor.js';

export { ResultPresenter, BannerResultPresenter, SilentResultPresenter, CustomResultPresenter } from './presentation/ResultPresenter.js';

export { InputManager } from './input/InputManager.js';
export { RaycastPicker } from './input/RaycastPicker.js';
export { MotionController } from './input/MotionController.js';

export { options, createOptions } from './config/options.js';
export { dimensions, playingField, DimensionsManager } from './config/dimensions.js';
export { rndGen, RndGen } from './utils/rndGen.js';

