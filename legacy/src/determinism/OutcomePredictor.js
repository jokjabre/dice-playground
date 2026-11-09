/**
 * OutcomePredictor
 * Fast-forwards headless physics to predict natural landing values and shifts faces for requested values.
 */

import { FaceReader } from './FaceReader.js';
import { FaceShifter } from './FaceShifter.js';

export class OutcomePredictor {
    /**
     * @param {Object} [config={}]
     * @param {Object} [config.physicsWorld] - Physics world wrapper or CANNON.World.
     * @param {Object} [config.options] - Simulation configuration (frame_rate, etc.).
     * @param {number} [config.velocityThreshold=6] - Velocity threshold for stopped detection.
     * @param {number} [config.settleFramesRequired=3] - Frames resting before marked settled.
     * @param {number} [config.maxIterations=1000] - Failsafe max steps.
     */
    constructor(config = {}) {
        this.physicsWorld = config.physicsWorld || null;
        this.options = config.options || {};
        this.velocityThreshold = config.velocityThreshold ?? 6;
        this.settleFramesRequired = config.settleFramesRequired ?? 3;
        this.maxIterations = config.maxIterations ?? 1000;
    }

    /**
     * Fast-forwards the physics simulation until all dice come to rest,
     * then reads their final landing face values.
     * 
     * @param {Object} context - Execution context containing:
     *   - world: PhysicsWorld instance or CANNON.World
     *   - dices: Array of dice meshes or DiceEntities
     *   - frameRate: Timestep delta (defaults to options.frame_rate or 1/60)
     * @returns {Array<number>} Resulting natural face values for each die.
     */
    emulateThrow({ world, dices, frameRate = null }) {
        const simWorld = world?.instance || world || this.physicsWorld?.instance || this.physicsWorld;
        const dt = frameRate || this.options?.frame_rate || (1 / 60);

        if (!simWorld || !dices || dices.length === 0) {
            return [];
        }

        // Reset stopped state for all dice
        for (const die of dices) {
            die.dice_stopped = undefined;
        }

        let iteration = 0;
        const e = this.velocityThreshold;
        const requiredFrames = this.settleFramesRequired;

        const checkIfFinished = () => {
            let allSettled = true;
            for (let i = 0; i < dices.length; ++i) {
                const die = dices[i];
                if (die.dice_stopped === true) continue;

                const body = die.body || die.mesh?.body;
                if (!body) continue;

                const a = body.angularVelocity;
                const v = body.velocity;

                if (
                    Math.abs(a.x) < e && Math.abs(a.y) < e && Math.abs(a.z) < e &&
                    Math.abs(v.x) < e && Math.abs(v.y) < e && Math.abs(v.z) < e
                ) {
                    if (die.dice_stopped !== undefined && die.dice_stopped !== false) {
                        if (iteration - die.dice_stopped > requiredFrames) {
                            die.dice_stopped = true;
                            continue;
                        }
                    } else {
                        die.dice_stopped = iteration;
                    }
                    allSettled = false;
                } else {
                    die.dice_stopped = undefined;
                    allSettled = false;
                }
            }
            return allSettled;
        };

        // Advance headless physics
        while (!checkIfFinished() && iteration < this.maxIterations) {
            ++iteration;
            simWorld.step(dt);
        }

        // Read resulting faces
        return FaceReader.getDiceValues(dices);
    }

    /**
     * Orchestrates outcome prediction and applies face shifting for predetermined target values.
     * 
     * @param {Object} options
     * @param {Function} options.prepareDices - Function that sets up or resets dice bodies and vectors.
     * @param {Array<Object>} options.vectors - Initial impulse vectors.
     * @param {Array<number>} options.targetValues - Desired predetermined face values (e.g. [6, 6]).
     * @param {Array<THREE.Mesh|import('../dice/DiceEntity.js').DiceEntity>} options.dices - Active dice.
     * @param {Object} options.world - Physics world.
     * @param {number} [options.frameRate] - Step dt.
     * @returns {Array<number>} The natural simulated outcomes that were shifted from.
     */
    predictAndShift({ prepareDices, vectors, targetValues, dices, world, frameRate }) {
        if (!targetValues || !targetValues.length) return [];

        // 1. Prepare dice in the starting state
        prepareDices(vectors);

        // 2. Headless emulate throw to see where dice will naturally land
        const naturalResults = this.emulateThrow({ world, dices, frameRate });

        // 3. Reset dice back to initial throw vectors
        prepareDices(vectors);

        // 4. Shift faces so that targetValues will face up instead of naturalResults
        for (let i = 0; i < targetValues.length; ++i) {
            if (i < dices.length && targetValues[i] !== undefined && naturalResults[i] !== undefined) {
                FaceShifter.shiftDiceFaces(dices[i], targetValues[i], naturalResults[i]);
            }
        }

        return naturalResults;
    }
}

