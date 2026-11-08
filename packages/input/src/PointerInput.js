import { createBrowserRandom } from '@dice/core';

import {
  buildThrowVectors,
  evaluateGesture,
  getPointerCoords,
  gestureDistance
} from './gesture.js';

/**
 * @typedef {Object} InputHostLike
 * @property {(request: Record<string, any>) => Promise<any>} roll
 * @property {(x: number, y: number, z: number) => void} setGravity
 * @property {(ids: string[], impulse: { x: number, y: number, z: number }, worldPoint?: { x: number, y: number, z: number }) => void} applyImpulse
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
 * @typedef {Object} PointerInputOptions
 * @property {any} [container]
 * @property {number} [dieCount]
 * @property {number} [dieInertia]
 * @property {any} [rng]
 * @property {() => number} [now]
 */

/**
 * Pointer (mouse/touch) flick input. Converts drag gestures into throw vectors
 * and delegates the roll to the host. It never mutates dice bodies directly.
 *
 * A gesture starts with a press inside the container and completes on the
 * next pointer-up, even when the finger or cursor has left the container:
 * completion is observed on the container's window, following the legacy
 * body-level listeners. Leaving the container therefore never cancels a
 * swipe; only `touchcancel` does.
 */
export class PointerInput {
  /** @type {string} */
  id = 'pointer-input';

  /** @type {any} */
  #container;

  /** @type {number|null} */
  #dieCount;

  /** @type {number} */
  #dieInertia;

  /** @type {any|null} */
  #rng;

  /** @type {() => number} */
  #now;

  /** @type {InputHostLike|null} */
  #host = null;

  /** @type {{ x: number, y: number }|null} */
  #start = null;

  /** @type {number} */
  #startTime = 0;

  /** @type {boolean} */
  #enabled = false;

  /** @type {(event: any) => void} */
  #onPointerDown;

  /** @type {(event: any) => void} */
  #onPointerUp;

  /** @type {() => void} */
  #onPointerCancel;

  /**
   * Window that owns the container. Pointer-up is also observed there so a
   * flick that leaves the container still completes, like the legacy
   * body-level listeners. Null when no window is available (Node tests).
   *
   * @type {any|null}
   */
  #upTarget = null;

  /**
   * @param {PointerInputOptions} [options]
   */
  constructor(options = {}) {
    this.#container = options.container ?? null;
    this.#dieCount = options.dieCount ?? null;
    this.#dieInertia = options.dieInertia ?? 13;
    this.#rng = options.rng ?? null;
    this.#now = options.now ?? (() => Date.now());

    this.#onPointerDown = (event) => this.#handlePointerDown(event);
    this.#onPointerUp = (event) => this.#handlePointerUp(event);
    this.#onPointerCancel = () => this.#cancelGesture();
  }

  /**
   * @param {InputHostLike} host
   * @returns {void}
   */
  attach(host) {
    this.#host = host;
    this.enable();
  }

  /**
   * @returns {void}
   */
  detach() {
    this.disable();
    this.#host = null;
    this.#start = null;
  }

  /**
   * @returns {void}
   */
  enable() {
    if (this.#enabled || !this.#container) return;
    this.#container.addEventListener('mousedown', this.#onPointerDown);
    this.#container.addEventListener('touchstart', this.#onPointerDown, { passive: true });
    this.#container.addEventListener('mouseup', this.#onPointerUp);
    this.#container.addEventListener('touchend', this.#onPointerUp, { passive: true });
    this.#container.addEventListener('touchcancel', this.#onPointerCancel, { passive: true });
    // Pointer-up is additionally observed on the container's window. A
    // flick that leaves the container before release (over a control panel,
    // the header, or outside the stage) must still count; the legacy demo
    // listened on the body, so any release completed the gesture.
    // In-stage releases bubble to the window too, which is harmless: the
    // first handler clears `#start`, so the second one returns early.
    const upTarget = this.#resolveUpTarget();
    if (upTarget && upTarget !== this.#container) {
      upTarget.addEventListener('mouseup', this.#onPointerUp);
      upTarget.addEventListener('touchend', this.#onPointerUp, { passive: true });
    }
    this.#upTarget = upTarget;
    this.#enabled = true;
  }

  /**
   * @returns {void}
   */
  disable() {
    if (!this.#enabled || !this.#container) return;
    this.#container.removeEventListener('mousedown', this.#onPointerDown);
    this.#container.removeEventListener('touchstart', this.#onPointerDown);
    this.#container.removeEventListener('mouseup', this.#onPointerUp);
    this.#container.removeEventListener('touchend', this.#onPointerUp);
    this.#container.removeEventListener('touchcancel', this.#onPointerCancel);
    if (this.#upTarget && this.#upTarget !== this.#container) {
      this.#upTarget.removeEventListener('mouseup', this.#onPointerUp);
      this.#upTarget.removeEventListener('touchend', this.#onPointerUp);
    }
    this.#upTarget = null;
    this.#start = null;
    this.#enabled = false;
  }

  /**
   * Resolve the window that owns the container for pointer-up observation.
   * Returns null when the container does not expose a window (tests).
   *
   * @returns {any|null}
   */
  #resolveUpTarget() {
    const view = this.#container?.ownerDocument?.defaultView;
    if (view && typeof view.addEventListener === 'function') return view;
    return null;
  }

  /**
   * @returns {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * Resolve the active random source lazily so importing this module in Node
   * does not require browser randomness.
   *
   * @returns {any}
   */
  #resolveRng() {
    if (this.#rng) return this.#rng;
    this.#rng = createBrowserRandom();
    return this.#rng;
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerDown(event) {
    if (!this.#enabled || !this.#host) return;
    this.#startTime = this.#now();
    this.#start = getPointerCoords(event);
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerUp(event) {
    if (!this.#enabled || !this.#host || !this.#start) return;

    const start = this.#start;
    const end = getPointerCoords(event);
    const durationMs = this.#now() - this.#startTime;
    this.#start = null;

    const metrics = this.#host.getMetrics ? this.#host.getMetrics() : null;
    const gesture = evaluateGesture({ start, end, durationMs, metrics });
    if (!gesture.isSwipe) return;

    const spawnProfile = this.#host.getSpawnProfile
      ? this.#host.getSpawnProfile()
      : null;
    const diceIds = this.#host.getDiceIds ? this.#host.getDiceIds() : [];
    const count =
      this.#dieCount ?? (diceIds.length > 0 ? diceIds.length : 6);
    if (count <= 0) return;

    const vectors = buildThrowVectors({
      direction: gesture.normalized,
      boost: gesture.boost,
      count,
      rng: this.#resolveRng(),
      metrics,
      spawnProfile,
      dieInertia: this.#dieInertia
    });
    if (vectors.length === 0) return;

    const result = this.#host.roll({ vectors, dice: vectors.length });
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  }

  /**
   * @returns {void}
   */
  #cancelGesture() {
    this.#start = null;
  }
}

/**
 * Distance of a pointer delta. Exported for tests and demos.
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function distanceBetween(a, b) {
  return gestureDistance({ x: b.x - a.x, y: b.y - a.y });
}
