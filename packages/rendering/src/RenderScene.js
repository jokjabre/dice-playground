import { CameraController } from './camera/CameraController.js';
import { createRenderConfig } from './config/defaults.js';
import { LightingRig } from './lighting/LightingRig.js';
import { RaycastService } from './picking/RaycastService.js';

/**
 * @typedef {import('./config/defaults.js').RenderConfig} RenderConfig
 * @typedef {import('./geometry/meshData.js').DiceMeshData} DiceMeshData
 * @typedef {import('./materials/TextureFactory.js').DiceMaterialSet} DiceMaterialSet
 * @typedef {import('./backends/types.js').VisualHandle} VisualHandle
 * @typedef {import('./backends/types.js').TableDescriptor} TableDescriptor
 * @typedef {import('./backends/types.js').EnclosureVisualDescriptor} EnclosureVisualDescriptor
 * @typedef {import('./backends/types.js').LightDescriptor} LightDescriptor
 */

/**
 * @typedef {Object} ViewportMetrics
 * @property {number} containerWidth
 * @property {number} containerHeight
 * @property {number} sceneWidth
 * @property {number} sceneHeight
 * @property {number} scale
 * @property {number} aspect
 * @property {number} wallHeight
 * @property {number} pixelRatio
 */

/**
 * Backend-neutral render scene. Owns a scene, camera, renderer, and lights, but
 * never a table or enclosure; the world composes those through visual
 * descriptors.
 */
export class RenderScene {
  /** @type {any} */
  #backend;

  /** @type {RenderConfig} */
  #config;

  /** @type {any} */
  #renderer;

  /** @type {any} */
  #scene;

  /** @type {CameraController} */
  #cameraController;

  /** @type {LightingRig} */
  #lighting;

  /** @type {RaycastService} */
  #raycast;

  /** @type {any} */
  #canvas;

  /** @type {any} */
  #contextLostHandler;

  /** @type {Map<string, { object: any, dispose: () => void }>} */
  #diceVisuals = new Map();

  /** @type {Set<{ object: any, dispose: () => void }>} */
  #visuals = new Set();

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {{ backend: any, container: HTMLElement, config?: Partial<RenderConfig> }} options
   */
  constructor({ backend, container, config = {} }) {
    if (!backend) {
      throw new TypeError(
        'RenderScene requires a render backend. Use createRenderScene() to load the default backend.'
      );
    }
    if (!container) {
      throw new TypeError('RenderScene requires a DOM container.');
    }

    this.#backend = backend;
    this.#config = createRenderConfig(config);

    this.#renderer = backend.createRenderer({
      container,
      antialias: this.#config.antialias
    });

    this.#scene = backend.createScene();
    backend.setBackground(this.#scene, this.#config.background);
    backend.setClearColor(this.#renderer, this.#config.background);

    this.#cameraController = new CameraController({
      backend,
      config: this.#config
    });

    this.#lighting = new LightingRig({ backend, config: this.#config });
    this.#lighting.attach(this.#scene);

    this.#raycast = new RaycastService({
      backend,
      scene: this.#scene,
      camera: this.#cameraController.camera
    });

    this.#canvas = this.#renderer.domElement ?? null;
    this.#contextLostHandler = (/** @type {Event} */ event) => {
      event.preventDefault?.();
    };

    if (this.#canvas && typeof this.#canvas.addEventListener === 'function') {
      this.#canvas.addEventListener('webglcontextlost', this.#contextLostHandler);
    }
  }

  /** @returns {any} Opaque scene handle for this package only. */
  get scene() {
    return this.#scene;
  }

  /** @returns {any} Opaque camera handle for this package only. */
  get camera() {
    return this.#cameraController.camera;
  }

  /** @returns {RenderConfig} */
  get config() {
    return this.#config;
  }

  /**
   * @param {any} object
   * @returns {any}
   */
  add(object) {
    this.#assertActive();
    this.#backend.add(this.#scene, object);
    return object;
  }

  /**
   * @param {any} object
   * @returns {void}
   */
  remove(object) {
    if (!object) return;
    this.#backend.remove(this.#scene, object);
  }

  /**
   * @param {{ id: string, meshData: DiceMeshData, materialSet: DiceMaterialSet, faceMapping: number[] }} options
   * @returns {VisualHandle}
   */
  createDiceVisual({ id, meshData, materialSet, faceMapping }) {
    this.#assertActive();
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError('createDiceVisual requires a non-empty die id.');
    }

    const geometry = this.#backend.createGeometry(meshData);
    const { materials, labelSlots } = this.#backend.createDiceMaterials(
      materialSet
    );

    this.#backend.applyFaceMapping(geometry, faceMapping, labelSlots);

    const object = this.#backend.createMesh({
      geometry,
      materials,
      castShadow: this.#config.shadows,
      receiveShadow: false
    });
    object.userData = { ...(object.userData ?? {}), dieId: id };
    this.#backend.add(this.#scene, object);

    const entry = {
      object,
      dispose: () => {
        if (this.#disposed) return;
        this.#backend.remove(this.#scene, object);
        this.#backend.disposeObject(object);
        this.#diceVisuals.delete(id);
      }
    };
    this.#diceVisuals.set(id, entry);

    return this.#createVisualHandle(
      id,
      object,
      (mapping) => {
        this.#backend.applyFaceMapping(geometry, mapping, labelSlots);
      },
      entry
    );
  }

  /**
   * @param {TableDescriptor} descriptor
   * @returns {VisualHandle}
   */
  createTableVisual(descriptor) {
    this.#assertActive();
    if (!descriptor || descriptor.type !== 'plane') {
      throw new RangeError('createTableVisual supports the "plane" descriptor.');
    }

    const object = this.#backend.createPlaneMesh({
      width: descriptor.width,
      height: descriptor.height,
      color: descriptor.color ?? this.#config.colors.desk,
      receiveShadow: descriptor.receiveShadow ?? this.#config.shadows
    });

    return this.#trackVisual('table', object);
  }

  /**
   * @param {EnclosureVisualDescriptor} descriptor
   * @returns {VisualHandle}
   */
  createEnclosureVisual(descriptor) {
    this.#assertActive();

    /** @type {any} */
    let object;

    switch (descriptor.type) {
      case 'box-outline':
        object = this.#backend.createBoxOutline(descriptor);
        break;
      case 'sphere-shell':
        object = this.#backend.createSphereShell(descriptor);
        break;
      case 'cylinder-shell':
        object = this.#backend.createCylinderShell(descriptor);
        break;
      default:
        throw new RangeError(
          `Unknown enclosure visual type: ${String(/** @type {any} */ (descriptor).type)}`
        );
    }

    return this.#trackVisual('enclosure', object);
  }

  /**
   * @param {LightDescriptor} descriptor
   * @returns {VisualHandle}
   */
  createLight(descriptor) {
    this.#assertActive();
    const light = this.#backend.createLight(descriptor);
    this.#backend.add(this.#scene, light);

    const target = light.target ?? null;
    if (target) {
      this.#backend.add(this.#scene, target);
    }

    const entry = {
      object: light,
      dispose: () => {
        if (this.#disposed) return;
        this.#backend.remove(this.#scene, light);
        if (target) this.#backend.remove(this.#scene, target);
        this.#backend.disposeObject(light);
      }
    };
    this.#visuals.add(entry);

    return this.#createVisualHandle('light', light, null, entry);
  }

  /**
   * @param {{ distance?: number, near?: number, far?: number }} [settings]
   * @returns {void}
   */
  setCamera(settings = {}) {
    this.#cameraController.set(settings);
  }

  /** @returns {void} */
  resetCamera() {
    this.#cameraController.reset();
  }

  /**
   * @param {ViewportMetrics} metrics
   * @returns {void}
   */
  resize(metrics) {
    this.#assertActive();
    if (!metrics) return;

    const width = metrics.sceneWidth * 2;
    const height = metrics.sceneHeight * 2;

    if (width > 0 && height > 0) {
      this.#backend.resize(
        this.#renderer,
        width,
        height,
        metrics.pixelRatio
      );
    }

    this.#cameraController.update(metrics);
    this.#lighting.update(metrics);
  }

  /** @returns {void} */
  render() {
    if (this.#disposed) return;
    this.#backend.render(this.#scene, this.#cameraController.camera);
  }

  /**
   * @param {{ x: number, y: number }} ndc
   * @param {Array<string|VisualHandle|any>} [candidates]
   * @returns {{ dieId: string, distance: number, point: { x: number, y: number, z: number } }|null}
   */
  pick(ndc, candidates) {
    this.#assertActive();

    const objects = this.#resolveCandidates(candidates);
    return this.#raycast.pick(ndc, objects);
  }

  /**
   * @returns {void}
   */
  dispose() {
    if (this.#disposed) return;

    if (this.#canvas && typeof this.#canvas.removeEventListener === 'function') {
      this.#canvas.removeEventListener(
        'webglcontextlost',
        this.#contextLostHandler
      );
    }

    if (this.#canvas && this.#canvas.parentNode) {
      this.#canvas.parentNode.removeChild(this.#canvas);
    }

    for (const entry of [...this.#diceVisuals.values()]) {
      entry.dispose();
    }
    this.#diceVisuals.clear();

    for (const entry of [...this.#visuals]) {
      entry.dispose();
    }
    this.#visuals.clear();

    this.#lighting.dispose();
    this.#cameraController.dispose();
    this.#backend.disposeObject(this.#scene);
    this.#backend.dispose();

    this.#disposed = true;
    this.#scene = null;
    this.#renderer = null;
    this.#canvas = null;
  }

  /**
   * @param {Array<string|VisualHandle|any>|undefined} candidates
   * @returns {any[]}
   */
  #resolveCandidates(candidates) {
    if (!candidates) {
      return [...this.#diceVisuals.values()].map((entry) => entry.object);
    }

    /** @type {any[]} */
    const objects = [];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const entry = this.#diceVisuals.get(candidate);
        if (entry) objects.push(entry.object);
        continue;
      }

      if (candidate && typeof candidate === 'object') {
        if (
          candidate.userData &&
          typeof candidate.userData.dieId === 'string'
        ) {
          objects.push(candidate);
          continue;
        }

        if (
          typeof candidate.id === 'string' &&
          this.#diceVisuals.has(candidate.id)
        ) {
          objects.push(/** @type {any} */ (this.#diceVisuals.get(candidate.id)).object);
          continue;
        }

        objects.push(candidate);
      }
    }

    return objects;
  }

  /**
   * @param {string} id
   * @param {any} object
   * @param {((mapping: number[]) => void)|null} onFaceMapping
   * @param {{ object: any, dispose: () => void }} [entry]
   * @returns {VisualHandle}
   */
  #createVisualHandle(id, object, onFaceMapping, entry) {
    let disposed = false;
    const tracked = entry ?? { object, dispose: () => {} };

    return {
      id,
      setTransform: ({ position, quaternion }) => {
        if (disposed) return;
        if (position && object.position) {
          object.position.set(position.x, position.y, position.z);
        }
        if (quaternion && object.quaternion) {
          object.quaternion.set(
            quaternion.x,
            quaternion.y,
            quaternion.z,
            quaternion.w
          );
        }
      },
      setFaceMapping: (mapping) => {
        if (disposed) return;
        onFaceMapping?.(mapping);
        if (object.userData) {
          object.userData.faceMapping = mapping.slice();
        }
      },
      setVisible: (visible) => {
        if (disposed) return;
        object.visible = Boolean(visible);
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        tracked.dispose();
      }
    };
  }

  /**
   * @param {string} id
   * @param {any} object
   * @returns {VisualHandle}
   */
  #trackVisual(id, object) {
    this.#backend.add(this.#scene, object);

    const entry = {
      object,
      dispose: () => {
        if (this.#disposed) return;
        this.#backend.remove(this.#scene, object);
        this.#backend.disposeObject(object);
      }
    };
    this.#visuals.add(entry);

    return this.#createVisualHandle(id, object, null, entry);
  }

  /** @returns {void} */
  #assertActive() {
    if (this.#disposed) {
      throw new Error('RenderScene has been disposed.');
    }
  }
}

/**
 * Create a render scene, loading the default Three r73 backend lazily when one
 * is not supplied. The dynamic import keeps Node imports of this package safe.
 *
 * @param {{ backend?: any, container: HTMLElement, config?: Partial<RenderConfig> }} options
 * @returns {Promise<RenderScene>}
 */
export async function createRenderScene({ backend, container, config = {} }) {
  const resolved =
    backend ??
    (await import('./backends/three-r73/ThreeLegacyBackend.js'))
      .createThreeLegacyBackend;

  return new RenderScene({
    backend: typeof resolved === 'function' ? await resolved() : resolved,
    container,
    config
  });
}
