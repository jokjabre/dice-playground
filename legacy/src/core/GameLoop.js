/**
 * Strategy interface and implementations for GameLoop execution.
 */

export class GameLoopStrategy {
    /**
     * Called when the strategy is attached or the loop starts.
     * @param {import('./GameLoop.js').GameLoop} loop
     */
    init(loop) {}

    /**
     * Executes each frame update.
     * @param {import('./GameLoop.js').GameLoop} loop
     * @param {number} dt - Step delta in seconds
     * @returns {boolean} Whether the loop should continue running
     */
    update(loop, dt) {
        return true;
    }
}

/**
 * Standard turn-based roll strategy.
 * Steps simulation, checks if dice have settled below threshold,
 * fires 'roll:settle' event and stops the loop.
 */
export class StandardRollStrategy extends GameLoopStrategy {
    constructor(options = {}) {
        super();
        this.velocityThreshold = options.velocityThreshold ?? 6;
        this.settleFramesRequired = options.settleFramesRequired ?? 3;
        this.minFramesBeforeCheck = options.minFramesBeforeCheck ?? 10;
        this.maxFrames = options.maxFrames ?? 1000;
        this.onSettle = options.onSettle || null;
    }

    init(loop) {
        // Reset dice stopped counters
        const dices = loop.getDices();
        for (const dice of dices) {
            dice.dice_stopped = undefined;
        }
    }

    checkIfFinished(loop) {
        const dices = loop.getDices();
        if (!dices || dices.length === 0) return true;

        const frameRate = loop.options?.frame_rate || 1 / 60;
        // Don't settle too early
        if (loop.iteration < this.minFramesBeforeCheck) {
            return false;
        }

        let allSettled = true;
        const e = this.velocityThreshold;

        for (let i = 0; i < dices.length; ++i) {
            const dice = dices[i];
            if (dice.dice_stopped === true) continue;

            const a = dice.body?.angularVelocity;
            const v = dice.body?.velocity;
            if (!a || !v) continue;

            if (
                Math.abs(a.x) < e && Math.abs(a.y) < e && Math.abs(a.z) < e &&
                Math.abs(v.x) < e && Math.abs(v.y) < e && Math.abs(v.z) < e
            ) {
                if (dice.dice_stopped !== undefined && dice.dice_stopped !== false) {
                    if (loop.iteration - dice.dice_stopped > this.settleFramesRequired) {
                        dice.dice_stopped = true;
                        continue;
                    }
                } else {
                    dice.dice_stopped = loop.iteration;
                }
                allSettled = false;
            } else {
                dice.dice_stopped = undefined;
                allSettled = false;
            }
        }

        return allSettled;
    }

    update(loop, dt) {
        if (this.checkIfFinished(loop)) {
            const values = loop.getDiceValues ? loop.getDiceValues() : [];
            if (this.onSettle) {
                this.onSettle(values);
            }
            if (loop.eventBus) {
                loop.eventBus.emit('roll:settle', { values, iteration: loop.iteration });
            }
            return false; // Stop loop
        }
        return true; // Continue
    }
}

/**
 * Continuous motion strategy.
 * Keeps running uninterruptedly without checking settle thresholds.
 * Ideal for phone tilt/gyro or interactive sandbox physics.
 */
export class ContinuousMotionStrategy extends GameLoopStrategy {
    init(loop) {
        const dices = loop.getDices();
        for (const dice of dices) {
            dice.dice_stopped = 0;
        }
    }

    update(loop, dt) {
        // Continuous mode never auto-stops
        return true;
    }
}

/**
 * Core GameLoop coordinator.
 * Manages fixed timestep accumulation, requestAnimationFrame lifecycle,
 * step advancing, and strategy switching.
 */
export class GameLoop {
    /**
     * @param {Object} config
     * @param {Function} config.stepPhysics - Function to step physics (dt)
     * @param {Function} config.syncMeshes - Function to synchronize body to mesh
     * @param {Function} config.render - Function to render scene
     * @param {Function} [config.getDices] - Function returning array of active dice
     * @param {Function} [config.getDiceValues] - Function returning array of dice face values
     * @param {import('./EventBus.js').EventBus} [config.eventBus] - Event emitter
     * @param {Object} [config.options] - Configuration options (frame_rate, use_adaptive_timestep)
     */
    constructor({
        stepPhysics,
        syncMeshes,
        render,
        getDices = () => [],
        getDiceValues = () => [],
        eventBus = null,
        options = {}
    }) {
        this.stepPhysics = stepPhysics;
        this.syncMeshes = syncMeshes;
        this.render = render;
        this.getDices = getDices;
        this.getDiceValues = getDiceValues;
        this.eventBus = eventBus;
        this.options = options;

        this.running = false;
        this.paused = false;
        this.frameId = null;
        this.timeoutId = null;
        this.lastTime = 0;
        this.iteration = 0;
        this.runId = 0;

        // Default strategy is StandardRollStrategy
        this.strategy = new StandardRollStrategy();
    }

    /**
     * Set the current loop strategy.
     * @param {GameLoopStrategy} strategy
     */
    setStrategy(strategy) {
        this.strategy = strategy;
        if (this.running && this.strategy?.init) {
            this.strategy.init(this);
        }
    }

    /**
     * Start or restart the game loop.
     * @param {GameLoopStrategy} [strategy] Optional strategy override
     */
    start(strategy = null) {
        if (strategy) {
            this.strategy = strategy;
        }

        this.stop();

        this.running = true;
        this.paused = false;
        this.runId = Date.now();
        this.iteration = 0;
        this.lastTime = performance.now();

        if (this.strategy?.init) {
            this.strategy.init(this);
        }

        if (this.eventBus) {
            this.eventBus.emit('loop:start', { runId: this.runId });
        }

        this._tick = this._tick.bind(this);
        this.frameId = requestAnimationFrame(this._tick);
    }

    /**
     * Pause the loop.
     */
    pause() {
        this.paused = true;
        if (this.eventBus) {
            this.eventBus.emit('loop:pause');
        }
    }

    /**
     * Resume from pause.
     */
    resume() {
        if (!this.running || !this.paused) return;
        this.paused = false;
        this.lastTime = performance.now();
        if (this.eventBus) {
            this.eventBus.emit('loop:resume');
        }
        this.frameId = requestAnimationFrame(this._tick);
    }

    /**
     * Step the simulation by a fixed delta or custom delta (useful for manual or headless stepping).
     * @param {number} [dt]
     */
    step(dt) {
        const fixedDt = dt || this.options.frame_rate || 1 / 60;
        this.iteration++;

        if (this.stepPhysics) {
            this.stepPhysics(fixedDt);
        }

        if (this.syncMeshes) {
            this.syncMeshes();
        }

        if (this.render) {
            this.render();
        }

        if (this.eventBus) {
            this.eventBus.emit('tick', { iteration: this.iteration, dt: fixedDt });
        }

        if (this.strategy) {
            return this.strategy.update(this, fixedDt);
        }
        return true;
    }

    /**
     * Stop the game loop.
     */
    stop() {
        this.running = false;
        this.paused = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.eventBus) {
            this.eventBus.emit('loop:stop', { runId: this.runId });
        }
    }

    /**
     * Internal animation loop tick.
     */
    _tick(currentTime) {
        if (!this.running || this.paused) return;

        const fixedStep = this.options.frame_rate || 1 / 60;
        let timeDiff = (currentTime - this.lastTime) / 1000;
        if (timeDiff > 3) timeDiff = fixedStep;

        this.iteration++;

        // Step physics
        if (this.options.use_adaptive_timestep) {
            while (timeDiff > fixedStep * 1.1) {
                if (this.stepPhysics) this.stepPhysics(fixedStep);
                timeDiff -= fixedStep;
            }
            if (this.stepPhysics) this.stepPhysics(timeDiff);
        } else {
            if (this.stepPhysics) this.stepPhysics(fixedStep);
        }

        // Synchronize bodies to meshes
        if (this.syncMeshes) {
            this.syncMeshes();
        }

        // Render scene
        if (this.render) {
            this.render();
        }

        this.lastTime = currentTime;

        if (this.eventBus) {
            this.eventBus.emit('tick', { iteration: this.iteration, dt: timeDiff });
        }

        // Execute strategy check
        let shouldContinue = true;
        if (this.strategy) {
            shouldContinue = this.strategy.update(this, timeDiff);
        }

        if (!shouldContinue) {
            this.stop();
            return;
        }

        // Schedule next frame
        if (this.running && !this.paused) {
            if (!this.options.use_adaptive_timestep && timeDiff < fixedStep) {
                this.timeoutId = setTimeout(() => {
                    this.frameId = requestAnimationFrame(this._tick);
                }, (fixedStep - timeDiff) * 1000);
            } else {
                this.frameId = requestAnimationFrame(this._tick);
            }
        }
    }
}

