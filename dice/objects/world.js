import { physics } from "./physics.js";
import { dimensions, playingField } from "../../src/config/dimensions.js";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld.js";
import { ContactManager } from "../../src/physics/ContactManager.js";
import { BoxEnclosure } from "../../src/enclosures/BoxEnclosure.js";
import { SphereEnclosure } from "../../src/enclosures/SphereEnclosure.js";
import { CylinderEnclosure } from "../../src/enclosures/CylinderEnclosure.js";


/**
 * Modular Physics World singleton wrapper.
 * Backwards compatible with legacy diceFactory and scene references,
 * powered internally by PhysicsWorld, ContactManager, and BoxEnclosure.
 */
const contactManager = new ContactManager({
    die_friction: physics.die_friction,
    die_restitution: physics.die_restitution
});

export const physicsWorld = new PhysicsWorld({
    gravity: physics.world_gravity,
    iterations: 20,
    contactManager: contactManager
});

export const boxEnclosure = new BoxEnclosure();

export const world = {
    // Underlying CANNON.World instance
    get instance() {
        return physicsWorld.instance;
    },

    physicsWorld: physicsWorld,
    enclosure: boxEnclosure,

    add: function (item) {
        physicsWorld.addBody(item);
    },

    remove: function (item) {
        physicsWorld.removeBody(item);
    },

    setGravity: function (x, y, z) {
        physicsWorld.setGravity(x, y, z);
    },

    getGravity: function () {
        return physicsWorld.getGravity();
    },

    initiate: function () {
        // Apply gravity
        physicsWorld.setGravity(physics.world_gravity.x, physics.world_gravity.y, physics.world_gravity.z);

        // Build enclosure bodies
        boxEnclosure.destroy(physicsWorld);
        boxEnclosure.createPhysicsBodies(physicsWorld);
        boxEnclosure.update(playingField.dimensions);

        // Expose materials and bodies for legacy scene/diceFactory references
        this.objects.die_material = contactManager.getOrCreateMaterial('die');
        this.objects.dice_body_material = this.objects.die_material;
        this.objects.desk_material = boxEnclosure.materials.desk;
        this.objects.barrier_left_material = boxEnclosure.materials.barrier_left;
        this.objects.barrier_right_material = boxEnclosure.materials.barrier_right;
        this.objects.barrier_top_material = boxEnclosure.materials.barrier_top;
        this.objects.barrier_bottom_material = boxEnclosure.materials.barrier_bottom;

        this.objects.desk_body = boxEnclosure.bodies.desk;
        this.objects.screen_body = boxEnclosure.bodies.screen;
        this.objects.barrier_left_body = boxEnclosure.bodies.barrier_left;
        this.objects.barrier_right_body = boxEnclosure.bodies.barrier_right;
        this.objects.barrier_top_body = boxEnclosure.bodies.barrier_top;
        this.objects.barrier_bottom_body = boxEnclosure.bodies.barrier_bottom;
    },

    updateDimensions: function () {
        boxEnclosure.update(playingField.dimensions);
    },

    // Legacy objects property for backwards compatibility with diceFactory & scene.js
    objects: {
        die_material: null,
        dice_body_material: null,
        desk_material: null,
        barrier_left_material: null,
        barrier_right_material: null,
        barrier_top_material: null,
        barrier_bottom_material: null,

        desk_body: undefined,
        screen_body: undefined,
        barrier_left_body: undefined,
        barrier_right_body: undefined,
        barrier_top_body: undefined,
        barrier_bottom_body: undefined
    }
};
