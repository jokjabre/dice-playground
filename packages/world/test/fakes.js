// @ts-nocheck
/**
 * Fake renderer stack for world tests. It implements the render-scene surface
 * the world uses (createDiceVisual, createTableVisual, createEnclosureVisual,
 * resize, render, pick, dispose) without Three or the DOM.
 */

export function createFakeRenderer() {
  const visuals = [];
  const diceVisuals = new Map();
  const calls = {
    createDiceVisual: [],
    createTableVisual: [],
    createEnclosureVisual: [],
    resize: [],
    rendered: 0,
    picked: [],
    disposed: false
  };

  function createVisual(id, kind) {
    const entry = {
      id,
      kind,
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      faceMapping: null,
      visible: true,
      disposed: false
    };
    const handle = {
      id,
      setTransform(transform) {
        if (transform.position) Object.assign(entry.position, transform.position);
        if (transform.quaternion) Object.assign(entry.quaternion, transform.quaternion);
      },
      setFaceMapping(mapping) {
        entry.faceMapping = [...mapping];
      },
      setVisible(visible) {
        entry.visible = Boolean(visible);
      },
      dispose() {
        entry.disposed = true;
        const index = visuals.indexOf(entry);
        if (index >= 0) visuals.splice(index, 1);
        if (id && diceVisuals.has(id)) diceVisuals.delete(id);
      }
    };
    entry.handle = handle;
    visuals.push(entry);
    return handle;
  }

  const renderer = {
    visuals,
    diceVisuals,
    calls,

    createDiceVisual({ id, meshData, materialSet, faceMapping }) {
      calls.createDiceVisual.push({ id, meshData, materialSet, faceMapping });
      const handle = createVisual(id, 'dice');
      // Record the initial mapping like the real scene does.
      if (faceMapping) {
        const entry = visuals.find((v) => v.handle === handle);
        if (entry) entry.faceMapping = [...faceMapping];
      }
      diceVisuals.set(id, handle);
      return handle;
    },

    createTableVisual(descriptor) {
      calls.createTableVisual.push({ ...descriptor });
      return createVisual('table', 'table');
    },

    createEnclosureVisual(descriptor) {
      calls.createEnclosureVisual.push({ ...descriptor });
      return createVisual(descriptor.type, 'enclosure');
    },

    createLight() {
      return createVisual('light', 'light');
    },

    setCamera(settings) {
      calls.camera = settings;
    },

    resetCamera() {
      calls.cameraReset = true;
    },

    resize(metrics) {
      calls.resize.push({ ...metrics });
    },

    render() {
      calls.rendered += 1;
    },

    pick(ndc, candidates) {
      calls.picked.push({ ndc: { ...ndc }, candidates: candidates ? [...candidates] : candidates });
      return null;
    },

    dispose() {
      calls.disposed = true;
      for (const entry of [...visuals]) {
        entry.disposed = true;
      }
      visuals.length = 0;
      diceVisuals.clear();
    }
  };

  return renderer;
}

export function createFakeContainer() {
  return { children: [] };
}

export const metrics = Object.freeze({
  containerWidth: 1000,
  containerHeight: 600,
  sceneWidth: 500,
  sceneHeight: 300,
  scale: 45,
  aspect: 1,
  wallHeight: 1000,
  pixelRatio: 1
});

export const wideMetrics = Object.freeze({
  containerWidth: 1600,
  containerHeight: 1000,
  sceneWidth: 800,
  sceneHeight: 500,
  scale: 50,
  aspect: 1,
  wallHeight: 1200,
  pixelRatio: 1
});
