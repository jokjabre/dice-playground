import { applyFaceMapping, buildDiceMaterials } from './buildMaterial.js';
import { buildDiceGeometry } from './buildGeometry.js';
import { loadThree } from './loadThree.js';
import { TextureFactory } from '../../materials/TextureFactory.js';

/**
 * Three r73 implementation of the internal `RenderBackend` contract.
 *
 * Everything Three-specific stays in this folder. Callers only receive opaque
 * objects and plain data.
 */
export class ThreeLegacyBackend {
  id = 'three-r73';

  /** @type {any} */
  #THREE;

  /** @type {any} */
  #renderer = null;

  /** @type {Document|null} */
  #document;

  /** @type {TextureFactory|null} */
  #textureFactory = null;

  /**
   * @param {{ THREE: any, document?: Document|null }} options
   */
  constructor({ THREE, document: documentRef }) {
    if (!THREE) {
      throw new TypeError('ThreeLegacyBackend requires the THREE namespace.');
    }

    this.#THREE = THREE;
    this.#document =
      documentRef ?? (typeof document === 'undefined' ? null : document);
  }

  /**
   * @param {{ document?: Document|null }} [options]
   * @returns {Promise<ThreeLegacyBackend>}
   */
  static async create(options = {}) {
    const THREE = await loadThree({ document: options.document ?? null });
    return new ThreeLegacyBackend({ THREE, document: options.document });
  }

  // ---------------------------------------------------------------------------
  // Scene, camera, renderer
  // ---------------------------------------------------------------------------

  /** @returns {any} */
  createScene() {
    return new this.#THREE.Scene();
  }

  /**
   * @param {{ fov?: number, aspect?: number, near?: number, far?: number, position?: { x: number, y: number, z: number } }} [spec]
   * @returns {any}
   */
  createCamera(spec = {}) {
    const camera = new this.#THREE.PerspectiveCamera(
      spec.fov ?? 20,
      spec.aspect ?? 1,
      spec.near ?? 1,
      spec.far ?? 1000
    );

    if (spec.position) {
      camera.position.set(
        spec.position.x,
        spec.position.y,
        spec.position.z
      );
    }

    return camera;
  }

  /**
   * @param {{ container: HTMLElement, antialias?: boolean }} options
   * @returns {any}
   */
  createRenderer({ container, antialias = true }) {
    const hasWebGL =
      typeof window !== 'undefined' && Boolean(window.WebGLRenderingContext);

    /** @type {any} */
    let renderer = null;

    if (hasWebGL) {
      renderer = new this.#THREE.WebGLRenderer({ antialias });
    } else if (this.#THREE.CanvasRenderer) {
      renderer = new this.#THREE.CanvasRenderer({ antialias });
    } else {
      throw new Error(
        'WebGL is unavailable and the vendored Three r73 build has no CanvasRenderer fallback.'
      );
    }

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = this.#THREE.PCFShadowMap;
    renderer.setClearColor(0xffffff, 1);

    if (container && renderer.domElement) {
      container.appendChild(renderer.domElement);
    }

    this.#renderer = renderer;
    return renderer;
  }

  /**
   * @param {any} scene
   * @param {number|string} color
   * @returns {void}
   */
  setBackground(scene, color) {
    scene.background = new this.#THREE.Color(color);
  }

  /**
   * @param {any} renderer
   * @param {number|string} color
   * @returns {void}
   */
  setClearColor(renderer, color) {
    renderer.setClearColor(color, 1);
  }

  /**
   * @param {any} renderer
   * @param {number} width
   * @param {number} height
   * @param {number} [pixelRatio]
   * @returns {void}
   */
  resize(renderer, width, height, pixelRatio = 1) {
    if (typeof renderer.setPixelRatio === 'function') {
      renderer.setPixelRatio(pixelRatio);
    }
    renderer.setSize(width, height);
  }

  // ---------------------------------------------------------------------------
  // Geometry, materials, meshes
  // ---------------------------------------------------------------------------

  /**
   * @param {import('../../geometry/meshData.js').DiceMeshData} meshData
   * @returns {any}
   */
  createGeometry(meshData) {
    return buildDiceGeometry(this.#THREE, meshData);
  }

  /**
   * @param {import('../../materials/TextureFactory.js').DiceMaterialSet} materialSet
   * @returns {{ materials: any[], labelSlots: Map<number, number> }}
   */
  createDiceMaterials(materialSet) {
    this.#textureFactory ??= new TextureFactory({
      backend: this,
      document: this.#document
    });

    return buildDiceMaterials({
      backend: this,
      materialSet,
      textureFactory: this.#textureFactory
    });
  }

  /**
   * @param {any} geometry
   * @param {number[]} faceMapping
   * @param {Map<number, number>} labelSlots
   * @returns {any}
   */
  applyFaceMapping(geometry, faceMapping, labelSlots) {
    return applyFaceMapping(geometry, faceMapping, labelSlots);
  }

  /**
   * @param {import('../../materials/TextureFactory.js').MaterialSpec} spec
   * @returns {any}
   */
  createMaterial(spec) {
    return new this.#THREE.MeshPhongMaterial({
      color: spec.color,
      specular: spec.specular,
      shininess: spec.shininess,
      map: spec.map,
      shading: this.#THREE.FlatShading
    });
  }

  /**
   * @param {HTMLCanvasElement|any} canvas
   * @returns {any}
   */
  createTexture(canvas) {
    const texture = new this.#THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * @param {{ geometry: any, materials: any[], castShadow?: boolean, receiveShadow?: boolean }} options
   * @returns {any}
   */
  createMesh({ geometry, materials, castShadow = true, receiveShadow = false }) {
    const material =
      materials.length > 1
        ? new this.#THREE.MeshFaceMaterial(materials)
        : materials[0];
    const mesh = new this.#THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }

  /**
   * @param {{ width: number, height: number, color: number|string, receiveShadow?: boolean }} descriptor
   * @returns {any}
   */
  createPlaneMesh({ width, height, color, receiveShadow = false }) {
    const geometry = new this.#THREE.PlaneGeometry(width, height, 1, 1);
    const material = new this.#THREE.MeshPhongMaterial({
      color: new this.#THREE.Color(color)
    });
    const mesh = new this.#THREE.Mesh(geometry, material);
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }

  /**
   * @param {{ width: number, height: number, depth: number, color?: number|string, opacity?: number }} descriptor
   * @returns {any}
   */
  createBoxOutline({
    width,
    height,
    depth,
    color = 0xffffff,
    opacity = 0.35
  }) {
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const halfDepth = depth / 2;
    const corners = [
      [-halfWidth, -halfHeight, -halfDepth],
      [halfWidth, -halfHeight, -halfDepth],
      [halfWidth, halfHeight, -halfDepth],
      [-halfWidth, halfHeight, -halfDepth],
      [-halfWidth, -halfHeight, halfDepth],
      [halfWidth, -halfHeight, halfDepth],
      [halfWidth, halfHeight, halfDepth],
      [-halfWidth, halfHeight, halfDepth]
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    const geometry = new this.#THREE.Geometry();
    for (const [a, b] of edges) {
      for (const index of [a, b]) {
        const corner = corners[index];
        geometry.vertices.push(
          new this.#THREE.Vector3(corner[0], corner[1], corner[2])
        );
      }
    }

    const material = new this.#THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity
    });

    return new this.#THREE.LineSegments(geometry, material);
  }

  /**
   * @param {{ radius: number, color?: number|string, opacity?: number, segments?: number }} descriptor
   * @returns {any}
   */
  createSphereShell({ radius, color = 0xffffff, opacity = 0.18, segments = 24 }) {
    const geometry = new this.#THREE.SphereGeometry(radius, segments, segments / 2);
    const material = new this.#THREE.MeshPhongMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: this.#THREE.DoubleSide,
      wireframe: false
    });
    return new this.#THREE.Mesh(geometry, material);
  }

  /**
   * @param {{ radius: number, height: number, color?: number|string, opacity?: number, segments?: number }} descriptor
   * @returns {any}
   */
  createCylinderShell({
    radius,
    height,
    color = 0xffffff,
    opacity = 0.18,
    segments = 24
  }) {
    const geometry = new this.#THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true
    );
    const material = new this.#THREE.MeshPhongMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      side: this.#THREE.DoubleSide,
      wireframe: false
    });
    const mesh = new this.#THREE.Mesh(geometry, material);
    // The world is Z-up; Three's cylinder is authored along Y.
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  /**
   * @param {{ vertices: Array<[number, number, number]>, color?: number|string, opacity?: number, linewidth?: number }} descriptor
   * @returns {any}
   */
  createLineSegments({
    vertices,
    color = 0xffffff,
    opacity = 0.5,
    linewidth = 1
  }) {
    const geometry = new this.#THREE.Geometry();
    for (const vertex of vertices) {
      geometry.vertices.push(
        new this.#THREE.Vector3(vertex[0], vertex[1], vertex[2])
      );
    }
    const material = new this.#THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      linewidth
    });
    return new this.#THREE.LineSegments(geometry, material);
  }

  // ---------------------------------------------------------------------------
  // Lights
  // ---------------------------------------------------------------------------

  /**
   * @param {import('../types.js').LightDescriptor} descriptor
   * @returns {any}
   */
  createLight(descriptor) {
    if (descriptor.type === 'ambient') {
      return new this.#THREE.AmbientLight(descriptor.color ?? 0xffffff);
    }

    if (descriptor.type === 'spot') {
      const light = new this.#THREE.SpotLight(
        descriptor.color ?? 0xffffff,
        descriptor.intensity ?? 2
      );

      if (descriptor.position) {
        light.position.set(
          descriptor.position.x,
          descriptor.position.y,
          descriptor.position.z
        );
      }
      if (descriptor.target) {
        light.target.position.set(
          descriptor.target.x,
          descriptor.target.y,
          descriptor.target.z
        );
      }

      light.castShadow = descriptor.castShadow ?? true;
      light.shadowBias = 0.001;
      light.shadowDarkness = 1.1;
      light.shadowMapWidth = 1024;
      light.shadowMapHeight = 1024;
      return light;
    }

    throw new RangeError(
      `Unknown light descriptor type: ${String(/** @type {any} */ (descriptor).type)}`
    );
  }

  // ---------------------------------------------------------------------------
  // Scene graph, rendering, picking, disposal
  // ---------------------------------------------------------------------------

  /**
   * @param {any} scene
   * @param {any} object
   * @returns {void}
   */
  add(scene, object) {
    scene.add(object);
  }

  /**
   * @param {any} scene
   * @param {any} object
   * @returns {void}
   */
  remove(scene, object) {
    scene.remove(object);
  }

  /**
   * @param {any} scene
   * @param {any} camera
   * @returns {void}
   */
  render(scene, camera) {
    if (this.#renderer) {
      this.#renderer.render(scene, camera);
    }
  }

  /**
   * @param {any} scene
   * @param {any} camera
   * @param {{ x: number, y: number }} ndc
   * @param {any[]} candidates
   * @returns {Array<{ object: any, distance: number, point: { x: number, y: number, z: number } }>}
   */
  pick(scene, camera, ndc, candidates) {
    if (!candidates || candidates.length === 0) return [];

    const raycaster = new this.#THREE.Raycaster();
    raycaster.setFromCamera(
      new this.#THREE.Vector2(ndc.x, ndc.y),
      camera
    );

    const intersections = raycaster.intersectObjects(candidates, true);
    return intersections.map((/** @type {any} */ intersection) => ({
      object: intersection.object,
      distance: intersection.distance,
      point: {
        x: intersection.point.x,
        y: intersection.point.y,
        z: intersection.point.z
      }
    }));
  }

  /**
   * @param {any} object
   * @returns {void}
   */
  disposeObject(object) {
    if (!object) return;

    if (typeof object.traverse === 'function') {
      object.traverse((/** @type {any} */ child) => {
        this.#disposeResources(child);
      });
    } else {
      this.#disposeResources(object);
    }
  }

  /**
   * @param {any} object
   * @returns {void}
   */
  #disposeResources(object) {
    if (object.geometry && typeof object.geometry.dispose === 'function') {
      object.geometry.dispose();
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];

    for (const material of materials) {
      if (material.map && typeof material.map.dispose === 'function') {
        material.map.dispose();
      }
      if (typeof material.dispose === 'function') {
        material.dispose();
      }
    }
  }

  /** @returns {void} */
  dispose() {
    this.#textureFactory = null;
  }
}

/**
 * @param {{ document?: Document|null }} [options]
 * @returns {Promise<ThreeLegacyBackend>}
 */
export async function createThreeLegacyBackend(options = {}) {
  return ThreeLegacyBackend.create(options);
}
