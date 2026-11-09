import {
  createDiceMaterialSet,
  createRenderScene
} from '@dice/rendering';
import {
  D6,
  createDiceMeshData,
  getDiceStyle
} from '@dice/dice';
import { computeViewportMetrics } from '@dice/core';

/** @type {any} */
const state = {
  status: 'idle',
  error: null,
  frames: 0,
  threeLoaded: false,
  triangles: 0,
  faceGroups: [],
  renderer: null,
  visual: null
};

/** @type {any} */
const fixtureWindow = /** @type {any} */ (window);

/** @type {any} */
fixtureWindow.__renderFixture = {
  state,
  dispose() {
    state.renderer?.dispose();
    state.renderer = null;
    state.visual = null;
    state.status = 'disposed';
  },
  /**
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    if (!state.renderer) return;
    const metrics = computeViewportMetrics({
      containerWidth: width,
      containerHeight: height,
      sceneWidth: width / 2,
      sceneHeight: height / 2,
      devicePixelRatio: window.devicePixelRatio || 1
    });
    state.renderer.resize(metrics);
  },
  /** @param {number} distance */
  setCamera(distance) {
    state.renderer?.setCamera({ distance });
  }
};

async function start() {
  try {
    const container = document.getElementById('scene');
    if (!container) throw new Error('Render fixture container is missing.');

    const width = container.clientWidth || 480;
    const height = container.clientHeight || 320;
    const metrics = computeViewportMetrics({
      containerWidth: width,
      containerHeight: height,
      sceneWidth: width / 2,
      sceneHeight: height / 2,
      devicePixelRatio: window.devicePixelRatio || 1
    });

    const renderer = await createRenderScene({ container });
    state.renderer = renderer;
    state.threeLoaded = Boolean(/** @type {any} */ (globalThis).THREE);

    renderer.resize(metrics);
    renderer.createTableVisual({
      type: 'plane',
      width: metrics.sceneWidth * 2,
      height: metrics.sceneHeight * 2,
      color: '#2596be'
    });

    const meshData = createDiceMeshData(D6, { radius: 100 });
    const materialSet = createDiceMaterialSet({
      style: getDiceStyle('classic'),
      labels: [1, 2, 3, 4, 5, 6]
    });
    const visual = renderer.createDiceVisual({
      id: 'fixture-die',
      meshData,
      materialSet,
      faceMapping: D6.createFaceMapping()
    });
    visual.setTransform({
      position: { x: 0, y: 0, z: 100 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 }
    });
    state.visual = visual;

    state.triangles = meshData.faces.length;
    state.faceGroups = [...new Set(meshData.faces.map((face) => face.faceIndex))];
    state.materialCount = materialSet.labels.length + 1;

    const renderFrame = () => {
      renderer.render();
      state.frames += 1;
    };

    renderFrame();
    state.status = 'ready';
  } catch (error) {
    state.status = 'error';
    state.error = error instanceof Error ? error.message : String(error);
  }
}

start();
