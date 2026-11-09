/**
 * @typedef {Object} Pointer2D
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} ThrowVisualizerOptions
 * @property {any} [container] Host element the SVG overlay is mounted on.
 * @property {number} [maxLength] Maximum arrow length in pixels before the
 *   tip clamps along the drag ray. Defaults to
 *   {@link THROW_VISUALIZER_MAX_LENGTH}.
 * @property {number} [threshold] Drags shorter than this stay hidden so
 *   taps remain taps. Defaults to {@link THROW_VISUALIZER_THRESHOLD}.
 * @property {number} [releaseDurationMs] Release fade/scale snap duration
 *   in milliseconds. Defaults to {@link THROW_VISUALIZER_RELEASE_MS}.
 * @property {string} [testId] `data-testid` for the SVG element.
 */

/** Maximum arrow length in pixels before the tip clamps along the drag ray. */
export const THROW_VISUALIZER_MAX_LENGTH = 190;

/**
 * Drags shorter than this (about 18 px) stay hidden, preserving tap/click
 * picking for the raycast picker.
 */
export const THROW_VISUALIZER_THRESHOLD = 18;

/** Release fade + scale snap duration in milliseconds. */
export const THROW_VISUALIZER_RELEASE_MS = 200;

/** Arrowhead length in pixels at zero power. */
const ARROW_HEAD_BASE = 10;

/** Arrowhead half-width in pixels at zero power. */
const ARROW_HEAD_HALF_BASE = 6;

/** Arrowhead growth across the power range, in pixels. */
const ARROW_HEAD_GROWTH = 6;

/**
 * Gradient stops for the power-driven colour interpolation. Soft teal at
 * rest, gold in the middle of the range, and fiery orange-red at maximum
 * power.
 *
 * @type {Record<string, { r: number, g: number, b: number }>}
 */
const THROW_COLOR_STOPS = {
  soft: { r: 45, g: 212, b: 191 },
  medium: { r: 251, g: 191, b: 36 },
  max: { r: 255, g: 69, b: 0 }
};

/**
 * @param {{ r: number, g: number, b: number }} color
 * @returns {string}
 */
function rgbString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/** Soft teal colour at zero power. */
export const THROW_VISUALIZER_SOFT_COLOR = rgbString(THROW_COLOR_STOPS.soft);

/** Gold colour at half power. */
export const THROW_VISUALIZER_MEDIUM_COLOR = rgbString(THROW_COLOR_STOPS.medium);

/** Fiery orange-red colour at maximum power. */
export const THROW_VISUALIZER_MAX_COLOR = rgbString(THROW_COLOR_STOPS.max);

/**
 * @param {any} value
 * @returns {number|null}
 */
function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Coerce any value into a `{ x, y }` point, defaulting non-finite
 * components to zero.
 *
 * @param {any} value
 * @returns {Pointer2D}
 */
function toPoint(value) {
  return {
    x: finiteNumber(value?.x) ?? 0,
    y: finiteNumber(value?.y) ?? 0
  };
}

/**
 * Resolve a positive option value, falling back when it is not a finite
 * positive number.
 *
 * @param {any} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveOr(value, fallback) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : fallback;
}

/**
 * Clamp a drag length to the maximum arrow length.
 *
 * @param {number} length
 * @param {number} [maxLength]
 * @returns {number}
 */
export function clampThrowLength(length, maxLength = THROW_VISUALIZER_MAX_LENGTH) {
  const value = finiteNumber(length);
  if (value === null || value <= 0) return 0;
  return Math.min(value, positiveOr(maxLength, THROW_VISUALIZER_MAX_LENGTH));
}

/**
 * Power ratio for a drag length: the clamped length over the maximum
 * length, clamped to `[0, 1]`.
 *
 * @param {number} length
 * @param {number} [maxLength]
 * @returns {number}
 */
export function throwPowerRatio(length, maxLength = THROW_VISUALIZER_MAX_LENGTH) {
  const max = positiveOr(maxLength, THROW_VISUALIZER_MAX_LENGTH);
  return clampThrowLength(length, max) / max;
}

/**
 * Interpolate the throw colour for a power ratio: teal at 0, gold at 0.5,
 * and orange-red at 1. Out-of-range ratios clamp to the nearest stop.
 *
 * @param {number} ratio
 * @returns {string}
 */
export function throwColorForPower(ratio) {
  /** @type {number} */
  const clamped =
    finiteNumber(ratio) === null
      ? 0
      : Math.max(0, Math.min(1, /** @type {number} */ (finiteNumber(ratio))));
  const from = clamped < 0.5 ? THROW_COLOR_STOPS.soft : THROW_COLOR_STOPS.medium;
  const to = clamped < 0.5 ? THROW_COLOR_STOPS.medium : THROW_COLOR_STOPS.max;
  const local = (clamped < 0.5 ? clamped : clamped - 0.5) * 2;
  return rgbString({
    r: Math.round(from.r + (to.r - from.r) * local),
    g: Math.round(from.g + (to.g - from.g) * local),
    b: Math.round(from.b + (to.b - from.b) * local)
  });
}

/**
 * Clamp a drag tip to the maximum length along the vector ray from `start`
 * toward `current`.
 *
 * @param {Pointer2D} start
 * @param {Pointer2D} current
 * @param {number} [maxLength]
 * @returns {{ point: Pointer2D, length: number, ratio: number }}
 */
export function clampThrowPoint(start, current, maxLength = THROW_VISUALIZER_MAX_LENGTH) {
  const anchor = toPoint(start);
  const cursor = toPoint(current);
  const max = positiveOr(maxLength, THROW_VISUALIZER_MAX_LENGTH);
  const dx = cursor.x - anchor.x;
  const dy = cursor.y - anchor.y;
  const rawLength = Math.hypot(dx, dy);
  if (rawLength <= max || rawLength === 0) {
    return { point: cursor, length: rawLength, ratio: rawLength / max };
  }
  const scale = max / rawLength;
  return { point: { x: anchor.x + dx * scale, y: anchor.y + dy * scale }, length: max, ratio: 1 };
}

/**
 * Interactive SVG throw visualizer: a responsive overlay mounted on a
 * container that draws the directional vector arrow, arrowhead, base
 * anchor, and maximum-power boundary ring for one pointer drag.
 *
 * The arrow base stays anchored at `P_start` (`start(point)`); the tip
 * follows `P_current` (`update(point)`) and clamps to the maximum length
 * along the drag ray. Points are client coordinates — they are converted
 * into container-local coordinates via the container's bounding rect, so
 * callers pass pointer-event coordinates directly. The arrow colour
 * interpolates teal → gold → orange-red with the power ratio (clamped
 * length over maximum length). Drags below the tap threshold stay hidden
 * so clicks keep their picking behaviour, `release(point)` plays a fade +
 * scale snap, and `cancel()`/`detach()` hide and tear down immediately.
 *
 * The overlay never intercepts pointer events and never touches dice: it is
 * presentation only, so it is import-safe in Node (construction without a
 * DOM simply stays inert).
 */
export class ThrowVisualizer {
  /** @type {string} */
  id = 'throw-visualizer';

  /** @type {any} */
  #container;

  /** @type {number} */
  #maxLength;

  /** @type {number} */
  #threshold;

  /** @type {number} */
  #releaseDurationMs;

  /** @type {string} */
  #testId;

  /** @type {any} */
  #svg = null;

  /** @type {any} */
  #ring = null;

  /** @type {any} */
  #anchorEl = null;

  /** @type {any} */
  #shaft = null;

  /** @type {any} */
  #head = null;

  /** @type {Pointer2D|null} */
  #anchor = null;

  /** @type {Pointer2D|null} */
  #tip = null;

  /** @type {number} */
  #length = 0;

  /** @type {number} */
  #ratio = 0;

  /** @type {string} */
  #color = THROW_VISUALIZER_SOFT_COLOR;

  /** @type {boolean} */
  #arrowVisible = false;

  /** @type {'idle'|'dragging'|'releasing'} */
  #state = 'idle';

  /** @type {any} */
  #timer = null;

  /**
   * @param {ThrowVisualizerOptions} [options]
   */
  constructor(options = {}) {
    this.#container = options.container ?? null;
    this.#maxLength = positiveOr(options.maxLength, THROW_VISUALIZER_MAX_LENGTH);
    this.#threshold = positiveOr(options.threshold, THROW_VISUALIZER_THRESHOLD);
    this.#releaseDurationMs = positiveOr(options.releaseDurationMs, THROW_VISUALIZER_RELEASE_MS);
    this.#testId = options.testId ?? 'throw-visualizer';
    this.#color = THROW_VISUALIZER_SOFT_COLOR;
    this.#mount();
  }

  /**
   * The SVG overlay element, or `null` when no DOM/container is available.
   *
   * @returns {any}
   */
  get element() {
    return this.#svg;
  }

  /**
   * Whether the arrow is currently displayed (dragging past the threshold).
   *
   * @returns {boolean}
   */
  get visible() {
    return this.#state === 'dragging' && this.#arrowVisible;
  }

  /**
   * Current power ratio: clamped arrow length over maximum length.
   *
   * @returns {number}
   */
  get powerRatio() {
    return this.#ratio;
  }

  /**
   * Current clamped arrow length in pixels.
   *
   * @returns {number}
   */
  get length() {
    return this.#length;
  }

  /**
   * Current interpolated arrow colour.
   *
   * @returns {string}
   */
  get color() {
    return this.#color;
  }

  /**
   * Base anchor `P_start` in container-local coordinates, or `null` when
   * idle.
   *
   * @returns {Pointer2D|null}
   */
  get anchor() {
    return this.#anchor ? { ...this.#anchor } : null;
  }

  /**
   * Clamped tip `P_current` in container-local coordinates, or `null` when
   * idle.
   *
   * @returns {Pointer2D|null}
   */
  get tip() {
    return this.#tip ? { ...this.#tip } : null;
  }

  /**
   * Maximum arrow length in pixels.
   *
   * @returns {number}
   */
  get maxLength() {
    return this.#maxLength;
  }

  /**
   * Sub-threshold drag length in pixels below which the arrow stays hidden.
   *
   * @returns {number}
   */
  get threshold() {
    return this.#threshold;
  }

  /**
   * Mount the responsive SVG overlay. Stays inert when no DOM or container
   * is available so importing and constructing in Node never throws.
   *
   * @returns {void}
   */
  #mount() {
    if (!this.#container) return;
    const doc = globalThis.document;
    if (!doc || typeof doc.createElementNS !== 'function') return;

    const namespace = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'throw-visualizer');
    svg.setAttribute('data-testid', this.#testId);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';
    svg.style.visibility = 'hidden';
    svg.style.opacity = '1';

    this.#ring = doc.createElementNS(namespace, 'circle');
    this.#ring.setAttribute('fill', 'none');
    this.#ring.setAttribute('stroke-width', '2');
    this.#ring.setAttribute('stroke-dasharray', '5 5');
    this.#ring.setAttribute('stroke-opacity', '0.55');

    this.#shaft = doc.createElementNS(namespace, 'line');
    this.#shaft.setAttribute('stroke-width', '4');
    this.#shaft.setAttribute('stroke-linecap', 'round');

    this.#head = doc.createElementNS(namespace, 'polygon');

    this.#anchorEl = doc.createElementNS(namespace, 'circle');
    this.#anchorEl.setAttribute('r', '5');
    this.#anchorEl.setAttribute('stroke', '#ffffff');
    this.#anchorEl.setAttribute('stroke-width', '2');

    svg.appendChild(this.#ring);
    svg.appendChild(this.#shaft);
    svg.appendChild(this.#head);
    svg.appendChild(this.#anchorEl);

    this.#svg = svg;
    this.#container.appendChild(svg);
  }

  /**
   * Convert client coordinates into container-local coordinates.
   *
   * @param {Pointer2D} point
   * @returns {Pointer2D}
   */
  #toLocal(point) {
    const client = toPoint(point);
    if (!this.#container || typeof this.#container.getBoundingClientRect !== 'function') {
      return client;
    }
    try {
      const rect = this.#container.getBoundingClientRect();
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) return client;
      return { x: client.x - rect.left, y: client.y - rect.top };
    } catch {
      return client;
    }
  }

  /**
   * Clear any pending release timer.
   *
   * @returns {void}
   */
  #clearTimer() {
    if (this.#timer !== null && typeof globalThis.clearTimeout === 'function') {
      globalThis.clearTimeout(this.#timer);
    }
    this.#timer = null;
  }

  /**
   * Show or hide the whole overlay. Opacity is reset so a following release
   * animation starts from fully opaque.
   *
   * @param {boolean} show
   * @returns {void}
   */
  #setOverlayVisible(show) {
    if (!this.#svg) return;
    this.#svg.style.visibility = show ? 'visible' : 'hidden';
    if (show) this.#svg.style.opacity = '1';
  }

  /**
   * Repaint the arrow parts from the current anchor/tip/color state.
   *
   * @returns {void}
   */
  #paint() {
    if (!this.#svg || !this.#anchor || !this.#tip) return;

    this.#ring.setAttribute('cx', String(this.#anchor.x));
    this.#ring.setAttribute('cy', String(this.#anchor.y));
    this.#ring.setAttribute('r', String(this.#maxLength));
    this.#ring.setAttribute('stroke', this.#color);

    this.#shaft.setAttribute('x1', String(this.#anchor.x));
    this.#shaft.setAttribute('y1', String(this.#anchor.y));
    this.#shaft.setAttribute('x2', String(this.#tip.x));
    this.#shaft.setAttribute('y2', String(this.#tip.y));
    this.#shaft.setAttribute('stroke', this.#color);

    const dx = this.#tip.x - this.#anchor.x;
    const dy = this.#tip.y - this.#anchor.y;
    const rawLength = Math.hypot(dx, dy);
    const ux = rawLength > 0 ? dx / rawLength : 1;
    const uy = rawLength > 0 ? dy / rawLength : 0;
    const headLength = ARROW_HEAD_BASE + ARROW_HEAD_GROWTH * this.#ratio;
    const headHalf = ARROW_HEAD_HALF_BASE + (ARROW_HEAD_HALF_BASE / 2) * this.#ratio;
    const baseX = this.#tip.x - ux * headLength;
    const baseY = this.#tip.y - uy * headLength;
    const points = [
      `${this.#tip.x},${this.#tip.y}`,
      `${baseX + -uy * headHalf},${baseY + ux * headHalf}`,
      `${baseX - -uy * headHalf},${baseY - ux * headHalf}`
    ].join(' ');
    this.#head.setAttribute('points', points);
    this.#head.setAttribute('fill', this.#color);

    this.#anchorEl.setAttribute('cx', String(this.#anchor.x));
    this.#anchorEl.setAttribute('cy', String(this.#anchor.y));
    this.#anchorEl.setAttribute('fill', this.#color);
  }

  /**
   * Anchor the arrow base at the pointer-down point and reset the overlay
   * to a hidden zero-length drag.
   *
   * @param {Pointer2D} point Client coordinates of the pointer-down point.
   * @returns {void}
   */
  start(point) {
    this.#clearTimer();
    this.#anchor = this.#toLocal(point);
    this.#tip = { ...this.#anchor };
    this.#length = 0;
    this.#ratio = 0;
    this.#color = THROW_VISUALIZER_SOFT_COLOR;
    this.#arrowVisible = false;
    this.#state = 'dragging';

    if (this.#svg) {
      this.#svg.classList.remove('is-releasing');
      this.#svg.style.transition = '';
      this.#svg.style.transform = '';
      this.#svg.style.opacity = '1';
      this.#svg.style.visibility = 'hidden';
      this.#paint();
    }
  }

  /**
   * Follow the pointer: the tip tracks the cursor and clamps to the maximum
   * length along the drag ray. Below the tap threshold the arrow stays
   * hidden; past it the arrow appears with the interpolated power colour.
   *
   * @param {Pointer2D} point Client coordinates of the current pointer.
   * @returns {void}
   */
  update(point) {
    if (this.#state !== 'dragging' || !this.#anchor) return;

    const local = this.#toLocal(point);
    const clamped = clampThrowPoint(this.#anchor, local, this.#maxLength);
    this.#tip = clamped.point;
    this.#length = clamped.length;
    this.#ratio = clamped.ratio;
    this.#color = throwColorForPower(clamped.ratio);

    const dx = local.x - this.#anchor.x;
    const dy = local.y - this.#anchor.y;
    this.#arrowVisible = Math.hypot(dx, dy) >= this.#threshold;

    this.#setOverlayVisible(this.#arrowVisible);
    if (this.#arrowVisible) this.#paint();
  }

  /**
   * Release the drag: snap the tip to the final point (when supplied) and
   * play the fade + scale snap, then hide. Sub-threshold releases hide
   * immediately without animating.
   *
   * @param {Pointer2D} [point] Client coordinates of the pointer-up point.
   * @returns {void}
   */
  release(point) {
    if (point) this.update(point);
    if (this.#state !== 'dragging' || !this.#arrowVisible) {
      this.hide();
      return;
    }

    this.#state = 'releasing';
    this.#arrowVisible = false;
    if (!this.#svg || typeof globalThis.setTimeout !== 'function') {
      this.hide();
      return;
    }

    this.#svg.classList.add('is-releasing');
    this.#svg.style.transition =
      `opacity ${this.#releaseDurationMs}ms ease-out, transform ${this.#releaseDurationMs}ms ease-out`;
    if (this.#anchor) {
      this.#svg.style.transformOrigin = `${this.#anchor.x}px ${this.#anchor.y}px`;
    }
    this.#svg.style.opacity = '0';
    this.#svg.style.transform = 'scale(1.06)';

    this.#timer = globalThis.setTimeout(() => {
      this.#timer = null;
      this.hide();
    }, this.#releaseDurationMs);
  }

  /**
   * Hide immediately: clear the anchor and reset to a zero-length drag.
   * Used for the sub-threshold auto-hide and pointer cancel.
   *
   * @returns {void}
   */
  hide() {
    this.#clearTimer();
    this.#state = 'idle';
    this.#anchor = null;
    this.#tip = null;
    this.#length = 0;
    this.#ratio = 0;
    this.#color = THROW_VISUALIZER_SOFT_COLOR;
    this.#arrowVisible = false;

    if (this.#svg) {
      this.#svg.classList.remove('is-releasing');
      this.#svg.style.transition = '';
      this.#svg.style.transform = '';
      this.#svg.style.transformOrigin = '';
      this.#svg.style.opacity = '1';
      this.#svg.style.visibility = 'hidden';
    }
  }

  /**
   * Abort the drag: hide the overlay exactly like pointer cancel.
   *
   * @returns {void}
   */
  cancel() {
    this.hide();
  }

  /**
   * Hide the overlay and remove the SVG from the container. Idempotent.
   *
   * @returns {void}
   */
  detach() {
    this.hide();
    if (this.#svg?.parentNode) {
      this.#svg.parentNode.removeChild(this.#svg);
    }
    this.#svg = null;
    this.#ring = null;
    this.#anchorEl = null;
    this.#shaft = null;
    this.#head = null;
    this.#container = null;
  }

  /**
   * Alias for {@link ThrowVisualizer#detach}, matching the UI package's
   * teardown naming.
   *
   * @returns {void}
   */
  destroy() {
    this.detach();
  }
}
