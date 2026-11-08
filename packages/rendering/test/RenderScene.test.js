import { describe, expect, it } from 'vitest';

import { RenderScene } from '../src/index.js';
import { createDiceMaterialSet } from '../src/materials/TextureFactory.js';
import { D6_MESH_DATA } from './fixtures/d6-mesh.js';
import { createFakeBackend, createFakeContainer } from './fakes.js';

const style = {
  bodyColor: '#202020',
  labelColor: '#aaaaaa',
  fontFamily: 'Arial',
  material: { shininess: 30, specular: 0x172022 },
  textureSize: 64
};

const materialSet = createDiceMaterialSet({
  style,
  labels: [1, 2, 3, 4, 5, 6]
});

const metrics = {
  containerWidth: 500,
  containerHeight: 300,
  sceneWidth: 500,
  sceneHeight: 300,
  scale: 1,
  aspect: 1,
  wallHeight: 1000,
  pixelRatio: 2
};

function createScene(options = {}) {
  const backend = createFakeBackend(options);
  const container = /** @type {any} */ (createFakeContainer());
  const scene = new RenderScene({ backend, container, config: { background: 0x111111 } });
  return { backend, container, scene };
}

describe('RenderScene', () => {
  it('creates a renderer, scene, camera, and lighting rig', () => {
    const { backend, container, scene } = createScene();

    expect(container.children).toContain(backend.canvas);
    expect(scene.scene.background).toBe(0x111111);
    expect(scene.camera.aspect).toBe(1);
    expect(scene.scene.children.map((/** @type {any} */ child) => child.kind)).toEqual([
      'ambient',
      'spot',
      'target'
    ]);
  });

  it('creates dice visuals with geometry, material slots, and face mapping', () => {
    const { backend, scene } = createScene();
    const visual = scene.createDiceVisual({
      id: 'die-1',
      meshData: D6_MESH_DATA,
      materialSet,
      faceMapping: [1, 2, 3, 4, 5, 6]
    });

    expect(backend.calls.createGeometry).toHaveLength(1);
    expect(backend.calls.createDiceMaterials[0].labels).toHaveLength(6);
    expect(backend.calls.applyFaceMapping[0].faceMapping).toEqual([
      1, 2, 3, 4, 5, 6
    ]);

    visual.setTransform({
      position: { x: 1, y: 2, z: 3 },
      quaternion: { x: 0, y: 0, z: 0.5, w: 0.5 }
    });
    const mesh = backend.calls.createMesh[0].mesh;
    expect(mesh.position).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(mesh.quaternion).toMatchObject({ z: 0.5, w: 0.5 });
    expect(mesh.userData.dieId).toBe('die-1');

    visual.setFaceMapping([6, 5, 4, 3, 2, 1]);
    expect(backend.calls.applyFaceMapping).toHaveLength(2);
    expect(backend.calls.applyFaceMapping[1].faceMapping).toEqual([
      6, 5, 4, 3, 2, 1
    ]);
    expect(mesh.userData.faceMapping).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it('picks the die id and world-space point for normalized device coordinates', () => {
    const { backend, scene } = createScene();
    scene.createDiceVisual({
      id: 'die-7',
      meshData: D6_MESH_DATA,
      materialSet,
      faceMapping: [1, 2, 3, 4, 5, 6]
    });

    const mesh = backend.calls.createMesh[0].mesh;
    backend.pickHits = [
      { object: mesh, distance: 12.5, point: { x: 4, y: 5, z: 6 } }
    ];

    expect(scene.pick({ x: 0, y: 0 })).toEqual({
      dieId: 'die-7',
      distance: 12.5,
      point: { x: 4, y: 5, z: 6 }
    });
    expect(scene.pick({ x: 0, y: 0 }, ['die-7'])).toEqual({
      dieId: 'die-7',
      distance: 12.5,
      point: { x: 4, y: 5, z: 6 }
    });
  });

  it('resizes the renderer and camera from shared metrics', () => {
    const { backend, scene } = createScene();
    scene.resize(metrics);

    expect(backend.calls.resizes[0]).toEqual({
      width: 1000,
      height: 600,
      pixelRatio: 2
    });
    expect(scene.camera.aspect).toBeCloseTo(500 / 300);
    expect(scene.camera.position.z).toBe(1000);
  });

  it('moves the spotlight in scene-relative units', () => {
    const { scene } = createScene();
    scene.resize(metrics);

    const spot = scene.scene.children.find(
      (/** @type {any} */ child) => child.kind === 'spot'
    );
    expect(spot.position).toMatchObject({ x: -250, y: 250, z: 1000 });

    scene.setLight({ position: { x: 1, y: 0, z: 3 } });
    expect(spot.position).toMatchObject({ x: 500, y: 0, z: 1500 });
    expect(scene.lightPosition).toEqual({ x: 1, y: 0, z: 3 });

    // A later resize keeps the configured direction/size, scaled to the new
    // scene dimensions.
    scene.resize({
      ...metrics,
      sceneWidth: 1000,
      sceneHeight: 600
    });
    expect(spot.position).toMatchObject({ x: 1000, y: 0, z: 3000 });
  });

  it('applies and resets camera settings', () => {
    const { scene } = createScene();
    scene.resize(metrics);

    scene.setCamera({ distance: 2, near: 5, far: 2000 });
    expect(scene.camera.position.z).toBe(2000);
    expect(scene.camera.near).toBe(5);
    expect(scene.camera.far).toBe(2000);

    scene.resetCamera();
    expect(scene.camera.position.z).toBe(1000);
    expect(scene.camera.near).toBe(1);
    expect(scene.camera.far).toBe(2500);
  });

  it('creates table, enclosure, and light visuals through descriptors', () => {
    const { scene, backend } = createScene();

    scene.createTableVisual({ type: 'plane', width: 100, height: 50 });
    scene.createEnclosureVisual({ type: 'box-outline', width: 10, height: 10, depth: 10 });
    scene.createEnclosureVisual({ type: 'sphere-shell', radius: 20 });
    scene.createEnclosureVisual({ type: 'cylinder-shell', radius: 20, height: 40 });
    scene.createLight({ type: 'ambient', color: 0xffffff });

    expect(scene.scene.children.some((/** @type {any} */ child) => child.kind === 'plane')).toBe(true);
    expect(scene.scene.children.some((/** @type {any} */ child) => child.kind === 'box-outline')).toBe(true);
    expect(scene.scene.children.some((/** @type {any} */ child) => child.kind === 'sphere-shell')).toBe(true);
    expect(scene.scene.children.some((/** @type {any} */ child) => child.kind === 'cylinder-shell')).toBe(true);
    expect(backend.calls.add.length).toBeGreaterThan(0);
  });

  it('disposes the canvas, listeners, visuals, and backend idempotently', () => {
    const { backend, container, scene } = createScene();
    const visual = scene.createDiceVisual({
      id: 'die-1',
      meshData: D6_MESH_DATA,
      materialSet,
      faceMapping: [1, 2, 3, 4, 5, 6]
    });

    expect(backend.canvas.listeners.size).toBe(1);

    scene.dispose();
    expect(container.children).toHaveLength(0);
    expect(backend.canvas.listeners.size).toBe(0);
    expect(backend.calls.disposed).toBe(true);

    expect(() => scene.dispose()).not.toThrow();
    expect(() => visual.dispose()).not.toThrow();
    expect(() => scene.render()).not.toThrow();
  });
});
