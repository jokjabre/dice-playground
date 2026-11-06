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
     * @param {Object} [cameraOptions]
     * @param {number} [cameraOptions.camera_distance=1] Multiplier on the auto camera distance
     * @param {number} [cameraOptions.camera_near=1] Near clipping plane (0 = default)
     * @param {number} [cameraOptions.camera_far=0] Far clipping plane (0 = auto: distance + 1500)
     */
    update(dimensions, cameraOptions) {
        if (!dimensions) return;
        if (dimensions.scene_width && dimensions.scene_height) {
            this.aspect = dimensions.scene_width / dimensions.scene_height;
            this.camera.aspect = this.aspect;
        }
        if (dimensions.wall_height) {
            const distanceMultiplier = (cameraOptions && cameraOptions.camera_distance > 0)
                ? cameraOptions.camera_distance
                : 1;
            const distance = dimensions.wall_height * distanceMultiplier;
            this.camera.position.z = distance;
            const near = (cameraOptions && cameraOptions.camera_near > 0) ? cameraOptions.camera_near : 1;
            this.camera.near = near;
            this.camera.far = (cameraOptions && cameraOptions.camera_far > 0)
                ? cameraOptions.camera_far
                : distance + 1500;
            this.camera.updateProjectionMatrix();
        }
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

