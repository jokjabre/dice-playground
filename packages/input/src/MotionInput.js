/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */
/**
 * @typedef {Object} InputHostLike
 * @property {(request: Record<string, any>) => Promise<any>} roll
 * @property {(x: number, y: number, z: number) => void} setGravity
 * @property {(ids: string[], impulse: Vec3, worldPoint?: Vec3) => void} applyImpulse
 * @property {() => string[]} getDiceIds
 * @property {() => string[]} getSelection
 * @property {(ids: string[]) => void} setSelection
 * @property {(id: string) => void} toggleSelection
 * @property {(ndc: { x: number, y: number }) => any} pick
 * @property {() => Record<string, any>} getMetrics
 * @property {() => Record<string, any>} getSpawnProfile
 * @property {{ emit: (name: string, payload: any) => void }} events
 */

/**
 * @typedef {Object} MotionInputOptions
 * @property {any} [target]
 * @property {number} [smoothing]
 * @property {number} [shakeSmoothing]
 * @property {number} [gravityMagnitude]
 * @property {Vec3} [defaultGravity]
 * @property {number} [shakeThreshold]
 * @property {number} [shakeMultiplier]
 * @property {number} [shakeCooldown]
 * @property {number} [watchdogMs]
 * @property {() => number} [now]
 * @property {() => any} [requestPermission]
 */

/**
 * Clamp a filter coefficient into `[0, 1]`.
 *
 * @param {number} value
 * @returns {number}
 */
export function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/**
 * One low-pass step toward the target. Pure; used by tests to assert
 * convergence.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} alpha
 * @returns {number}
 */
export function lowPass(current, target, alpha) {
  return current + (target - current) * clamp01(alpha);
}

/**
 * One low-pass step for a 3D vector.
 *
 * @param {Vec3} current
 * @param {Vec3} target
 * @param {number} alpha
 * @returns {Vec3}
 */
export function lowPassVec3(current, target, alpha) {
  return {
    x: lowPass(current.x, target.x, alpha),
    y: lowPass(current.y, target.y, alpha),
    z: lowPass(current.z, target.z, alpha)
  };
}

/**
 * Map device orientation angles to a gravity vector.
 *
 * @param {number} betaDeg
 * @param {number} gammaDeg
 * @param {number} magnitude
 * @returns {Vec3}
 */
export function orientationToGravity(betaDeg, gammaDeg, magnitude) {
  const degToRad = Math.PI / 180;
  const radBeta = Math.max(-90, Math.min(90, betaDeg)) * degToRad;
  const radGamma = Math.max(-90, Math.min(90, gammaDeg)) * degToRad;
  return {
    x: Math.cos(radBeta) * Math.sin(radGamma) * magnitude,
    y: -Math.sin(radBeta) * magnitude,
    z: -Math.cos(radBeta) * Math.cos(radGamma) * magnitude
  };
}

/**
 * @param {{ x: number, y: number, z: number }} vector
 * @returns {number}
 */
function magnitude(vector) {
  return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
}

/**
 * Motion sensor input. Maps orientation to gravity and shake to impulses
 * through the host. It never writes to the DOM directly.
 */
export class MotionInput {
  /** @type {string} */
  id = 'motion-input';

  /** @type {any} */
  #target;

  /** @type {number} */
  #smoothing;

  /** @type {number} */
  #shakeSmoothing;

  /** @type {number} */
  #gravityMagnitude;

  /** @type {Vec3} */
  #defaultGravity;

  /** @type {number} */
  #shakeThreshold;

  /** @type {number} */
  #shakeMultiplier;

  /** @type {number} */
  #shakeCooldown;

  /** @type {number} */
  #watchdogMs;

  /** @type {() => number} */
  #now;

  /** @type {(() => any)|null} */
  #requestPermissionOverride;

  /** @type {InputHostLike|null} */
  #host = null;

  /** @type {boolean} */
  #enabled = false;

  /** @type {string} */
  #status = 'idle';

  /** @type {string} */
  #statusMessage = 'Motion sensors idle';

  /** @type {Vec3} */
  #smoothedGravity;

  /** @type {Vec3} */
  #smoothedAcceleration;

  /** @type {Vec3|null} */
  #accelerationBaseline = null;

  /** @type {Vec3|null} */
  #originalGravity = null;

  /** @type {number} */
  #lastShakeTime = 0;

  /** @type {boolean} */
  #receivedOrientation = false;

  /** @type {boolean} */
  #receivedMotion = false;

  /** @type {any} */
  #watchdogTimer = null;

  /** @type {(event: any) => void} */
  #onOrientation;

  /** @type {(event: any) => void} */
  #onMotion;

  /**
   * @param {MotionInputOptions} [options]
   */
  constructor(options = {}) {
    this.#target = options.target ?? null;
    this.#smoothing = clamp01(options.smoothing ?? 0.15);
    this.#shakeSmoothing = clamp01(options.shakeSmoothing ?? 0.35);
    this.#defaultGravity = options.defaultGravity
      ? { ...options.defaultGravity }
      : { x: 0, y: 0, z: -2940 };
    this.#gravityMagnitude =
      options.gravityMagnitude ?? magnitude(this.#defaultGravity);
    this.#shakeThreshold = options.shakeThreshold ?? 15;
    this.#shakeMultiplier = options.shakeMultiplier ?? 120;
    this.#shakeCooldown = options.shakeCooldown ?? 120;
    this.#watchdogMs = options.watchdogMs ?? 3000;
    this.#now = options.now ?? (() => Date.now());
    this.#requestPermissionOverride = options.requestPermission ?? null;

    this.#smoothedGravity = { ...this.#defaultGravity };
    this.#smoothedAcceleration = { x: 0, y: 0, z: 0 };

    this.#onOrientation = (event) => this.#handleOrientation(event);
    this.#onMotion = (event) => this.#handleMotion(event);
  }

  /**
   * @param {InputHostLike} host
   * @returns {void}
   */
  attach(host) {
    this.#host = host;
  }

  /**
   * @returns {void}
   */
  detach() {
    this.disable();
    this.#host = null;
  }

  /**
   * @returns {string}
   */
  get status() {
    return this.#status;
  }

  /**
   * @returns {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * @returns {Vec3}
   */
  get smoothedGravity() {
    return { ...this.#smoothedGravity };
  }

  /**
   * @param {string} status
   * @param {string} message
   * @returns {void}
   */
  #setStatus(status, message) {
    this.#status = status;
    this.#statusMessage = message;
    if (this.#host && this.#host.events) {
      this.#host.events.emit('motion:status', { status, message });
    }
  }

  /**
   * @returns {any}
   */
  #resolveTarget() {
    if (this.#target) return this.#target;
    const candidate = globalThis;
    if (candidate && typeof candidate.addEventListener === 'function') {
      if (typeof candidate.isSecureContext === 'boolean' || candidate.document) {
        return candidate;
      }
      // In Node there is no sensor target; stay targetless so enable()
      // reports unsupported instead of touching a bare global.
      if (typeof candidate.window !== 'undefined') return candidate.window;
    }
    return null;
  }

  /**
   * Request sensor permission. Resolves to `true` when no permission
   * constructor exists (desktop browsers).
   *
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    if (this.#requestPermissionOverride) {
      try {
        const result = await this.#requestPermissionOverride();
        return result === true || result === 'granted';
      } catch {
        return false;
      }
    }

    /** @type {any[]} */
    const sensorEvents = [];
    const orientationCtor = /** @type {any} */ (globalThis.DeviceOrientationEvent);
    const motionCtor = /** @type {any} */ (globalThis.DeviceMotionEvent);
    if (typeof orientationCtor !== 'undefined') sensorEvents.push(orientationCtor);
    if (typeof motionCtor !== 'undefined') sensorEvents.push(motionCtor);

    const requests = sensorEvents
      .filter(
        (sensor) => sensor && typeof sensor.requestPermission === 'function'
      )
      .map((sensor) => sensor.requestPermission());
    if (requests.length === 0) return true;

    try {
      const responses = /** @type {any[]} */ (await Promise.all(requests));
      return responses.every((response) => response === 'granted');
    } catch {
      return false;
    }
  }

  /**
   * Enable sensor listeners. Permission is explicit; a denied permission
   * produces a `motion:status` and attaches no listeners.
   *
   * @returns {Promise<boolean>}
   */
  async enable() {
    if (this.#enabled) return true;

    const target = this.#resolveTarget();
    if (!target || typeof target.addEventListener !== 'function') {
      this.#setStatus(
        'unsupported',
        'Motion sensors require a browser environment'
      );
      return false;
    }
    if (target.isSecureContext === false) {
      this.#setStatus(
        'insecure',
        'Sensors need HTTPS or localhost; HTTP LAN URLs are blocked by Chrome'
      );
      return false;
    }

    this.#setStatus('requesting', 'Requesting motion sensor permission...');
    const granted = await this.requestPermission();
    if (!granted) {
      this.#setStatus('denied', 'Motion sensor permission was denied');
      return false;
    }

    if (!this.#originalGravity) {
      this.#originalGravity = { ...this.#defaultGravity };
    }
    this.#smoothedGravity = { ...this.#originalGravity };
    this.#smoothedAcceleration = { x: 0, y: 0, z: 0 };
    this.#accelerationBaseline = null;
    this.#lastShakeTime = 0;
    this.#receivedOrientation = false;
    this.#receivedMotion = false;

    target.addEventListener('deviceorientation', this.#onOrientation);
    target.addEventListener('deviceorientationabsolute', this.#onOrientation);
    target.addEventListener('devicemotion', this.#onMotion);
    this.#enabled = true;
    this.#setStatus('enabled', 'Motion sensors listening for data...');
    this.#startWatchdog(target);
    return true;
  }

  /**
   * @returns {void}
   */
  disable() {
    if (!this.#enabled) return;
    const target = this.#resolveTarget();
    if (target && typeof target.removeEventListener === 'function') {
      target.removeEventListener('deviceorientation', this.#onOrientation);
      target.removeEventListener('deviceorientationabsolute', this.#onOrientation);
      target.removeEventListener('devicemotion', this.#onMotion);
    }
    this.#enabled = false;
    this.#clearWatchdog();

    const restore = this.#originalGravity ?? this.#defaultGravity;
    if (this.#host && typeof this.#host.setGravity === 'function') {
      this.#host.setGravity(restore.x, restore.y, restore.z);
    }
    this.#smoothedGravity = { ...restore };
    this.#smoothedAcceleration = { x: 0, y: 0, z: 0 };
    this.#accelerationBaseline = null;
    this.#lastShakeTime = 0;
    this.#originalGravity = null;
    this.#receivedOrientation = false;
    this.#receivedMotion = false;
    this.#setStatus('idle', 'Motion sensors disabled');
  }

  /**
   * @param {any} target
   * @returns {void}
   */
  #startWatchdog(target) {
    this.#clearWatchdog();
    void target;
    if (typeof globalThis.setTimeout !== 'function' || this.#watchdogMs <= 0) return;
    this.#watchdogTimer = globalThis.setTimeout(() => {
      this.#watchdogTimer = null;
      if (!this.#receivedOrientation && !this.#receivedMotion) {
        this.#setStatus(
          'unsupported',
          'No motion sensor data received. Try Chrome or Safari over HTTPS.'
        );
      }
    }, this.#watchdogMs);
  }

  /**
   * @returns {void}
   */
  #clearWatchdog() {
    if (this.#watchdogTimer !== null && typeof globalThis.clearTimeout === 'function') {
      globalThis.clearTimeout(this.#watchdogTimer);
    }
    this.#watchdogTimer = null;
  }

  /**
   * @param {any} value
   * @returns {boolean}
   */
  #hasNumericAxes(value) {
    return Boolean(
      value &&
      value.x !== null &&
      value.x !== undefined &&
      value.y !== null &&
      value.y !== undefined &&
      value.z !== null &&
      value.z !== undefined &&
      Number.isFinite(Number(value.x)) &&
      Number.isFinite(Number(value.y)) &&
      Number.isFinite(Number(value.z))
    );
  }

  /**
   * @param {any} event
   * @returns {{ x: number, y: number, z: number, includesGravity: boolean }|null}
   */
  #readAcceleration(event) {
    if (this.#hasNumericAxes(event.acceleration)) {
      return {
        x: Number(event.acceleration.x),
        y: Number(event.acceleration.y),
        z: Number(event.acceleration.z),
        includesGravity: false
      };
    }
    if (this.#hasNumericAxes(event.accelerationIncludingGravity)) {
      return {
        x: Number(event.accelerationIncludingGravity.x),
        y: Number(event.accelerationIncludingGravity.y),
        z: Number(event.accelerationIncludingGravity.z),
        includesGravity: true
      };
    }
    return null;
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handleOrientation(event) {
    if (!this.#enabled || !this.#host) return;
    if (
      event.beta === null ||
      event.gamma === null ||
      event.beta === undefined ||
      event.gamma === undefined
    ) {
      return;
    }
    if (!this.#receivedOrientation) {
      this.#receivedOrientation = true;
      this.#clearWatchdog();
      this.#setStatus('active', 'Tilt sensor receiving data');
    }
    const target = orientationToGravity(
      event.beta,
      event.gamma,
      this.#gravityMagnitude
    );
    this.#smoothedGravity = lowPassVec3(
      this.#smoothedGravity,
      target,
      this.#smoothing
    );
    this.#host.setGravity(
      this.#smoothedGravity.x,
      this.#smoothedGravity.y,
      this.#smoothedGravity.z
    );
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handleMotion(event) {
    if (!this.#enabled || !this.#host) return;
    const raw = this.#readAcceleration(event);
    if (!raw) return;
    if (!this.#receivedMotion) {
      this.#receivedMotion = true;
      this.#clearWatchdog();
      this.#setStatus('active', 'Shake sensor receiving data');
    }

    let ax = raw.x;
    let ay = raw.y;
    let az = raw.z;
    if (raw.includesGravity) {
      if (!this.#accelerationBaseline) {
        this.#accelerationBaseline = { x: ax, y: ay, z: az };
      } else {
        this.#accelerationBaseline = lowPassVec3(
          this.#accelerationBaseline,
          { x: ax, y: ay, z: az },
          0.05
        );
      }
      ax -= this.#accelerationBaseline.x;
      ay -= this.#accelerationBaseline.y;
      az -= this.#accelerationBaseline.z;
    }

    this.#smoothedAcceleration = lowPassVec3(
      this.#smoothedAcceleration,
      { x: ax, y: ay, z: az },
      this.#shakeSmoothing
    );
    const sx = this.#smoothedAcceleration.x;
    const sy = this.#smoothedAcceleration.y;
    const sz = this.#smoothedAcceleration.z;
    const filtered = magnitude(this.#smoothedAcceleration);
    const rawMag = Math.sqrt(ax * ax + ay * ay + az * az);
    const spike = Math.max(rawMag, filtered);
    const now = this.#now();
    if (spike <= this.#shakeThreshold || now - this.#lastShakeTime < this.#shakeCooldown) {
      return;
    }
    this.#lastShakeTime = now;

    const strength = Math.min(2, spike / this.#shakeThreshold);
    const impulse = {
      x: -sx * this.#shakeMultiplier * strength,
      y: sy * this.#shakeMultiplier * strength,
      z: Math.abs(sz) * this.#shakeMultiplier * strength
    };
    if (this.#host.getDiceIds && this.#host.applyImpulse) {
      const ids = this.#host.getDiceIds();
      if (ids.length > 0) {
        this.#host.applyImpulse(ids, impulse);
      }
    }
  }
}
