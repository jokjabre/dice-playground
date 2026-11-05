import { EventBus } from './EventBus.js';
import { GameLoop, StandardRollStrategy, ContinuousMotionStrategy } from './GameLoop.js';
import { createOptions } from '../config/options.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { BoxEnclosure } from '../enclosures/BoxEnclosure.js';
import { RenderScene } from '../rendering/RenderScene.js';
import { MeshBodySync } from '../rendering/MeshBodySync.js';

/**
 * High-level engine coordinator.
 * Coordinates game loop, event bus, physics and rendering subsystems, and configuration.
 */
export class DiceEngine {
    constructor(config = {}) {
        this.options = config.options || createOptions();
        this.eventBus = config.eventBus || new EventBus();

        this.physicsWorld = config.physicsWorld || new PhysicsWorld();
        this.enclosure = config.enclosure || new BoxEnclosure();
        this.renderScene = config.renderScene || (config.container ? new RenderScene({
            container: config.container,
            options: this.options
        }) : null);
        this.dimensions = config.dimensions || null;

        // Initialize GameLoop
        this.loop = new GameLoop({
            stepPhysics: (dt) => this.stepPhysics(dt),
            syncMeshes: () => this.syncMeshes(),
            render: () => this.render(),
            getDices: () => this.getDices(),
            getDiceValues: () => this.getDiceValues(),
            eventBus: this.eventBus,
            options: this.options
        });

        this.standardStrategy = new StandardRollStrategy();
        this.continuousStrategy = new ContinuousMotionStrategy();
    }

    /**
     * Get physics world wrapper.
     */
    get physics() {
        return this.physicsWorld;
    }

    /**
     * Get rendering scene wrapper.
     */
    get rendering() {
        return this.renderScene;
    }

    /**
     * Set boundary enclosure.
     * @param {Enclosure} enclosure
     */
    setEnclosure(enclosure) {
        if (this.enclosure) {
            this.enclosure.destroy(this.physicsWorld, this.renderScene);
        }
        this.enclosure = enclosure;
        if (this.enclosure && this.physicsWorld) {
            this.enclosure.createPhysicsBodies(this.physicsWorld);
            if (this.dimensions) {
                this.enclosure.update(this.dimensions);
            }
        }
    }

    /**
     * Switch loop mode to standard turn-based roll or continuous live motion.
     * @param {'standard'|'continuous'} mode
     * @param {Object} [strategyConfig]
     */
    setMode(mode, strategyConfig = {}) {
        if (mode === 'continuous') {
            this.loop.setStrategy(new ContinuousMotionStrategy());
        } else {
            this.loop.setStrategy(new StandardRollStrategy(strategyConfig));
        }
        this.eventBus.emit('mode:change', { mode });
    }

    /**
     * Step physics simulation.
     * @param {number} dt
     */
    stepPhysics(dt) {
        if (this.physicsWorld && typeof this.physicsWorld.step === 'function') {
            this.physicsWorld.step(dt);
        } else if (typeof this.onStepPhysics === 'function') {
            this.onStepPhysics(dt);
        }
    }

    /**
     * Synchronize rigid bodies to 3D meshes.
     */
    syncMeshes() {
        if (this.renderScene && typeof this.renderScene.syncMeshes === 'function') {
            this.renderScene.syncMeshes();
        } else if (typeof this.onSyncMeshes === 'function') {
            this.onSyncMeshes();
        }
    }

    /**
     * Render the visual scene.
     */
    render() {
        if (this.renderScene && typeof this.renderScene.render === 'function') {
            this.renderScene.render();
        } else if (typeof this.onRender === 'function') {
            this.onRender();
        }
    }

    /**
     * Get active dice array.
     * @returns {Array}
     */
    getDices() {
        if (typeof this.onGetDices === 'function') {
            return this.onGetDices();
        }
        return [];
    }

    /**
     * Get dice values array.
     * @returns {Array<number>}
     */
    getDiceValues() {
        if (typeof this.onGetDiceValues === 'function') {
            return this.onGetDiceValues();
        }
        return [];
    }

    /**
     * Start the game loop.
     */
    start() {
        this.loop.start();
    }

    /**
     * Stop the game loop.
     */
    stop() {
        this.loop.stop();
    }

    /**
     * Pause the game loop.
     */
    pause() {
        this.loop.pause();
    }

    /**
     * Resume the game loop.
     */
    resume() {
        this.loop.resume();
    }
}

