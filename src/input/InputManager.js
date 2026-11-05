/**
 * InputManager
 * Pointer (mouse/touch) swipe and drag gesture detection.
 * Translates swipe gestures into standardized initial 3D throw vectors.
 *
 * The manager is intentionally self-contained: it does not read the legacy
 * global playing field/options modules. Dimensions, dice count, and the random
 * generator are all supplied through configuration.
 */

import { rndGen as defaultRndGen } from '../utils/rndGen.js';

export class InputManager {
    /**
     * @param {Object} [config={}]
     * @param {HTMLElement|string} [config.container=document.body] - Target element to listen for gestures on.
     * @param {Object} [config.dimensions] - Dimensions manager (or raw dimensions object).
     * @param {Object} [config.options] - Engine options.
     * @param {Object} [config.rndGen] - Random generator used to create throw vectors.
     * @param {number} [config.dieInertia=13] - Inertia factor used for initial angular velocity.
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
        this.rndGen = config.rndGen || defaultRndGen;
        this.dieInertia = config.dieInertia !== undefined ? config.dieInertia : 13;
        this.onThrow = config.onThrow || null;
        this.onPointerDown = config.onPointerDown || null;
        this.onPointerUp = config.onPointerUp || null;

        this.mouseTime = 0;
        this.mouseStart = null;
        this.lastVectors = [];
        this.enabled = false;

        this._onPointerDownHandler = (ev) => this._handlePointerDown(ev);
        this._onPointerUpHandler = (ev) => this._handlePointerUp(ev);
        this._onPointerCancelHandler = () => this._cancelGesture();

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

    /**
     * Resolves the active scene dimensions regardless of whether a DimensionsManager
     * wrapper or a plain dimensions object was supplied.
     * @returns {{scene_width: number, scene_height: number}}
     * @private
     */
    _getSceneDimensions() {
        const dims = (this.dimensions && this.dimensions.dimensions)
            ? this.dimensions.dimensions
            : this.dimensions;

        return {
            scene_width: (dims && dims.scene_width) || 1000,
            scene_height: (dims && dims.scene_height) || 600
        };
    }

    /**
     * Generates the per-die throw vectors for a gesture.
     * @param {{x: number, y: number}} vector - Normalized swipe direction.
     * @param {number} boost - Gesture speed multiplier.
     * @returns {Array<Object>} Standardized 3D throw descriptions.
     */
    generateThrowVectors(vector, boost) {
        const { scene_width, scene_height } = this._getSceneDimensions();
        const diceCount = (this.options && this.options.diceCount !== undefined)
            ? this.options.diceCount
            : 1;
        const rnd = this.rndGen || defaultRndGen;
        const vectors = [];

        for (let i = 0; i < diceCount; i++) {
            const vec = rnd.make_random_vector(vector);
            const pos = {
                x: scene_width * (vec.x > 0 ? -1 : 1) * 0.9,
                y: scene_height * (vec.y > 0 ? -1 : 1) * 0.9,
                z: rnd.rnd() * 200 + 200
            };

            const projector = Math.abs(vec.x / vec.y);
            if (projector > 1.0) {
                pos.y /= projector;
            } else {
                pos.x *= projector;
            }

            const velvec = rnd.make_random_vector(vector);
            const velocity = { x: velvec.x * boost, y: velvec.y * boost, z: -10 };
            const angle = {
                x: -(rnd.rnd() * vec.y * 5 + this.dieInertia * vec.y),
                y: rnd.rnd() * vec.x * 5 + this.dieInertia * vec.x,
                z: 0
            };
            const axis = { x: rnd.rnd(), y: rnd.rnd(), z: rnd.rnd(), a: rnd.rnd() };

            vectors.push({ pos, velocity, angle, axis });
        }

        this.lastVectors = vectors;
        return vectors;
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
        const { scene_width: sceneW, scene_height: sceneH } = this._getSceneDimensions();
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

        const vectors = this.generateThrowVectors(normalizedVector, boost);

        if (this.onThrow) {
            this.onThrow(vectors, boost, dist);
        }
    }

    _cancelGesture() {
        this.mouseStart = null;
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
        this.container.addEventListener('touchcancel', this._onPointerCancelHandler, { passive: true });
        this.container.addEventListener('mouseleave', this._onPointerCancelHandler);
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
        this.container.removeEventListener('touchcancel', this._onPointerCancelHandler);
        this.container.removeEventListener('mouseleave', this._onPointerCancelHandler);
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
        this.rndGen = null;
        this.lastVectors = [];
    }
}
