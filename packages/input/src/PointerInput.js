import { createBrowserRandom } from '@dice/core';

import {
  buildContinuousImpulses,
  buildThrowVectors,
  clientToSpawnOrigin,
  evaluateGesture,
  getPointerCoords,
  gestureDistance
} from './gesture.js';
import { THROW_VISUALIZER_THRESHOLD, ThrowVisualizer } from './ThrowVisualizer.js';

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
 * @property {'standard'|'continuous'|string|(() => string)} [mode] Live engine mode, read on every flick so runtime mode switches take effect immediately.
 * @property {() => string} [getMode] Alternative live engine mode getter.
 * @property {{ emit: (name: string, payload: any) => void }} events
 */

/**
 * @typedef {Object} PointerInputOptions
 * @property {any} [container]
 * @property {number} [dieCount]
 * @property {number} [dieInertia]
 * @property {number} [dieMass] Mass of one die, used to scale continuous-mode
 * impulses so the velocity change equals the throw velocity. Defaults to
 * the physics/world default mass (see `DEFAULT_DIE_MASS` in gesture.js).
 * @property {number} [throwStrength] The one throw-strength setting for
 * every flick, in both standard and continuous mode (see `THROW_STRENGTH`
 * in gesture.js). The launch angle still differs per mode: spawned dice
 * lob at the throw ratio, resting dice pop steeply off the floor.
 * @property {number} [continuousUpwardRatio] Continuous-mode upward velocity
 * as a fraction of the horizontal speed (see
 * `CONTINUOUS_UPWARD_VELOCITY_RATIO` in gesture.js).
 * @property {any} [rng]
 * @property {() => number} [now]
 * @property {boolean} [interruptRolls] When true, a flick passes
 * `cancelActive` so it replaces a roll that is still running instead of
 * being dropped. Default false: flicks wait for the current roll to end.
 * @property {boolean|Record<string, any>|null} [visualizer] Throw arrow
 * overlay configuration. `false` (or `null`) disables the overlay; an
 * object is forwarded to `ThrowVisualizer` (for example `maxLength`,
 * `threshold`, `releaseDurationMs`); undefined mounts the overlay with
 * defaults. The overlay's threshold is also the dispatch threshold: drags
 * shorter than it cancel the throw.
 * @property {(() => Record<string, any>)|null} [rollRequest] Callback
 * invoked on each standard-mode flick dispatch; its returned fields are
 * merged into the `host.roll()` request under the flick's own `vectors`,
 * `dice`, and `cancelActive` (so a flick always spawns its own vectors).
 * Apps whose rolls carry extra state — for example the dice visual lab's
 * face mappings — use it so flicks roll with the same extras as their
 * buttons (a flick calls `host.roll()` directly, bypassing app code).
 * Continuous-mode flicks ignore it: they never roll.
 */

/**
 * Pointer (mouse/touch) flick input. Converts drag gestures into throw vectors
 * and delegates the roll to the host. It never mutates dice bodies directly.
 *
 * In standard mode a flick delegates a fresh roll to the host. In
 * continuous mode (`host.mode === 'continuous'`) a flick instead applies a
 * per-die impulse — directional, with an upward pop and randomized
 * direction/magnitude variance — to every active die through
 * `host.applyImpulse()` and never triggers `host.roll()`, so the live dice
 * are neither cleared nor respawned.
 *
 * The throw arrow (`ThrowVisualizer`) is driven alongside the gesture:
 * `start` on pointer-down, `update` on pointer-move, `release` on
 * pointer-up, and `cancel` on pointer-cancel. The arrow is presentation
 * only — it never affects the math. Throw vectors spawn around the
 * projected pointer-down point ({@link clientToSpawnOrigin}), and
 * continuous impulses share that point as their application point.
 *
 * Only drags past the visual threshold (18 px by default) count as throws;
 * shorter drags cancel, preserving tap/click picking for `RaycastPicker`.
 * This supersedes the legacy scene-area swipe rule in `evaluateGesture`
 * (still reported as `isSwipe` on the gesture result) for this input path.
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

  /** @type {number|undefined} */
  #dieMass;

  /** @type {number|undefined} */
  #throwStrength;

  /** @type {number|undefined} */
  #continuousUpwardRatio;

  /** @type {(() => Record<string, any>)|null} */
  #rollRequest;

  /** @type {any|null} */
  #rng;

  /** @type {() => number} */
  #now;

  /** @type {ThrowVisualizer|null} */
  #visualizer = null;

  /** @type {InputHostLike|null} */
  #host = null;

  /** @type {{ x: number, y: number }|null} */
  #start = null;

  /** @type {number} */
  #startTime = 0;

  /** @type {boolean} */
  #enabled = false;

  /**
   * Whether a flick interrupts a roll that is still running (passes
   * `cancelActive` to the host roll request). Settable at runtime so apps
   * can bind it to a setting. Default false: flicks wait for the current
   * roll to settle.
   *
   * @type {boolean}
   */
  interruptRolls;

  /** @type {(event: any) => void} */
  #onPointerDown;

  /** @type {(event: any) => void} */
  #onPointerMove;

  /** @type {(event: any) => void} */
  #onPointerUp;

  /** @type {() => void} */
  #onPointerCancel;

  /**
   * Window that owns the container. Pointer-move and pointer-up are also
   * observed there so the arrow keeps tracking and a flick that leaves the
   * container still completes, like the legacy body-level listeners. Null
   * when no window is available (Node tests).
   *
   * @type {any|null}
   */
  #windowTarget = null;

  /**
   * @param {PointerInputOptions} [options]
   */
  constructor(options = {}) {
    this.#container = options.container ?? null;
    this.#dieCount = options.dieCount ?? null;
    this.#dieInertia = options.dieInertia ?? 13;
    this.#dieMass = options.dieMass ?? undefined;
    this.#throwStrength = options.throwStrength ?? undefined;
    this.#continuousUpwardRatio =
      options.continuousUpwardRatio ?? undefined;
    this.#rollRequest = options.rollRequest ?? null;
    this.#rng = options.rng ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.interruptRolls = options.interruptRolls ?? false;

    if (options.visualizer !== false && options.visualizer !== null) {
      const forwarded =
        typeof options.visualizer === 'object' ? options.visualizer : {};
      this.#visualizer = new ThrowVisualizer({
        ...forwarded,
        container: this.#container
      });
    }

    this.#onPointerDown = (event) => this.#handlePointerDown(event);
    this.#onPointerMove = (event) => this.#handlePointerMove(event);
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
    this.#visualizer?.detach();
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
    this.#container.addEventListener('mousemove', this.#onPointerMove);
    this.#container.addEventListener('touchmove', this.#onPointerMove, { passive: true });
    this.#container.addEventListener('mouseup', this.#onPointerUp);
    this.#container.addEventListener('touchend', this.#onPointerUp, { passive: true });
    this.#container.addEventListener('touchcancel', this.#onPointerCancel, { passive: true });
    // Pointer-move and pointer-up are additionally observed on the
    // container's window. A flick that leaves the container before release
    // (over a control panel, the header, or outside the stage) must still
    // count and keep tracking the arrow; the legacy demo listened on the
    // body, so any release completed the gesture. In-stage events bubble to
    // the window too, which is harmless: the first handler clears `#start`,
    // so the second one returns early (and the visualizer update with no
    // active drag is a no-op).
    const windowTarget = this.#resolveWindowTarget();
    if (windowTarget && windowTarget !== this.#container) {
      windowTarget.addEventListener('mousemove', this.#onPointerMove);
      windowTarget.addEventListener('touchmove', this.#onPointerMove, { passive: true });
      windowTarget.addEventListener('mouseup', this.#onPointerUp);
      windowTarget.addEventListener('touchend', this.#onPointerUp, { passive: true });
    }
    this.#windowTarget = windowTarget;
    this.#enabled = true;
  }

  /**
   * @returns {void}
   */
  disable() {
    if (!this.#enabled || !this.#container) return;
    this.#container.removeEventListener('mousedown', this.#onPointerDown);
    this.#container.removeEventListener('touchstart', this.#onPointerDown);
    this.#container.removeEventListener('mousemove', this.#onPointerMove);
    this.#container.removeEventListener('touchmove', this.#onPointerMove);
    this.#container.removeEventListener('mouseup', this.#onPointerUp);
    this.#container.removeEventListener('touchend', this.#onPointerUp);
    this.#container.removeEventListener('touchcancel', this.#onPointerCancel);
    if (this.#windowTarget && this.#windowTarget !== this.#container) {
      this.#windowTarget.removeEventListener('mousemove', this.#onPointerMove);
      this.#windowTarget.removeEventListener('touchmove', this.#onPointerMove);
      this.#windowTarget.removeEventListener('mouseup', this.#onPointerUp);
      this.#windowTarget.removeEventListener('touchend', this.#onPointerUp);
    }
    this.#windowTarget = null;
    this.#visualizer?.cancel();
    this.#start = null;
    this.#enabled = false;
  }

  /**
   * Resolve the window that owns the container for pointer-move/up
   * observation. Returns null when the container does not expose a window
   * (tests).
   *
   * @returns {any|null}
   */
  #resolveWindowTarget() {
    const view = this.#container?.ownerDocument?.defaultView;
    if (view && typeof view.addEventListener === 'function') return view;
    return null;
  }

  /**
   * Resolve the container's bounding rect for the screen-to-world
   * projection. Returns null when the container does not expose one
   * (headless hosts), in which case the projection falls back to the
   * container size in the metrics.
   *
   * @returns {{ left: number, top: number, width: number, height: number }|null}
   */
  #resolveContainerRect() {
    if (!this.#container || typeof this.#container.getBoundingClientRect !== 'function') {
      return null;
    }
    try {
      const rect = this.#container.getBoundingClientRect();
      if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    } catch {
      return null;
    }
  }

  /**
   * @returns {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * The throw-arrow overlay driven by this input, or `null` when disabled
   * via the `visualizer` option.
   *
   * @returns {ThrowVisualizer|null}
   */
  get visualizer() {
    return this.#visualizer;
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
   * Read the host's live engine mode. `DiceEngine` exposes it as a string
   * getter; a function-valued or `getMode()` host is also accepted. The mode
   * is read on every flick, never cached at attach time, so switching the
   * engine between standard and continuous takes effect immediately.
   *
   * @returns {string|null}
   */
  #resolveHostMode() {
    const host = this.#host;
    if (!host) return null;
    if (typeof host.mode === 'function') {
      const mode = host.mode();
      return typeof mode === 'string' ? mode : null;
    }
    if (typeof host.mode === 'string') return host.mode;
    if (typeof host.getMode === 'function') {
      const mode = host.getMode();
      return typeof mode === 'string' ? mode : null;
    }
    return null;
  }

  /**
   * Dispatch a continuous-mode flick as per-die impulses. Every active die
   * receives its own impulse (see {@link buildContinuousImpulses}); the
   * configured die count and spawn profile are irrelevant here because
   * nothing is respawned, and `host.roll()` is never called. Each impulse
   * is applied at the projected pointer-down point (`worldPoint`).
   *
   * @param {{ normalized: { x: number, y: number }, boost: number }} gesture
   * @param {string[]} diceIds
   * @param {{ x: number, y: number, z: number }} worldPoint
   * @returns {void}
   */
  #dispatchContinuousImpulses(gesture, diceIds, worldPoint) {
    if (typeof this.#host?.applyImpulse !== 'function') return;
    if (!Array.isArray(diceIds) || diceIds.length === 0) return;

    const impulses = buildContinuousImpulses({
      direction: gesture.normalized,
      boost: gesture.boost,
      ids: diceIds,
      rng: this.#resolveRng(),
      dieMass: this.#dieMass,
      throwStrength: this.#throwStrength,
      upwardRatio: this.#continuousUpwardRatio,
      worldPoint
    });
    for (const entry of impulses) {
      if (!entry.id) continue;
      this.#host.applyImpulse([entry.id], entry.impulse, entry.worldPoint);
    }
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerDown(event) {
    if (!this.#enabled || !this.#host) return;
    this.#startTime = this.#now();
    this.#start = getPointerCoords(event);
    this.#visualizer?.start(this.#start);
  }

  /**
   * @param {any} event
   * @returns {void}
   */
  #handlePointerMove(event) {
    if (!this.#enabled || !this.#host || !this.#start) return;
    this.#visualizer?.update(getPointerCoords(event));
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

    // Snap the arrow to the release point and play the fade + scale snap.
    // A sub-threshold release hides the overlay immediately instead.
    this.#visualizer?.release(end);

    const metrics = this.#host.getMetrics ? this.#host.getMetrics() : null;
    const gesture = evaluateGesture({ start, end, durationMs, metrics });
    const threshold = this.#visualizer
      ? this.#visualizer.threshold
      : THROW_VISUALIZER_THRESHOLD;
    if (gesture.distance < threshold) return;

    const diceIds = this.#host.getDiceIds ? this.#host.getDiceIds() : [];
    const rect = this.#resolveContainerRect();

    // Continuous mode: impulse the live dice in place. No spawn profile,
    // no throw vectors, and no roll — the dice are not cleared or respawned,
    // and a configured die count must not invent dice that do not exist.
    // The projected pointer-down point shares the default throw height:
    // the enclosure profile is deliberately not consulted here.
    if (this.#resolveHostMode() === 'continuous') {
      const worldPoint = clientToSpawnOrigin(start, rect, metrics, null);
      this.#dispatchContinuousImpulses(gesture, diceIds, worldPoint);
      return;
    }

    const spawnProfile = this.#host.getSpawnProfile
      ? this.#host.getSpawnProfile()
      : null;
    const count =
      this.#dieCount ?? (diceIds.length > 0 ? diceIds.length : 6);
    if (count <= 0) return;

    // Dice spawn scattered around the projected pointer-down point
    // (`P_start`) at the shared throw height (see
    // {@link clientToSpawnOrigin} and {@link buildThrowVectors}).
    const origin = clientToSpawnOrigin(start, rect, metrics, spawnProfile);
    const vectors = buildThrowVectors({
      direction: gesture.normalized,
      boost: gesture.boost,
      count,
      rng: this.#resolveRng(),
      metrics,
      spawnProfile,
      origin,
      dieInertia: this.#dieInertia,
      // Same single throw-strength setting as continuous mode.
      throwStrength: this.#throwStrength
    });
    if (vectors.length === 0) return;

    // App-supplied extras (e.g. the visual lab's face mappings) ride along
    // so a flick rolls like the app's own button; the flick's own vectors,
    // dice count, and cancel policy always win.
    const extra =
      typeof this.#rollRequest === 'function' ? this.#rollRequest() ?? {} : {};
    const result = this.#host.roll({
      ...extra,
      vectors,
      dice: vectors.length,
      cancelActive: this.interruptRolls
    });
    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  }

  /**
   * @returns {void}
   */
  #cancelGesture() {
    this.#start = null;
    this.#visualizer?.cancel();
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
