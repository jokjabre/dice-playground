export { RenderScene, createRenderScene } from './RenderScene.js';

export { CameraController } from './camera/CameraController.js';
export { LightingRig } from './lighting/LightingRig.js';
export { RaycastService } from './picking/RaycastService.js';

export {
  TextureFactory,
  createDiceMaterialSet,
  calcTextureSize
} from './materials/TextureFactory.js';

export {
  validateDiceMeshData,
  countFaceTriangles,
  listFaceIndices
} from './geometry/meshData.js';

export {
  DEFAULT_RENDER_CONFIG,
  createRenderConfig
} from './config/defaults.js';

/**
 * Load the default Three r73 backend.
 *
 * The dynamic import keeps importing `@dice/rendering` in Node free of the
 * Vite-specific vendor `?url` import and of any DOM access.
 *
 * @param {{ document?: Document|null }} [options]
 * @returns {Promise<any>}
 */
export async function createThreeLegacyBackend(options = {}) {
  const { createThreeLegacyBackend: createBackend } = await import(
    './backends/three-r73/ThreeLegacyBackend.js'
  );
  return createBackend(options);
}
