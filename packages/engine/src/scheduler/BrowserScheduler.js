/**
 * Browser scheduler: wraps `performance.now` and `requestAnimationFrame`.
 *
 * The module is import-safe in Node: no browser global is read at import
 * time. Globals are only touched when a scheduler is actually used, which
 * the engine only does in browser mode (a container without headless).
 */
export class BrowserScheduler {
  /**
   * @param {{ requestFrame?: (callback: (time: number) => void) => number, cancelFrame?: (id: number) => void, now?: () => number }} [globals] Injectable globals for tests.
   */
  constructor(globals = {}) {
    /** @type {(callback: (time: number) => void) => number} */
    this._requestFrame = globals.requestFrame ?? ((callback) => {
      const raf = globalThis.requestAnimationFrame;
      if (typeof raf !== 'function') {
        throw new Error('BrowserScheduler requires requestAnimationFrame.');
      }
      return raf.call(globalThis, callback);
    });

    /** @type {(id: number) => void} */
    this._cancelFrame = globals.cancelFrame ?? ((id) => {
      const cancel = globalThis.cancelAnimationFrame;
      if (typeof cancel === 'function') {
        cancel.call(globalThis, id);
      }
    });

    /** @type {() => number} */
    this._now = globals.now ?? (() => {
      const perf = globalThis.performance;
      if (perf && typeof perf.now === 'function') return perf.now();
      return Date.now();
    });
  }

  /**
   * @returns {number} Current time in milliseconds.
   */
  now() {
    return this._now();
  }

  /**
   * @param {(time: number) => void} callback
   * @returns {number} Frame id.
   */
  requestFrame(callback) {
    return this._requestFrame(callback);
  }

  /**
   * @param {number} id
   * @returns {void}
   */
  cancelFrame(id) {
    this._cancelFrame(id);
  }
}
