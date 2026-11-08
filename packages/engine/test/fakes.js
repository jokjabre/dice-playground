// @ts-nocheck
/**
 * Minimal fake renderer for engine browser-mode tests. It records visuals
 * without Three or the DOM, mirroring the world test fakes.
 */

export function createFakeRenderer() {
  const visuals = [];
  const calls = { rendered: 0, resize: [], disposed: false };

  function createVisual(id, kind) {
    const entry = {
      id,
      kind,
      position: { x: 0, y: 0, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      faceMapping: null,
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
      setVisible() {},
      dispose() {
        entry.disposed = true;
        const index = visuals.indexOf(entry);
        if (index >= 0) visuals.splice(index, 1);
      }
    };
    entry.handle = handle;
    visuals.push(entry);
    return handle;
  }

  return {
    visuals,
    calls,
    createDiceVisual({ id, faceMapping }) {
      const handle = createVisual(id, 'dice');
      const entry = visuals.find((v) => v.handle === handle);
      if (entry && faceMapping) entry.faceMapping = [...faceMapping];
      return handle;
    },
    createTableVisual(descriptor) {
      return createVisual('table', 'table');
    },
    createEnclosureVisual(descriptor) {
      return createVisual(descriptor.type, 'enclosure');
    },
    createLight() {
      return createVisual('light', 'light');
    },
    setCamera() {},
    resetCamera() {},
    resize(metrics) {
      calls.resize.push({ ...metrics });
    },
    render() {
      calls.rendered += 1;
    },
    pick() {
      return null;
    },
    dispose() {
      calls.disposed = true;
      visuals.length = 0;
    }
  };
}

export const metrics = Object.freeze({
  containerWidth: 1000,
  containerHeight: 600,
  sceneWidth: 1000,
  sceneHeight: 600,
  scale: 50,
  aspect: 1,
  wallHeight: 1000,
  pixelRatio: 1
});
