// @ts-nocheck
/**
 * In-memory render backend used by unit tests. It implements the internal
 * backend surface without Three or the DOM.
 */

/**
 * @param {Object} [options]
 * @param {any[]} [options.pickHits]
 * @returns {any}
 */
export function createFakeBackend(options = {}) {
  const calls = {
    createGeometry: [],
    createDiceMaterials: [],
    applyFaceMapping: [],
    createMesh: [],
    add: [],
    remove: [],
    disposedObjects: [],
    resizes: [],
    rendered: 0
  };

  const canvas = createFakeCanvas();

  const backend = {
    id: 'fake',
    calls,
    canvas,
    pickHits: options.pickHits ?? [],

    /** @param {{ container: any, antialias?: boolean }} spec */
    createRenderer({ container }) {
      container.appendChild(canvas);
      return {
        domElement: canvas,
        shadowMap: {},
        clearColor: null,
        setClearColor(color) {
          this.clearColor = color;
        },
        setPixelRatio(value) {
          this.pixelRatio = value;
        },
        setSize(width, height) {
          this.width = width;
          this.height = height;
        }
      };
    },

    createScene() {
      return createFakeObject('scene', { children: [] });
    },

    createCamera(spec) {
      return createFakeCamera(spec);
    },

    setBackground(scene, color) {
      scene.background = color;
    },

    setClearColor() {},

    resize(renderer, width, height, pixelRatio) {
      calls.resizes.push({ width, height, pixelRatio });
      renderer.width = width;
      renderer.height = height;
      renderer.pixelRatio = pixelRatio;
    },

    createGeometry(meshData) {
      calls.createGeometry.push(meshData);
      return {
        faces: meshData.faces.map((face) => ({
          faceIndex: face.faceIndex,
          materialIndex: face.materialSlot
        })),
        disposed: false,
        dispose() {
          this.disposed = true;
        }
      };
    },

    createDiceMaterials(materialSet) {
      calls.createDiceMaterials.push(materialSet);
      return {
        materials: [
          { slot: 0 },
          ...materialSet.labels.map((entry) => ({ slot: entry.value }))
        ],
        labelSlots: new Map(
          materialSet.labels.map((entry, index) => [entry.value, index + 1])
        )
      };
    },

    applyFaceMapping(geometry, faceMapping, labelSlots) {
      calls.applyFaceMapping.push({ geometry, faceMapping: [...faceMapping], labelSlots });
      for (const face of geometry.faces) {
        if (face.faceIndex < 0) {
          face.materialIndex = 0;
        } else {
          face.materialIndex = labelSlots.get(faceMapping[face.faceIndex]) ?? 0;
        }
      }
      return geometry;
    },

    createMaterial(spec) {
      return { spec };
    },

    createTexture(canvasRef) {
      return { canvas: canvasRef, disposed: false, dispose() { this.disposed = true; } };
    },

    createMesh({ geometry, materials }) {
      const mesh = createFakeObject('dice', { geometry, materials });
      calls.createMesh.push({ geometry, materials, mesh });
      return mesh;
    },

    createPlaneMesh(descriptor) {
      return createFakeObject('plane', descriptor);
    },

    createBoxOutline(descriptor) {
      return createFakeObject('box-outline', descriptor);
    },

    createSphereShell(descriptor) {
      return createFakeObject('sphere-shell', descriptor);
    },

    createCylinderShell(descriptor) {
      return createFakeObject('cylinder-shell', descriptor);
    },

    createLineSegments(descriptor) {
      return createFakeObject('lines', descriptor);
    },

    createLight(descriptor) {
      const light = createFakeObject(descriptor.type, descriptor);
      if (descriptor.type === 'spot') {
        light.target = createFakeObject('target', {});
      }
      return light;
    },

    add(scene, object) {
      calls.add.push(object);
      scene.children.push(object);
    },

    remove(scene, object) {
      calls.remove.push(object);
      const index = scene.children.indexOf(object);
      if (index >= 0) scene.children.splice(index, 1);
    },

    render() {
      calls.rendered += 1;
    },

    pick() {
      return backend.pickHits;
    },

    disposeObject(object) {
      calls.disposedObjects.push(object);
      if (object && typeof object.dispose === 'function') {
        object.dispose();
      }
    },

    dispose() {
      calls.disposed = true;
    }
  };

  return backend;
}

/**
 * @returns {any}
 */
export function createFakeContainer() {
  const canvasSlot = [];

  return {
    children: canvasSlot,
    appendChild(child) {
      canvasSlot.push(child);
      child.parentNode = this;
    },
    removeChild(child) {
      const index = canvasSlot.indexOf(child);
      if (index >= 0) canvasSlot.splice(index, 1);
      child.parentNode = null;
    },
    contains(child) {
      return canvasSlot.includes(child);
    }
  };
}

/**
 * @returns {any}
 */
export function createFakeCanvas() {
  const listeners = new Map();

  return {
    parentNode: null,
    listeners,
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    removeEventListener(name, handler) {
      if (listeners.get(name) === handler) {
        listeners.delete(name);
      }
    }
  };
}

/**
 * @param {string} kind
 * @param {Object} [extra]
 */
function createFakeObject(kind, extra = {}) {
  return {
    kind,
    visible: true,
    userData: {},
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    quaternion: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      set(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
      }
    },
    ...extra
  };
}

/**
 * @param {{ fov: number, aspect: number, near: number, far: number }} spec
 */
function createFakeCamera(spec) {
  return {
    fov: spec.fov,
    aspect: spec.aspect,
    near: spec.near,
    far: spec.far,
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
    updateProjectionMatrix() {
      this.projectionUpdates = (this.projectionUpdates ?? 0) + 1;
    }
  };
}
