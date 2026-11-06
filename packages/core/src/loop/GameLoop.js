import { EVENTS } from '../events/catalog.js';
import { StandardRollStrategy } from './strategies/StandardRollStrategy.js';

/**
 * Strategy interface implemented by the built-in roll strategies.
 */
export class GameLoopStrategy {
  constructor() {
    /** @type {string} */
    this.mode = 'standard';
  }

  /**
   * @param {GameLoop} _loop
   */
  init(_loop) {}

  /**
   * @param {GameLoop} _loop
   * @param {number} _dt
   * @returns {import('../contracts.js').StepResult}
   */
  update(_loop, _dt) {
    return { continue: true, settled: false };
  }
}

/**
 * Fixed-step game loop.
 *
 * The loop owns no timer and never touches browser globals. A `Scheduler`
 * provides the clock and frame callbacks, so browser code and headless code use
 * the same loop with different schedulers.
 */
export class GameLoop {
  /**
   * @param {Object} config
   * @param {(dt: number) => void} config.step
   * @param {(alpha?: number) => void} [config.render]
   * @param {() => void} [config.sync]
   * @param {import('../contracts.js').WorldContract|null} [config.world]
   * @param {import('../contracts.js').Scheduler} config.scheduler
   * @param {import('../events/EventBus.js').EventBus<any>|null} [config.eventBus]
   * @param {number} [config.fixedStep]
   * @param {number} [config.maxSubSteps]
   * @param {number} [config.maxFrameGap]
   */
  constructor({
    step,
    render = undefined,
    sync = undefined,
    world = null,
    scheduler,
    eventBus = null,
    fixedStep = 1 / 60,
    maxSubSteps = 4,
    maxFrameGap = 0.25
  }) {
    if (typeof step !== 'function') {
      throw new TypeError('GameLoop requires a step(dt) function.');
    }
    if (!scheduler) {
      throw new TypeError('GameLoop requires a scheduler.');
    }
    if (!(fixedStep > 0)) {
      throw new RangeError('GameLoop fixedStep must be greater than zero.');
    }
    if (!(maxSubSteps > 0)) {
      throw new RangeError('GameLoop maxSubSteps must be greater than zero.');
    }

    /** @type {(dt: number) => void} */
    this.stepFn = step;
    /** @type {((alpha?: number) => void)|undefined} */
    this.renderFn = render;
    /** @type {(() => void)|undefined} */
    this.syncFn = sync;
    /** @type {import('../contracts.js').WorldContract|null} */
    this.world = world;
    /** @type {import('../contracts.js').Scheduler} */
    this.scheduler = scheduler;
    /** @type {import('../events/EventBus.js').EventBus<any>|null} */
    this.eventBus = eventBus;

    /** @type {number} */
    this.fixedStep = fixedStep;
    /** @type {number} */
    this.maxSubSteps = maxSubSteps;
    /** @type {number} */
    this.maxFrameGap = maxFrameGap;

    /** @type {boolean} */
    this.running = false;
    /** @type {boolean} */
    this.paused = false;
    /** @type {number|null} */
    this.frameId = null;
    /** @type {number} */
    this.lastTime = 0;
    /** @type {number} */
    this.accumulator = 0;
    /** @type {number} */
    this.iteration = 0;
    /** @type {number} */
    this.elapsed = 0;
    /** @type {number} */
    this.runId = 0;

    /** @type {GameLoopStrategy} */
    this.strategy = new StandardRollStrategy();

    this._tick = this._tick.bind(this);
  }

  /**
   * Replace the active strategy.
   *
   * @param {GameLoopStrategy} strategy
   */
  setStrategy(strategy) {
    this.strategy = strategy;
    if (this.running && strategy.init) {
      strategy.init(this);
    }
  }

  /**
   * Start a new run.
   *
   * @param {GameLoopStrategy|null} [strategy]
   */
  start(strategy = null) {
    if (this.running) {
      this.stop('restart');
    }

    if (strategy) {
      this.strategy = strategy;
    }

    this.running = true;
    this.paused = false;
    this.runId += 1;
    this.iteration = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.lastTime = this.scheduler.now();

    if (this.strategy.init) {
      this.strategy.init(this);
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.LOOP_START, {
        runId: this.runId,
        mode: this.strategy.mode ?? 'standard'
      });
    }

    this._scheduleFrame();
  }

  /**
   * Pause without ending the run.
   */
  pause() {
    if (!this.running || this.paused) return;

    this.paused = true;
    if (this.frameId !== null) {
      this.scheduler.cancelFrame(this.frameId);
      this.frameId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.LOOP_PAUSE, { runId: this.runId });
    }
  }

  /**
   * Resume a paused run.
   */
  resume() {
    if (!this.running || !this.paused) return;

    this.paused = false;
    this.lastTime = this.scheduler.now();

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.LOOP_RESUME, { runId: this.runId });
    }

    this._scheduleFrame();
  }

  /**
   * Advance exactly one step without scheduling a frame.
   *
   * @param {number} [dt] Step delta in seconds.
   * @returns {import('../contracts.js').StepResult}
   */
  step(dt = this.fixedStep) {
    const result = this._advance(dt);

    if (this.renderFn) {
      this.renderFn(1);
    }

    if (!result.continue) {
      this.stop(result.settled ? 'settled' : 'strategy');
    }

    return result;
  }

  /**
   * Stop the current run.
   *
   * @param {string} [reason]
   */
  stop(reason = 'stopped') {
    if (!this.running && !this.paused) return;

    this.running = false;
    this.paused = false;
    this.accumulator = 0;

    if (this.frameId !== null) {
      this.scheduler.cancelFrame(this.frameId);
      this.frameId = null;
    }

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.LOOP_STOP, { runId: this.runId, reason });
    }
  }

  /**
   * @private
   * @param {number} dt
   * @returns {import('../contracts.js').StepResult}
   */
  _advance(dt) {
    this.iteration += 1;
    this.elapsed += dt;

    this.stepFn(dt);
    if (this.syncFn) this.syncFn();

    if (this.eventBus) {
      this.eventBus.emit(EVENTS.TICK, {
        iteration: this.iteration,
        dt,
        elapsed: this.elapsed
      });
    }

    if (this.strategy) {
      return this.strategy.update(this, dt);
    }
    return { continue: true, settled: false };
  }

  /**
   * @private
   */
  _scheduleFrame() {
    if (!this.running || this.paused) return;
    this.frameId = this.scheduler.requestFrame(this._tick);
  }

  /**
   * @private
   * @param {number} currentTime
   */
  _tick(currentTime) {
    if (!this.running || this.paused) return;

    const now = Number.isFinite(currentTime) ? currentTime : this.scheduler.now();
    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > this.maxFrameGap) delta = this.maxFrameGap;

    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxSubSteps) {
      this.accumulator -= this.fixedStep;
      steps += 1;

      const result = this._advance(this.fixedStep);
      if (!result.continue) {
        this.stop(result.settled ? 'settled' : 'strategy');
        return;
      }
    }

    // Drop backlog instead of spiralling when a device cannot keep up.
    if (steps === this.maxSubSteps && this.accumulator >= this.fixedStep) {
      this.accumulator %= this.fixedStep;
    }

    if (this.renderFn) {
      this.renderFn(this.accumulator / this.fixedStep);
    }

    this._scheduleFrame();
  }
}
