/**
 * Perspective camera management, aspect ratio updates, and projection positioning.
 */
export class CameraController {
    /**
     * @param {Object} [config]
     * @param {number} [config.fov=20] Field of view
     * @param {number} [config.aspect=1] Aspect ratio
     * @param {number} [config.near=1] Near plane
     * @param {number} [config.far=1000] Far plane
     * @param {Object} [config.position] Initial position {x, y, z}
     */
    constructor(config = {}) {
        this.fov = config.fov !== undefined ? config.fov : 20;
        this.aspect = config.aspect !== undefined ? config.aspect : 1;
        this.near = config.near !== undefined ? config.near : 1;
        this.far = config.far !== undefined ? config.far : 1000;

        this.camera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far);

        if (config.position) {
            this.camera.position.set(
                config.position.x || 0,
                config.position.y || 0,
                config.position.z !== undefined ? config.position.z : 0
            );
        }
    }

    /**
     * Get underlying THREE.PerspectiveCamera.
     * @returns {THREE.PerspectiveCamera}
     */
    get instance() {
        return this.camera;
    }

    /**
     * Update camera projection and position based on container/playing field dimensions.
     * @param {Object} dimensions
     * @param {number} dimensions.scene_width
     * @param {number} dimensions.scene_height
     * @param {number} dimensions.wall_height
     */
    update(dimensions) {
        if (!dimensions) return;
        if (dimensions.scene_width && dimensions.scene_height) {
            this.aspect = dimensions.scene_width / dimensions.scene_height;
            this.camera.aspect = this.aspect;
        }
        if (dimensions.wall_height) {
            this.camera.far = dimensions.wall_height * 1.3;
            this.camera.position.z = dimensions.wall_height;
        }
        this.camera.updateProjectionMatrix();
    }

    /**
     * Manually set camera position.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setPosition(x, y, z) {
        this.camera.position.set(x, y, z);
        this.camera.updateProjectionMatrix();
    }
}

