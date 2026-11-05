/**
 * RaycastPicker
 * Handles clicking or tapping on dice meshes using Three.js Raycaster.
 */

export class RaycastPicker {
    /**
     * @param {Object} [config={}]
     * @param {THREE.Camera} config.camera
     * @param {HTMLElement} [config.container] - Element containing the renderer canvas.
     * @param {HTMLCanvasElement} [config.canvas] - Renderer canvas (auto-detected if omitted).
     * @param {Object} [config.dimensions] - Legacy dimensions manager fallback.
     */
    constructor(config = {}) {
        this.camera = config.camera || null;
        this.container = config.container || null;
        this.canvas = config.canvas || this._findCanvas();
        this.dimensions = config.dimensions || null;
        this.raycaster = (typeof THREE !== 'undefined') ? new THREE.Raycaster() : null;
    }

    /**
     * Locates the renderer canvas without assuming a specific DOM layout.
     * @returns {HTMLCanvasElement|null}
     * @private
     */
    _findCanvas() {
        if (typeof document === 'undefined') return null;
        if (this.container && typeof this.container.querySelector === 'function') {
            const nested = this.container.querySelector('canvas');
            if (nested) return nested;
        }
        return document.querySelector('canvas');
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

        if (!this._setRayFromClient(clientX, clientY)) {
            this._setRayFromDimensions(clientX, clientY);
        }

        const intersects = this.raycaster.intersectObjects(diceMeshes);

        if (intersects && intersects.length > 0) {
            return intersects[0].object;
        }
        return null;
    }

    /**
     * Uses standard normalized device coordinates when a renderer canvas is available.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {boolean} True if the ray was configured.
     * @private
     */
    _setRayFromClient(clientX, clientY) {
        if (!this.canvas || typeof this.canvas.getBoundingClientRect !== 'function' ||
            typeof this.raycaster.setFromCamera !== 'function') {
            return false;
        }

        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;

        const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        return true;
    }

    /**
     * Legacy fallback for environments without a canvas (e.g. headless use).
     * @param {number} clientX
     * @param {number} clientY
     * @private
     */
    _setRayFromDimensions(clientX, clientY) {
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
    }
}
