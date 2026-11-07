import { clientToNdc, getPointerCoords, gestureDistance } from './gesture.js';

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
 * @typedef {{ dieId: string, distance?: number, point?: { x: number, y: number, z: number } }} PickResultLike
 */

/**
 * Tap/click picking input. Converts pointer coordinates to NDC, delegates to
 * the host picking service (which wraps the rendering service), toggles
 * selection for the picked die, and emits `die:pick`.
 */
export class RaycastPicker {
  /** @type {string} */
  id = 'raycast-picker';

  /** @type {any} */
  #container;

  /** @type {{ pick: (ndc: { x: number, y: number }, candidates?: string[]) => any }|null} */
  #pickingService;

  /** @type {{ left: number, top: number, width: number, height: number }|null} */
  #rectOverride;

  /** @type {number} */
  #tapThreshold;

  /** @type {InputHostLike|null} */
  #host = null;

  /** @type {{ x: number, y: number }|null} */
  #start = null;

  /** @type {boolean} */
  #enabled = false;

  /** @type {(event: any) => void} */
  #onPointerDown;

  /** @type {(event: any) => void} */
  #onPointerUp;

  /**
   * @param {{ container?: any, pickingService?: any, rect?: any, tapThreshold?: number }} [options]
   */
  constructor(options = {}) {
    this.#container = options.container ?? null;
    this.#pickingService = options.pickingService ?? null;
    this.#rectOverride = options.rect ?? null;
    this.#tapThreshold = options.tapThreshold ?? 5;

    this.#onPointerDown = (event) => this.#handlePointerDown(event);
    this.#onPointerUp = (event) => this.#handlePointerUp(event);
  }

  /**
   * @param {InputHostLike} host
   * @returns {void}
   */
  attach(host) {
    this.#host = host;
    if (!this.#enabled && this.#container) {
      this.#container.addEventListener('mousedown', this.#onPointerDown);
      this.#container.addEventListener('touchstart', this.#onPointerDown, { passive: true });
      this.#container.addEventListener('mouseup', this.#onPointerUp);
      this.#container.addEventListener('touchend', this.#onPointerUp, { passive: true });
      this.#enabled = true;
    }
  }

  /**
   * @returns {void}
   */
  detach() {
    if (this.#enabled && this.#container) {
      this.#container.removeEventListener('mousedown', this.#onPointerDown);
      this.#container.removeEventListener('touchstart', this.#onPointerDown);
      this.#container.removeEventListener('mouseup', this.#onPointerUp);
      this.#container.removeEventListener('touchend', this.#onPointerUp);
      this.#enabled = false;
    }
    this.#host = null;
    this.#start = null;
  }

  /**
   * Resolve the viewport rect for NDC conversion without importing DOM
   * globals at module scope.
   *
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  #getRect() {
    if (this.#rectOverride) return this.#rectOverride;
    if (
      this.#container &&
      typeof this.#container.getBoundingClientRect === 'function'
    ) {
      return this.#container.getBoundingClientRect();
    }
    return null;
  }

  /**
   * Pick at client coordinates. Returns the normalized pick result or `null`.
   *
   * @param {number} clientX
   * @param {number} clientY
   * @returns {PickResultLike|null}
   */
  pickClientPoint(clientX, clientY) {
    if (!this.#host) return null;
    const rect = this.#getRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;

    const ndc = clientToNdc(clientX, clientY, rect);
    let result;
    if (this.#pickingService && typeof this.#pickingService.pick === 'function') {
      const candidates = this.#host.getDiceIds ? this.#host.getDiceIds() : [];
      result = this.#pickingService.pick(ndc, candidates);
    } else if (this.#host.pick) {
      result = this.#host.pick(ndc);
    } else {
      return null;
    }

    const normalized = normalizePickResult(result);
    if (!normalized) return null;

    if (typeof this.#host.toggleSelection === 'function') {
      this.#host.toggleSelection(normalized.dieId);
    }
    if (this.#host.events) {
      this.#host.events.emit('die:pick', {
        dieId: normalized.dieId,
        point: normalized.point ?? { x: 0, y: 0, z: 0 }
      });
    }
    return normalized;
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerDown(event) {
    if (!this.#enabled || !this.#host) return;
    this.#start = getPointerCoords(event);
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerUp(event) {
    if (!this.#enabled || !this.#host || !this.#start) return;
    const start = this.#start;
    this.#start = null;
    const end = getPointerCoords(event);
    if (gestureDistance({ x: end.x - start.x, y: end.y - start.y }) > this.#tapThreshold) {
      return;
    }
    this.pickClientPoint(end.x, end.y);
  }
}

/**
 * @param {any} result
 * @returns {PickResultLike|null}
 */
function normalizePickResult(result) {
  if (!result) return null;
  if (typeof result === 'string') {
    return result.length > 0 ? { dieId: result } : null;
  }
  if (typeof result === 'object' && typeof result.dieId === 'string' && result.dieId.length > 0) {
    return result;
  }
  return null;
}
