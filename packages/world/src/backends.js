import { PhysicsWorld, createCannonEsBackend } from '@dice/physics';
import { RenderScene, createThreeLegacyBackend } from '@dice/rendering';

/**
 * Default backend factories. The world is the only package allowed to
 * construct both a physics backend and a rendering backend; tests and headless
 * use inject their own factories through the World constructor.
 */

/**
 * Create the default cannon-es physics backend.
 *
 * @param {{ broadphase?: 'naive'|'sap' }} [options]
 * @returns {any}
 */
export function createDefaultPhysicsBackend(options = {}) {
  return createCannonEsBackend(options);
}

/**
 * Create a default physics world backed by cannon-es.
 *
 * @param {{ gravity?: { x: number, y: number, z: number }, iterations?: number, materials?: Record<string, { friction?: number, restitution?: number }>, broadphase?: 'naive'|'sap' }} [config]
 * @returns {PhysicsWorld}
 */
export function createDefaultPhysicsWorld(config = {}) {
  return new PhysicsWorld({
    backend: createDefaultPhysicsBackend(
      config.broadphase ? { broadphase: config.broadphase } : {}
    ),
    gravity: config.gravity,
    iterations: config.iterations,
    materials: config.materials
  });
}

/**
 * Create a default physics factory. The factory receives the world's physics
 * config and returns a fresh PhysicsWorld.
 *
 * @returns {(config?: any) => PhysicsWorld}
 */
export function createDefaultPhysicsFactory() {
  return (config = {}) => createDefaultPhysicsWorld(config);
}

/**
 * Create the default Three r73 render backend. Importing this module in Node
 * does not load Three; the backend loads the vendor script only when a scene
 * is created.
 *
 * @returns {Promise<any>}
 */
export async function createDefaultRenderBackend() {
  return createThreeLegacyBackend();
}

/**
 * Create a default render scene for a browser container.
 *
 * @param {{ container: any, config?: Record<string, any> }} options
 * @returns {Promise<RenderScene>}
 */
export async function createDefaultRenderer(options) {
  if (!options.container) {
    throw new TypeError('createDefaultRenderer requires a container.');
  }
  const backend = await createDefaultRenderBackend();
  return new RenderScene({
    backend,
    container: options.container,
    config: options.config ?? {}
  });
}

/**
 * Create a default renderer factory. The factory receives an object with the
 * world container, render config, and metrics, and resolves to a RenderScene.
 *
 * @returns {(options: { container: any, config?: Record<string, any>, metrics?: Record<string, any> }) => Promise<RenderScene>}
 */
export function createDefaultRendererFactory() {
  return (options) =>
    createDefaultRenderer({
      container: options.container,
      config: options.config ?? {}
    });
}
