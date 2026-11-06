/**
 * Lighting rig setup with spotlight and ambient light with configurable colors and shadow map properties.
 */
export class LightingRig {
    /**
     * @param {Object} [config]
     * @param {number|string} [config.ambientColor=0xf0f5fb]
     * @param {number|string} [config.spotlightColor=0xefdfd5]
     * @param {number} [config.spotlightIntensity=2.0]
     * @param {boolean} [config.castShadow=true]
     */
    constructor(config = {}) {
        this.ambientColor = config.ambientColor !== undefined ? config.ambientColor : 0xf0f5fb;
        this.spotlightColor = config.spotlightColor !== undefined ? config.spotlightColor : 0xefdfd5;
        this.spotlightIntensity = config.spotlightIntensity !== undefined ? config.spotlightIntensity : 2.0;
        this.castShadow = config.castShadow !== undefined ? config.castShadow : true;

        this.ambientLight = new THREE.AmbientLight(this.ambientColor);
        this.spotLight = new THREE.SpotLight(this.spotlightColor, this.spotlightIntensity);

        this.spotLight.target.position.set(0, 1, 0);
        this.spotLight.castShadow = this.castShadow;
        this.spotLight.shadowBias = 0.001;
        this.spotLight.shadowDarkness = 1.1;
        this.spotLight.shadowMapWidth = 1024;
        this.spotLight.shadowMapHeight = 1024;
    }

    /**
     * Attach lights to a Three.js scene.
     * @param {THREE.Scene} scene
     */
    addToScene(scene) {
        if (!scene) return;
        scene.add(this.ambientLight);
        scene.add(this.spotLight);
    }

    /**
     * Remove lights from a Three.js scene.
     * @param {THREE.Scene} scene
     */
    removeFromScene(scene) {
        if (!scene) return;
        scene.remove(this.ambientLight);
        scene.remove(this.spotLight);
    }

    /**
     * Update lighting dimensions and positioning according to scene dimensions.
     * @param {Object} dimensions
     * @param {number} dimensions.scene_width
     * @param {number} dimensions.scene_height
     */
    update(dimensions) {
        if (!dimensions) return;
        const maxWidth = Math.max(
            dimensions.scene_width || 0,
            dimensions.scene_height || 0
        );
        if (maxWidth === 0) return;

        this.spotLight.position.set(-maxWidth / 2, maxWidth / 2, maxWidth * 2);
        this.spotLight.distance = maxWidth * 5;
        this.spotLight.shadowCameraNear = maxWidth / 10;
        this.spotLight.shadowCameraFar = maxWidth * 5;
        this.spotLight.shadowCameraFov = 50;
    }
}

