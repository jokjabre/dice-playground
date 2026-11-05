/**
 * RaycastPicker
 * Handles clicking or tapping on dice meshes using Three.js Raycaster.
 */

export class RaycastPicker {
    /**
     * @param {Object} [config={}]
     * @param {THREE.Camera} config.camera
     * @param {HTMLElement} [config.container=window]
     * @param {Object} [config.dimensions]
     */
    constructor(config = {}) {
        this.camera = config.camera || null;
        this.container = config.container || null;
        this.dimensions = config.dimensions || null;
        this.raycaster = (typeof THREE !== 'undefined') ? new THREE.Raycaster() : null;
    }

    /**
     * Finds the first intersected dice mesh at client coordinate (x, y).
     * @param {number} clientX
     * @param {number} clientY
     * @param {Array<THREE.Object3D>} diceMeshes
     * @returns {THREE.Object3D|null}
     */
    pick(clientX, clientY, diceMeshes) {
        if (!this.raycaster || !this.camera || !diceMeshes || diceMeshes.length === 0) {
            return null;
        }

        const dims = (this.dimensions && this.dimensions.dimensions) || {
            aspect: 1,
            scene_width: 1000,
            scene_height: 600
        };

        const cw = (typeof window !== 'undefined' ? window.innerWidth : 1000) / 2;
        const aspect = dims.aspect || 1;
        const sceneH = dims.scene_height || 600;
        const sceneW = dims.scene_width || 1000;

        const rayOrigin = this.camera.position;
        const targetDirection = new THREE.Vector3(
            (clientX - cw) / aspect,
            1 - (clientY - sceneH) / aspect,
            sceneW / 9
        ).sub(rayOrigin).normalize();

        this.raycaster.set(rayOrigin, targetDirection);
        const intersects = this.raycaster.intersectObjects(diceMeshes);

        if (intersects && intersects.length > 0) {
            return intersects[0].object;
        }
        return null;
    }
}

