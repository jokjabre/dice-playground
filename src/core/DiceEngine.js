import { EventBus } from './EventBus.js';
import { GameLoop, StandardRollStrategy, ContinuousMotionStrategy } from './GameLoop.js';
import { createOptions } from '../config/options.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { BoxEnclosure } from '../enclosures/BoxEnclosure.js';
import { RenderScene } from '../rendering/RenderScene.js';
import { MeshBodySync } from '../rendering/MeshBodySync.js';
import { DiceFactory } from '../dice/DiceFactory.js';
import { BannerResultPresenter } from '../presentation/ResultPresenter.js';
import { OutcomePredictor } from '../determinism/OutcomePredictor.js';
import { InputManager } from '../input/InputManager.js';
import { MotionController } from '../input/MotionController.js';
import { RaycastPicker } from '../input/RaycastPicker.js';

/**
 * High-level engine coordinator.
 * Coordinates game loop, event bus, physics and rendering subsystems,
 * enclosures, dice factory, input handling, and determinism.
 */
export class DiceEngine {
    constructor(config = {}) {
        this.options = config.options || createOptions();
        this.eventBus = config.eventBus || new EventBus();

        this.physicsWorld = config.physicsWorld || new PhysicsWorld({
            gravity: config.gravity || { x: 0, y: 0, z: -980 }
        });
        this.enclosure = config.enclosure || new BoxEnclosure();
        this.dimensions = config.dimensions || null;

        this.renderScene = config.renderScene || (config.container ? new RenderScene({
            container: config.container,
            options: this.options
        }) : null);

        this.diceFactory = config.diceFactory || new DiceFactory({
            options: this.options,
            dimensions: this.dimensions,
            physicsWorld: this.physicsWorld,
            renderScene: this.renderScene
        });

        this.presenter = config.presenter || null;
        this.outcomePredictor = config.outcomePredictor || new OutcomePredictor({
            physicsWorld: this.physicsWorld,
            options: this.options
        });

        // Initialize boundary enclosure
        if (this.enclosure && this.physicsWorld) {
            this.enclosure.createPhysicsBodies(this.physicsWorld);
            if (this.dimensions) {
                this.enclosure.update(this.dimensions);
            }
        }

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

        // Forward loop settle event to presenter and external listeners
        this.eventBus.on('roll:settle', ({ values }) => {
            if (this.presenter) {
                this.presenter.present(values);
            }
        });

        // Input & Motion controllers (optional)
        this.inputManager = config.inputManager || null;
        this.motionController = config.motionController || null;
        this.raycastPicker = config.raycastPicker || (this.renderScene ? new RaycastPicker({
            camera: this.renderScene.camera,
            container: config.container,
            dimensions: this.dimensions
        }) : null);
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
     * @param {import('../enclosures/Enclosure.js').Enclosure} enclosure
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
            this.options.continuous_rolling = true;
            this.loop.setStrategy(new ContinuousMotionStrategy());
        } else {
            this.options.continuous_rolling = false;
            this.loop.setStrategy(new StandardRollStrategy(strategyConfig));
        }
        this.eventBus.emit('mode:change', { mode });
    }

    /**
     * Attach an input manager to handle user swipe throws.
     * @param {HTMLElement} [container]
     * @returns {InputManager}
     */
    attachInput(container) {
        if (this.inputManager) {
            this.inputManager.destroy();
        }
        this.inputManager = new InputManager({
            container: container || (this.renderScene ? this.renderScene.container : document.body),
            dimensions: this.dimensions,
            options: this.options,
            onThrow: (vectors) => {
                this.throwDice(vectors);
            }
        });
        return this.inputManager;
    }

    /**
     * Attach and enable mobile motion (gyro / tilt / shake) controller.
     * @returns {MotionController}
     */
    attachMotion() {
        if (this.motionController) {
            this.motionController.destroy();
        }
        this.motionController = new MotionController({
            physicsWorld: this.physicsWorld,
            getDices: () => this.getDices(),
            eventBus: this.eventBus
        });
        return this.motionController;
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
        if (this.diceFactory && Array.isArray(this.diceFactory.dices) && this.diceFactory.dices.length > 0) {
            return this.diceFactory.dices;
        }
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
     * Clears all dice from the scene and physics world.
     */
    clear() {
        this.loop.stop();
        if (this.diceFactory) {
            this.diceFactory.clear();
        }
        if (this.presenter) {
            this.presenter.clear();
        }
        this.render();
    }

    /**
     * Initiates a throw with given vectors and optional predetermined values.
     * @param {Array} vectors - Array of initial throw vectors { pos, velocity, angle, axis }
     * @param {Array<number>} [targetValues] - Desired dice values for predetermined roll
     * @param {Function} [callback] - Invoked on roll settle
     */
    throwDice(vectors, targetValues = null, callback = null) {
        if (!vectors || vectors.length === 0) return;

        this.clear();
        this.eventBus.emit('roll:start', { vectors, targetValues });

        // Predetermined roll shifting
        if (targetValues && targetValues.length > 0 && this.outcomePredictor) {
            this.outcomePredictor.predictAndShift({
                prepareDices: (vecs) => {
                    this.diceFactory.spawnDiceSet(vecs);
                },
                vectors,
                targetValues,
                dices: this.getDices(),
                world: this.physicsWorld,
                frameRate: this.options.frame_rate
            });
        } else {
            this.diceFactory.spawnDiceSet(vectors);
        }

        // Start loop with standard or continuous strategy
        if (this.options.continuous_rolling) {
            this.loop.start(this.continuousStrategy);
        } else {
            this.loop.start(new StandardRollStrategy({
                onSettle: (values) => {
                    if (callback) callback(values);
                }
            }));
        }
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

    /**
     * Cleanup all engine resources.
     */
    destroy() {
        this.stop();
        if (this.inputManager) this.inputManager.destroy();
        if (this.motionController) this.motionController.destroy();
        if (this.enclosure) this.enclosure.destroy(this.physicsWorld, this.renderScene);
        if (this.diceFactory) this.diceFactory.clear();
        if (this.renderScene) this.renderScene.destroy();
        if (this.presenter) this.presenter.destroy();
    }
}
