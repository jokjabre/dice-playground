/**
 * InputManager
 * Pointer (mouse/touch) swipe and drag gesture detection.
 * Translates swipe gestures into normalized initial 3D impulse/throw vectors.
 */

import { Geometry } from "../../dice/objects/geometry.js";

export class InputManager {
    /**
     * @param {Object} [config={}]
     * @param {HTMLElement} [config.container=document.body] - Target element to listen for gestures on.
     * @param {Object} [config.dimensions] - Dimensions manager for aspect ratio / scale calculation.
     * @param {Object} [config.options] - Engine options.
     * @param {Function} [config.onThrow] - Callback invoked when a valid swipe throw occurs: (vectors, boost, dist).
     * @param {Function} [config.onPointerDown] - Callback for pointer down.
     * @param {Function} [config.onPointerUp] - Callback for pointer up.
     */
    constructor(config = {}) {
        this.container = typeof config.container === 'string'
            ? document.querySelector(config.container)
            : (config.container || (typeof document !== 'undefined' ? document.body : null));
        this.dimensions = config.dimensions || null;
        this.options = config.options || {};
        this.onThrow = config.onThrow || null;
        this.onPointerDown = config.onPointerDown || null;
        this.onPointerUp = config.onPointerUp || null;

        this.mouseTime = 0;
        this.mouseStart = null;
        this.enabled = false;

        this._onPointerDownHandler = (ev) => this._handlePointerDown(ev);
        this._onPointerUpHandler = (ev) => this._handlePointerUp(ev);

        if (this.container) {
            this.enable();
        }
    }

    /**
     * Extracts client coordinate pair from mouse or touch event.
     * @param {MouseEvent|TouchEvent} ev
     * @returns {{x: number, y: number}}
     */
    getPointerCoords(ev) {
        const touches = ev.changedTouches;
        if (touches && touches.length > 0) {
            return { x: touches[0].clientX, y: touches[0].clientY };
        }
        return { x: ev.clientX, y: ev.clientY };
    }

    _handlePointerDown(ev) {
        if (!this.enabled) return;
        this.mouseTime = Date.now();
        this.mouseStart = this.getPointerCoords(ev);

        if (this.onPointerDown) {
            this.onPointerDown(this.mouseStart, ev);
        }
    }

    _handlePointerUp(ev) {
        if (!this.enabled || !this.mouseStart) return;

        const currentCoords = this.getPointerCoords(ev);
        const vector = {
            x: currentCoords.x - this.mouseStart.x,
            y: -(currentCoords.y - this.mouseStart.y)
        };
        const startTime = this.mouseTime;
        this.mouseStart = null;

        if (this.onPointerUp) {
            this.onPointerUp(currentCoords, ev);
        }

        const dist = Math.sqrt(vector.x * vector.x + vector.y * vector.y);

        // Minimum swipe threshold based on playing field dimensions or default
        const sceneW = (this.dimensions && this.dimensions.dimensions && this.dimensions.dimensions.scene_width) || 1000;
        const sceneH = (this.dimensions && this.dimensions.dimensions && this.dimensions.dimensions.scene_height) || 600;
        const minSwipeThreshold = Math.sqrt(sceneW * sceneH * 0.01);

        if (dist < minSwipeThreshold) {
            return;
        }

        let timeInterval = Date.now() - startTime;
        if (timeInterval > 2000) timeInterval = 2000;
        const boost = Math.sqrt((2500 - timeInterval) / 2500) * dist * 2;

        const normalizedVector = {
            x: vector.x / dist,
            y: vector.y / dist
        };

        const diceCount = (this.options && this.options.diceCount !== undefined) ? this.options.diceCount : 1;
        if (diceCount <= 0) return;

        const vectors = Geometry.generate_vectors(normalizedVector, boost);

        if (this.onThrow) {
            this.onThrow(vectors, boost, dist);
        }
    }

    /**
     * Attaches event listeners.
     */
    enable() {
        if (this.enabled || !this.container) return;
        this.container.addEventListener('mousedown', this._onPointerDownHandler);
        this.container.addEventListener('touchstart', this._onPointerDownHandler, { passive: true });
        this.container.addEventListener('mouseup', this._onPointerUpHandler);
        this.container.addEventListener('touchend', this._onPointerUpHandler, { passive: true });
        this.enabled = true;
    }

    /**
     * Detaches event listeners.
     */
    disable() {
        if (!this.enabled || !this.container) return;
        this.container.removeEventListener('mousedown', this._onPointerDownHandler);
        this.container.removeEventListener('touchstart', this._onPointerDownHandler);
        this.container.removeEventListener('mouseup', this._onPointerUpHandler);
        this.container.removeEventListener('touchend', this._onPointerUpHandler);
        this.mouseStart = null;
        this.enabled = false;
    }

    /**
     * Cleanup resources.
     */
    destroy() {
        this.disable();
        this.container = null;
        this.onThrow = null;
        this.onPointerDown = null;
        this.onPointerUp = null;
    }
}

