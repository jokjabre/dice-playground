import { CameraController } from './CameraController.js';
import { LightingRig } from './LightingRig.js';
import { MeshBodySync } from './MeshBodySync.js';

/**
 * Encapsulates THREE.Scene, THREE.WebGLRenderer, CameraController, and LightingRig.
 * Manages clean container attachment, shadows, and resizing without direct DOM lookups.
 */
export class RenderScene {
    /**
     * @param {Object} [config]
     * @param {HTMLElement} [config.container]
     * @param {Object} [config.options]
     * @param {CameraController} [config.cameraController]
     * @param {LightingRig} [config.lightingRig]
     */
    constructor(config = {}) {
        this.options = config.options || {};
        const colors = this.options.colors || {};

        this.scene = new THREE.Scene();

        this.cameraController = config.cameraController || new CameraController({
            fov: 20,
            aspect: 1,
            near: 1,
            far: 1000
        });

        this.lightingRig = config.lightingRig || new LightingRig({
            ambientColor: colors.ambient_light,
            spotlightColor: colors.spotlight,
            spotlightIntensity: 2.0,
            castShadow: this.options.use_shadows !== undefined ? this.options.use_shadows : true
        });
        this.lightingRig.addToScene(this.scene);

        // Desk plane mesh
        this.desk = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshPhongMaterial({
                color: new THREE.Color(colors.desk || 0xe0e0e0)
            })
        );
        this.desk.receiveShadow = this.options.use_shadows !== undefined ? this.options.use_shadows : true;
        this.scene.add(this.desk);

        // Renderer
        const hasWebGL = typeof window !== 'undefined' && !!window.WebGLRenderingContext;
        this.renderer = hasWebGL
            ? new THREE.WebGLRenderer({ antialias: true })
            : (THREE.CanvasRenderer ? new THREE.CanvasRenderer({ antialias: true }) : null);

        if (this.renderer) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.renderer.setClearColor(0xffffff, 1);
        }

        if (config.container && this.renderer) {
            this.attachTo(config.container);
        }
    }

    /**
     * Get camera instance.
     * @returns {THREE.PerspectiveCamera}
     */
    get camera() {
        return this.cameraController.instance;
    }

    /**
     * Get underlying THREE.Scene instance.
     * @returns {THREE.Scene}
     */
    get instance() {
        return this.scene;
    }

    /**
     * Get canvas DOM element.
     * @returns {HTMLCanvasElement}
     */
    get domElement() {
        return this.renderer ? this.renderer.domElement : null;
    }

    /**
     * Attach renderer canvas to a DOM container.
     * @param {HTMLElement} container
     */
    attachTo(container) {
        if (!container || !this.renderer) return;
        if (!container.contains(this.renderer.domElement)) {
            container.appendChild(this.renderer.domElement);
        }
    }

    /**
     * Add item to Three.js scene.
     * @param {THREE.Object3D} item
     */
    add(item) {
        if (item) this.scene.add(item);
    }

    /**
     * Remove item from Three.js scene.
     * @param {THREE.Object3D} item
     */
    remove(item) {
        if (item) this.scene.remove(item);
    }

    /**
     * Update dimensions: camera projection, lighting, desk size, and renderer viewport.
     * @param {Object} dimensions
     * @param {number} dimensions.scene_width
     * @param {number} dimensions.scene_height
     * @param {number} dimensions.wall_height
     */
    updateDimensions(dimensions) {
        if (!dimensions) return;

        // Update camera
        this.cameraController.update(dimensions, this.options);

        // Update lighting
        this.lightingRig.update(dimensions);

        // Update desk mesh
        const w2 = (dimensions.scene_width || 0) * 2;
        const h2 = (dimensions.scene_height || 0) * 2;
        if (w2 > 0 && h2 > 0) {
            if (this.desk.geometry) {
                this.desk.geometry.dispose();
            }
            this.desk.geometry = new THREE.PlaneGeometry(w2, h2, 1, 1);
        }

        // Update renderer size
        if (this.renderer && w2 > 0 && h2 > 0) {
            this.renderer.setSize(w2, h2);
        }
    }

    /**
     * Synchronize rigid bodies in scene.
     */
    syncMeshes() {
        MeshBodySync.syncScene(this.scene);
    }

    /**
     * Render the scene with the camera.
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

