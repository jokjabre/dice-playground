/**
 * diceFactory
 * Legacy singleton adapter wrapping src/dice/DiceFactory.js
 * Retains backward compatibility for dice.js, scene.js, and main.js.
 */

import { DiceFactory as ModularDiceFactory } from "../../src/dice/DiceFactory.js";
import { physics } from "./physics.js";
import { world } from "./world.js";
import { scene } from "./scene.js";
import { options } from "../../src/config/options.js";
import { dimensions, playingField } from "../../src/config/dimensions.js";

const internalFactory = new ModularDiceFactory({
    options: options,
    dimensions: playingField,
    physics: physics,
    physicsWorld: world,
    renderScene: scene
});

export const diceFactory = {
    // Array of active dice meshes (backwards compatibility)
    dices: [],

    createDice: function (that, pos, velocity, angle, axis) {
        // Ensure factory references match current singletons
        internalFactory.physicsWorld = world;
        internalFactory.renderScene = scene;
        internalFactory.dimensions = playingField;
        internalFactory.options = options;

        let dieMaterial = that ? that.die_material : null;
        if (!dieMaterial) {
            dieMaterial = internalFactory.getFaceMaterial();
            if (that) that.die_material = dieMaterial;
        }

        const entity = internalFactory.createDice({
            pos: pos,
            velocity: velocity,
            angle: angle,
            axis: axis,
            material: dieMaterial,
            bodyMaterial: world.objects ? world.objects.dice_body_material : undefined
        });

        // The legacy code expected mesh to be in diceFactory.dices and returned
        const diceMesh = entity.mesh;
        this.dices.push(diceMesh);
        return diceMesh;
    },

    clear: function () {
        this.dices.length = 0;
        internalFactory.clear();
    }
};
