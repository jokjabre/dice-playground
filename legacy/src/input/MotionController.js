/**
 * MotionController
 * Listens to mobile device orientation (gyroscope) and motion (accelerometer).
 * - Filters and smooths sensor noise using low-pass exponential moving averages.
 * - Dynamically maps device tilt angles to the PhysicsWorld gravity vector.
 * - Detects acceleration shocks / shakes and applies kinetic impulses to active dice.
 * - Provides clean enable() and disable() lifecycle management.
 */

export class MotionController {
    /**
     * @param {Object} [config={}]
     * @param {import('../physics/PhysicsWorld.js').PhysicsWorld} config.physicsWorld - The physics world instance.
     * @param {Function} [config.getDices] - Returns array of active dice entities or meshes with bodies.
     * @param {number} [config.smoothing=0.15] - Low-pass filter coefficient for orientation (0 = no update, 1 = instantaneous).
     * @param {number} [config.shakeSmoothing=0.35] - Low-pass filter coefficient for acceleration.
     * @param {number} [config.gravityMagnitude] - Base gravity magnitude. Inferred from the physics world when omitted.
     * @param {Object} [config.defaultGravity] - Gravity vector restored when sensors are disabled.
     * @param {number} [config.shakeThreshold=15] - Acceleration magnitude threshold to trigger a shake impulse.
     * @param {number} [config.shakeMultiplier=120] - Impulse multiplier applied on shake.
     * @param {number} [config.shakeCooldown=120] - Minimum milliseconds between shake impulses.
     * @param {import('../core/EventBus.js').EventBus} [config.eventBus] - Optional event emitter for motion events.
     */
    constructor(config = {}) {
        // Accept either a PhysicsWorld wrapper or the legacy world adapter.
        const candidate = config.physicsWorld || null;
        this.physicsWorld = (candidate && typeof candidate.setGravity === 'function')
            ? candidate
            : ((candidate && candidate.physicsWorld) || candidate);

        this.getDices = config.getDices || (() => []);
        this.smoothing = this._clamp01(config.smoothing !== undefined ? config.smoothing : 0.15);
        this.shakeSmoothing = this._clamp01(config.shakeSmoothing !== undefined ? config.shakeSmoothing : 0.35);
        this.gravityMagnitude = config.gravityMagnitude !== undefined ? config.gravityMagnitude : 980;
        this._gravityMagnitudeConfigured = config.gravityMagnitude !== undefined;
        this._configuredDefaultGravity = config.defaultGravity ? { ...config.defaultGravity } : null;
        this.defaultGravity = { x: 0, y: 0, z: -this.gravityMagnitude };
        this.originalGravity = null;
        this.shakeThreshold = config.shakeThreshold !== undefined ? config.shakeThreshold : 15;
        this.shakeMultiplier = config.shakeMultiplier !== undefined ? config.shakeMultiplier : 120;
        this.shakeCooldown = config.shakeCooldown !== undefined ? config.shakeCooldown : 120;
        this.eventBus = config.eventBus || null;

        this.enabled = false;
        this.status = 'idle';
        this.statusMessage = 'Motion sensors idle';
        this._receivedOrientation = false;
        this._receivedMotion = false;
        this._statusTimeout = null;
        this._onOrientation = (ev) => this._handleOrientation(ev);
        this._onOrientationAbsolute = (ev) => this._handleOrientation(ev);
        this._onMotion = (ev) => this._handleMotion(ev);

        // Filtered sensor values
        this._syncGravityBaseline();
        this.smoothedGravity = { ...this.defaultGravity };
        this.smoothedAcceleration = { x: 0, y: 0, z: 0 };
        this.accelerationBaseline = null;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.lastShakeTime = 0;
    }

    /**
     * @param {number} value
     * @returns {number}
     * @private
     */
    _clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    /**
     * Updates and broadcasts the sensor lifecycle status.
     * @param {string} status
     * @param {string} message
     * @private
     */
    _setStatus(status, message) {
        this.status = status;
        this.statusMessage = message;
        if (this.eventBus) {
            this.eventBus.emit('motion:status', { status, message });
        }
    }

    /**
     * Starts a watchdog that reports when no sensor events arrive at all.
     * Some browsers expose the constructors but silently suppress events.
     * @private
     */
    _startSensorWatchdog() {
        this._clearSensorWatchdog();
        if (typeof setTimeout !== 'function') return;
        this._statusTimeout = setTimeout(() => {
            this._statusTimeout = null;
            if (!this._receivedOrientation && !this._receivedMotion) {
                this._setStatus('unsupported', 'No motion sensor data received. Try Chrome or Safari over HTTPS.');
            }
        }, 3000);
    }

    /**
     * @private
     */
    _clearSensorWatchdog() {
        if (this._statusTimeout !== null && typeof clearTimeout === 'function') {
            clearTimeout(this._statusTimeout);
        }
        this._statusTimeout = null;
    }

    /**
     * Marks a sensor stream as live on its first event.
     * @param {'orientation'|'motion'} kind
     * @private
     */
    _markSensorActive(kind) {
        this._clearSensorWatchdog();
        if (this.status === 'active') return;
        this._setStatus('active', kind === 'orientation'
            ? 'Tilt sensor receiving data'
            : 'Shake sensor receiving data');
    }

    /**
     * Reads the current gravity vector from either PhysicsWorld or a raw CANNON world.
     * @returns {{x: number, y: number, z: number}|null}
     * @private
     */
    _readGravity() {
        if (!this.physicsWorld) return null;

        let gravity = null;
        if (typeof this.physicsWorld.getGravity === 'function') {
            gravity = this.physicsWorld.getGravity();
        } else if (this.physicsWorld.instance && this.physicsWorld.instance.gravity) {
            gravity = this.physicsWorld.instance.gravity;
        } else if (this.physicsWorld.gravity) {
            gravity = this.physicsWorld.gravity;
        }

        if (!gravity) return null;
        const x = Number(gravity.x);
        const y = Number(gravity.y);
        const z = Number(gravity.z);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
            return null;
        }
        return { x, y, z };
    }

    /**
     * Writes gravity through either PhysicsWorld or a raw CANNON world.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @private
     */
    _writeGravity(x, y, z) {
        if (!this.physicsWorld) return;

        if (typeof this.physicsWorld.setGravity === 'function') {
            this.physicsWorld.setGravity(x, y, z);
            return;
        }

        const gravity = (this.physicsWorld.instance && this.physicsWorld.instance.gravity) ||
            this.physicsWorld.gravity;
        if (gravity && typeof gravity.set === 'function') {
            gravity.set(x, y, z);
        }
    }

    /**
     * Infers the baseline gravity magnitude from the active physics world so tilt
     * matches the engine's actual gravity scale (the legacy demo uses ~2940 cm/s²).
     * @private
     */
    _syncGravityBaseline() {
        const current = this._readGravity();
        this.defaultGravity = this._configuredDefaultGravity ||
            (current ? { ...current } : { x: 0, y: 0, z: -this.gravityMagnitude });

        if (!this._gravityMagnitudeConfigured) {
            const magnitude = Math.sqrt(
                this.defaultGravity.x * this.defaultGravity.x +
                this.defaultGravity.y * this.defaultGravity.y +
                this.defaultGravity.z * this.defaultGravity.z
            );
            if (magnitude > 0) {
                this.gravityMagnitude = magnitude;
            }
        }
    }

    /**
     * @param {Object} value
     * @returns {boolean}
     * @private
     */
    _hasNumericAxes(value) {
        return !!value &&
            value.x !== null && value.x !== undefined &&
            value.y !== null && value.y !== undefined &&
            value.z !== null && value.z !== undefined &&
            Number.isFinite(Number(value.x)) &&
            Number.isFinite(Number(value.y)) &&
            Number.isFinite(Number(value.z));
    }

    /**
     * Picks the best available acceleration source.
     * Some devices only populate accelerationIncludingGravity.
     * @param {DeviceMotionEvent} ev
     * @returns {{x: number, y: number, z: number, includesGravity: boolean}|null}
     * @private
     */
    _readAcceleration(ev) {
        if (this._hasNumericAxes(ev.acceleration)) {
            return {
                x: Number(ev.acceleration.x),
                y: Number(ev.acceleration.y),
                z: Number(ev.acceleration.z),
                includesGravity: false
            };
        }
        if (this._hasNumericAxes(ev.accelerationIncludingGravity)) {
            return {
                x: Number(ev.accelerationIncludingGravity.x),
                y: Number(ev.accelerationIncludingGravity.y),
                z: Number(ev.accelerationIncludingGravity.z),
                includesGravity: true
            };
        }
        return null;
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

        if (!this._receivedOrientation) {
            this._receivedOrientation = true;
            this._markSensorActive('orientation');
        }

        // Convert degrees to radians
        const degToRad = Math.PI / 180;
        const radBeta = Math.max(-90, Math.min(90, beta)) * degToRad;
        const radGamma = Math.max(-90, Math.min(90, gamma)) * degToRad;

        // Calculate gravity components. The cos(beta) factor keeps the vector
        // magnitude constant for combined front/back and left/right tilts.
        const targetGx = Math.cos(radBeta) * Math.sin(radGamma) * this.gravityMagnitude;
        const targetGy = -Math.sin(radBeta) * this.gravityMagnitude;
        const targetGz = -Math.cos(radBeta) * Math.cos(radGamma) * this.gravityMagnitude;

        // Low-pass filter
        this.smoothedGravity.x += (targetGx - this.smoothedGravity.x) * this.smoothing;
        this.smoothedGravity.y += (targetGy - this.smoothedGravity.y) * this.smoothing;
        this.smoothedGravity.z += (targetGz - this.smoothedGravity.z) * this.smoothing;

        this._writeGravity(
            this.smoothedGravity.x,
            this.smoothedGravity.y,
            this.smoothedGravity.z
        );

        if (this.eventBus) {
            this.eventBus.emit('motion:tilt', {
                gravity: { ...this.smoothedGravity },
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

        const raw = this._readAcceleration(ev);
        if (!raw) return;

        if (!this._receivedMotion) {
            this._receivedMotion = true;
            this._markSensorActive('motion');
        }

        let ax = raw.x;
        let ay = raw.y;
        let az = raw.z;

        // accelerationIncludingGravity has a ~1g resting bias. Remove its slow-moving
        // baseline so shake detection works on devices without linear acceleration.
        if (raw.includesGravity) {
            if (!this.accelerationBaseline) {
                this.accelerationBaseline = { x: ax, y: ay, z: az };
            } else {
                const baselineSmoothing = 0.05;
                this.accelerationBaseline.x += (ax - this.accelerationBaseline.x) * baselineSmoothing;
                this.accelerationBaseline.y += (ay - this.accelerationBaseline.y) * baselineSmoothing;
                this.accelerationBaseline.z += (az - this.accelerationBaseline.z) * baselineSmoothing;
            }
            ax -= this.accelerationBaseline.x;
            ay -= this.accelerationBaseline.y;
            az -= this.accelerationBaseline.z;
        }

        // Low-pass filter the linear acceleration to avoid reacting to isolated noise samples.
        const alpha = this.shakeSmoothing;
        this.smoothedAcceleration.x += (ax - this.smoothedAcceleration.x) * alpha;
        this.smoothedAcceleration.y += (ay - this.smoothedAcceleration.y) * alpha;
        this.smoothedAcceleration.z += (az - this.smoothedAcceleration.z) * alpha;

        this.lastAcceleration.x = ax;
        this.lastAcceleration.y = ay;
        this.lastAcceleration.z = az;

        const sx = this.smoothedAcceleration.x;
        const sy = this.smoothedAcceleration.y;
        const sz = this.smoothedAcceleration.z;
        const totalAcc = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const rawAcc = Math.sqrt(ax * ax + ay * ay + az * az);

        const now = Date.now();
        // Trigger on the raw spike as well as the filtered value so a short, sharp
        // shake is not hidden by the low-pass filter on its first sample.
        const spike = Math.max(rawAcc, totalAcc);
        if (spike <= this.shakeThreshold || now - this.lastShakeTime < this.shakeCooldown) {
            return;
        }
        this.lastShakeTime = now;

        // Scale the impulse with the spike strength, clamped to avoid runaway velocities.
        const strength = Math.min(2, spike / this.shakeThreshold);
        const impulseX = -sx * this.shakeMultiplier * strength;
        const impulseY = sy * this.shakeMultiplier * strength;
        const impulseZ = Math.abs(sz) * this.shakeMultiplier * strength;

        const dices = this.getDices();
        if (dices && dices.length > 0) {
            for (const die of dices) {
                const body = die.body || die;
                if (!body || !body.velocity) continue;

                if (typeof body.wakeUp === 'function') {
                    body.wakeUp();
                }

                body.velocity.x += impulseX;
                body.velocity.y += impulseY;
                body.velocity.z += impulseZ;

                if (die && die.dice_stopped !== undefined) {
                    die.dice_stopped = 0;
                } else if (body.dice_stopped !== undefined) {
                    body.dice_stopped = 0;
                }
            }
        }

        if (this.eventBus) {
            this.eventBus.emit('motion:shake', {
                acceleration: { x: sx, y: sy, z: sz },
                magnitude: spike
            });
        }
    }

    /**
     * Request permission (required for iOS 13+ devices).
     * Requests both orientation and motion access when the platform supports it.
     * @returns {Promise<boolean>}
     */
    async requestPermission() {
        const sensorEvents = [];
        if (typeof DeviceOrientationEvent !== 'undefined') {
            sensorEvents.push(DeviceOrientationEvent);
        }
        if (typeof DeviceMotionEvent !== 'undefined') {
            sensorEvents.push(DeviceMotionEvent);
        }

        // Start every permission request synchronously so iOS still sees the
        // originating user gesture (important for the motion sensor prompt).
        const requests = sensorEvents
            .filter(SensorEvent => typeof SensorEvent.requestPermission === 'function')
            .map(SensorEvent => SensorEvent.requestPermission());

        if (requests.length === 0) return true;

        try {
            const responses = await Promise.all(requests);
            return responses.every(response => response === 'granted');
        } catch (err) {
            console.warn('Motion sensor permission request failed:', err);
            return false;
        }
    }

    /**
     * Enables sensor listeners.
     * @returns {Promise<boolean>} True if the listeners were attached.
     */
    async enable() {
        if (this.enabled) {
            this._setStatus(this.status === 'idle' ? 'enabled' : this.status, this.statusMessage);
            return true;
        }
        if (typeof window === 'undefined') {
            this._setStatus('unsupported', 'Motion sensors require a browser environment');
            return false;
        }

        // Do not hard-fail when constructors are missing: some embedded browsers
        // still dispatch the events without exposing the constructor objects.
        // The watchdog below reports if no data ever arrives.
        // Device orientation/motion are restricted to secure contexts in modern browsers.
        if (window.isSecureContext === false) {
            this._setStatus('insecure', 'Sensors need HTTPS or localhost; HTTP LAN URLs are blocked by Chrome');
            return false;
        }

        this._setStatus('requesting', 'Requesting motion sensor permission...');
        const granted = await this.requestPermission();
        if (!granted) {
            this._setStatus('denied', 'Motion sensor permission was denied');
            return false;
        }

        // Preserve the gravity that was active before sensors took control.
        this._syncGravityBaseline();
        this.originalGravity = this._readGravity() || { ...this.defaultGravity };
        this.smoothedGravity = { ...this.originalGravity };
        this.smoothedAcceleration = { x: 0, y: 0, z: 0 };
        this.accelerationBaseline = null;
        this.lastShakeTime = 0;
        this._receivedOrientation = false;
        this._receivedMotion = false;

        window.addEventListener('deviceorientation', this._onOrientation);
        window.addEventListener('deviceorientationabsolute', this._onOrientationAbsolute);
        window.addEventListener('devicemotion', this._onMotion);
        this.enabled = true;
        this._setStatus('enabled', 'Motion sensors listening for data...');
        this._startSensorWatchdog();

        if (this.eventBus) {
            this.eventBus.emit('motion:enabled');
        }
        return true;
    }

    /**
     * Disables sensor listeners and restores the engine's original gravity vector.
     */
    disable() {
        if (!this.enabled) return;
        if (typeof window !== 'undefined') {
            window.removeEventListener('deviceorientation', this._onOrientation);
            window.removeEventListener('deviceorientationabsolute', this._onOrientationAbsolute);
            window.removeEventListener('devicemotion', this._onMotion);
        }
        this.enabled = false;
        this._clearSensorWatchdog();

        const restore = this.originalGravity || this.defaultGravity;
        this._writeGravity(restore.x, restore.y, restore.z);
        this.smoothedGravity = { ...restore };
        this.smoothedAcceleration = { x: 0, y: 0, z: 0 };
        this.accelerationBaseline = null;
        this.lastAcceleration = { x: 0, y: 0, z: 0 };
        this.lastShakeTime = 0;
        this.originalGravity = null;
        this._receivedOrientation = false;
        this._receivedMotion = false;
        this._setStatus('idle', 'Motion sensors disabled');

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
