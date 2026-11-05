/**
 * MotionController
 * Listens to mobile device orientation (gyroscope) and motion (accelerometer).
 * - Filters and smooths sensor noise using low-pass exponential moving average.
 * - Dynamically maps device tilt angles to PhysicsWorld gravity vector.
 * - Detects acceleration shocks / shakes and applies kinetic impulses to active dice.
 * - Provides clean enable() and disable() lifecycle management.
 */

export class MotionController {
    /**
     * @param {Object} [config={}]
     * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} config.physicsWorld - The physics world instance.
     * @param {Function} [config.getDices] - Returns array of active dice entities or meshes with bodies.
     * @param {number} [config.smoothing=0.15] - Low-pass filter smoothing coefficient (0 = no update, 1 = instantaneous).
     * @param {number} [config.gravityMagnitude=980] - Default base gravity magnitude (cm/s^2).
     * @param {number} [config.shakeThreshold=15] - Acceleration magnitude threshold to trigger a shake impulse.
     * @param {number} [config.shakeMultiplier=120] - Impulse multiplier applied on shake.
     * @param {import('../core/EventBus.js').EventBus} [config.eventBus] - Optional event emitter for motion events.
     */
    constructor(config = {}) {
        this.physicsWorld = config.physicsWorld || null;
        this.getDices = config.getDices || (() => []);
        this.smoothing = config.smoothing ?? 0.15;
        this.gravityMagnitude = config.gravityMagnitude ?? 980;
        this.shakeThreshold = config.shakeThreshold ?? 15;
        this.shakeMultiplier = config.shakeMultiplier ?? 120;
        this.eventBus = config.eventBus || null;

        this.enabled = false;

        // Filtered sensor values
        this.smoothedGravity = { x: 0, y: 0, z: -this.gravityMagnitude };
        this.lastAcceleration = { x: 0, y: 0, z: 0 };

        this._onOrientation = (ev) => this._handleOrientation(ev);
        this._onMotion = (ev) => this._handleMotion(ev);
    }

    /**
     * Handles deviceorientation events (alpha, beta, gamma).
     * Maps tilt angles to gravity vector in Cannon.js coordinate frame.
     * @param {DeviceOrientationEvent} ev
     */
    _handleOrientation(ev) {
        if (!this.enabled || !this.physicsWorld) return;

        // Beta: front-to-back tilt [-180, 180]
        // Gamma: left-to-right tilt [-90, 90]
        const beta = ev.beta;
        const gamma = ev.gamma;

        if (beta === null || gamma === null || beta === undefined || gamma === undefined) {
            return;
        }

        // Convert degrees to radians
        const degToRad = Math.PI / 180;
        const radBeta = Math.max(-90, Math.min(90, beta)) * degToRad;
        const radGamma = Math.max(-90, Math.min(90, gamma)) * degToRad;

        // Calculate gravity components
        const targetGx = Math.sin(radGamma) * this.gravityMagnitude;
        const targetGy = -Math.sin(radBeta) * this.gravityMagnitude;
        const targetGz = -Math.cos(radBeta) * Math.cos(radGamma) * this.gravityMagnitude;

        // Low-pass filter
        this.smoothedGravity.x += (targetGx - this.smoothedGravity.x) * this.smoothing;
        this.smoothedGravity.y += (targetGy - this.smoothedGravity.y) * this.smoothing;
        this.smoothedGravity.z += (targetGz - this.smoothedGravity.z) * this.smoothing;

        this.physicsWorld.setGravity(
            this.smoothedGravity.x,
            this.smoothedGravity.y,
            this.smoothedGravity.z
        );

        if (this.eventBus) {
            this.eventBus.emit('motion:tilt', {
                gravity: this.smoothedGravity,
                beta,
                gamma
            });
        }
    }

    /**
     * Handles devicemotion events (acceleration spikes / shake).
     * @param {DeviceMotionEvent} ev
     */
    _handleMotion(ev) {
        if (!this.enabled) return;

        const acc = ev.acceleration;
        if (!acc || acc.x === null || acc.y === null || acc.z === null) {
            return;
        }

        const ax = acc.x || 0;
        const ay = acc.y || 0;
        const az = acc.z || 0;

        const totalAcc = Math.sqrt(ax * ax + ay * ay + az * az);

        if (totalAcc > this.shakeThreshold) {
            const dices = this.getDices();
            if (dices && dices.length > 0) {
                const impulseX = -ax * this.shakeMultiplier;
                const impulseY = ay * this.shakeMultiplier;
                const impulseZ = Math.abs(az) * this.shakeMultiplier;

                for (const die of dices) {
                    const body = die.body || die;
                    if (body && body.velocity) {
                        body.velocity.x += impulseX;
                        body.velocity.y += impulseY;
                        body.velocity.z += impulseZ;
                        if (die.dice_stopped !== undefined) {
                            die.dice_stopped = 0;
                        }
                    }
                }
            }

            if (this.eventBus) {
                this.eventBus.emit('motion:shake', {
                    acceleration: { x: ax, y: ay, z: az },
                    magnitude: totalAcc
                });
            }
        }
    }

    /**
     * Request permission (required for iOS 13+ devices).
     * @returns {Promise<boolean>}
     */
    async requestPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                return response === 'granted';
            } catch (err) {
                console.warn('DeviceOrientation permission request failed:', err);
                return false;
            }
        }
        return true;
    }

    /**
     * Enables sensor listeners.
     */
    async enable() {
        if (this.enabled) return;
        if (typeof window === 'undefined') return;

        const granted = await this.requestPermission();
        if (!granted) return;

        window.addEventListener('deviceorientation', this._onOrientation);
        window.addEventListener('devicemotion', this._onMotion);
        this.enabled = true;

        if (this.eventBus) {
            this.eventBus.emit('motion:enabled');
        }
    }

    /**
     * Disables sensor listeners and resets world gravity to default vertical downward.
     */
    disable() {
        if (!this.enabled) return;
        if (typeof window !== 'undefined') {
            window.removeEventListener('deviceorientation', this._onOrientation);
            window.removeEventListener('devicemotion', this._onMotion);
        }
        this.enabled = false;

        // Reset gravity to standard downward
        if (this.physicsWorld) {
            this.physicsWorld.setGravity(0, 0, -this.gravityMagnitude);
        }
        this.smoothedGravity = { x: 0, y: 0, z: -this.gravityMagnitude };

        if (this.eventBus) {
            this.eventBus.emit('motion:disabled');
        }
    }

    /**
     * Cleanup resources.
     */
    destroy() {
        this.disable();
        this.physicsWorld = null;
        this.getDices = () => [];
        this.eventBus = null;
    }
}

