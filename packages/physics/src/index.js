export { PhysicsWorld } from './PhysicsWorld.js';
export { BodyHandle } from './BodyHandle.js';

export { createCannonEsBackend } from './backends/cannon-es/CannonEsBackend.js';

export { normalizeShape, SHAPE_TYPES } from './shapes.js';

export {
  DEFAULT_GRAVITY,
  DEFAULT_MASS,
  DEFAULT_SOLVER_ITERATIONS,
  DEFAULT_CYLINDER_SEGMENTS,
  DEFAULT_LINEAR_DAMPING,
  DEFAULT_ANGULAR_DAMPING,
  DEFAULT_BODY_MATERIAL,
  DEFAULT_CONTACT_MATERIALS
} from './config/defaults.js';
