export { D6 } from './definitions/D6.js';
export { DiceRegistry, createDiceRegistry } from './definitions/registry.js';

export { chamferGeometry, chamferPolyhedron } from './geometry/chamfer.js';
export { createDiceMeshData } from './geometry/buildMeshData.js';
export { createDiceCollisionData } from './geometry/buildCollisionData.js';

export {
  createFaceMapping,
  assertFaceMapping,
  isValidFaceMapping,
  getFaceLabel,
  shiftFaceMapping,
  createShiftedFaceMapping
} from './faces/faceMapping.js';
export { FaceReader } from './faces/FaceReader.js';

export { DiceEntity } from './DiceEntity.js';

export {
  DICE_STYLES,
  DEFAULT_DICE_STYLE,
  getDiceStyle
} from './styles.js';
