import { physics } from "./physics.js";
import { dimensions, playingField } from "../../src/config/dimensions.js";
import { PhysicsWorld } from "../../src/physics/PhysicsWorld.js";
import { ContactManager } from "../../src/physics/ContactManager.js";
import { BoxEnclosure } from "../../src/enclosures/BoxEnclosure.js";
import { SphereEnclosure } from "../../src/enclosures/SphereEnclosure.js";
import { CylinderEnclosure } from "../../src/enclosures/CylinderEnclosure.js";
import { renderScene } from "./scene.js";
import { spawnProfile } from "../../src/config/spawnProfile.js";
import { computeSphereRadius, computeDieRadius, computeCylinderSize } from "../../src/config/enclosureScale.js";


/**
 * Modular Physics World singleton wrapper.
 * Backwards compatible with legacy diceFactory and scene references,
 * powered internally by PhysicsWorld, ContactManager, and selectable Enclosures.
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

let currentEnclosure = boxEnclosure;
let currentEnclosureType = 'box';

/**
 * Factory map for selectable enclosure types.
 * Sizes are derived from the current playing field so physics and visuals
 * are born consistent with each other.
 */
const dimsNow = () => playingField.dimensions;
const enclosureFactories = {
    box: () => new BoxEnclosure(),
    sphere: () => {
        const d = dimsNow();
        return new SphereEnclosure({
            radius: computeSphereRadius(d),
            dieRadius: computeDieRadius(d),
            segments: 128
        });
    },
    cylinder: () => {
        const size = computeCylinderSize(dimsNow());
        return new CylinderEnclosure({ radius: size.radius, height: size.height, segments: 24 });
    }
};

/**
 * Tear down the active enclosure and activate a new one of the given type.
 * @param {'box'|'sphere'|'cylinder'} type
 * @returns {boolean} true if the enclosure was switched
 */
function activateEnclosure(type) {
    const factory = enclosureFactories[type];
    if (!factory) return false;

    currentEnclosure.destroy(physicsWorld, renderScene);

    // Flat desk plane only makes sense for the box enclosure
    if (renderScene.desk) {
        renderScene.desk.visible = (type === 'box');
    }
    spawnProfile.mode = type;

    const enclosure = factory();
    enclosure.createPhysicsBodies(physicsWorld);
    if (typeof enclosure.createVisualMeshes === 'function') {
        try {
            enclosure.createVisualMeshes(renderScene);
        } catch (err) {
            console.warn('Enclosure visual mesh creation failed:', err);
        }
    }
    enclosure.update(playingField.dimensions);

    currentEnclosure = enclosure;
    currentEnclosureType = type;
    world.enclosure = enclosure;
    // Keep enclosed-mode spawn distances proportionate to the current size
    spawnProfile.radius = (typeof enclosure.radius === 'number') ? enclosure.radius : 700;

    // Die material is needed regardless of enclosure type
    world.objects.die_material = contactManager.getOrCreateMaterial('die');
    world.objects.dice_body_material = world.objects.die_material;

    // Expose materials and bodies for legacy scene/diceFactory references (box only)
    if (type === 'box' && enclosure.materials && enclosure.bodies) {
        world.objects.desk_material = enclosure.materials.desk;
        world.objects.barrier_left_material = enclosure.materials.barrier_left;
        world.objects.barrier_right_material = enclosure.materials.barrier_right;
        world.objects.barrier_top_material = enclosure.materials.barrier_top;
        world.objects.barrier_bottom_material = enclosure.materials.barrier_bottom;

        world.objects.desk_body = enclosure.bodies.desk;
        world.objects.screen_body = enclosure.bodies.screen;
        world.objects.barrier_left_body = enclosure.bodies.barrier_left;
        world.objects.barrier_right_body = enclosure.bodies.barrier_right;
        world.objects.barrier_top_body = enclosure.bodies.barrier_top;
        world.objects.barrier_bottom_body = enclosure.bodies.barrier_bottom;
    } else if (type !== 'box') {
        // Clear stale box references so nothing uses removed bodies
        world.objects.desk_material = null;
        world.objects.barrier_left_material = null;
        world.objects.barrier_right_material = null;
        world.objects.barrier_top_material = null;
        world.objects.barrier_bottom_material = null;
        world.objects.desk_body = undefined;
        world.objects.screen_body = undefined;
        world.objects.barrier_left_body = undefined;
        world.objects.barrier_right_body = undefined;
        world.objects.barrier_top_body = undefined;
        world.objects.barrier_bottom_body = undefined;
    }

    return true;
}

export const world = {
    // Underlying CANNON.World instance
    get instance() {
        return physicsWorld.instance;
    },

    physicsWorld: physicsWorld,
    enclosure: currentEnclosure,

    get enclosureType() {
        return currentEnclosureType;
    },

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

        // Rebuild the active enclosure bodies
        activateEnclosure(currentEnclosureType);
    },

    /**
     * Switch the active enclosure type and rebuild its physics bodies/meshes.
     * @param {'box'|'sphere'|'cylinder'} type
     */
    setEnclosure: function (type) {
        return activateEnclosure(type);
    },

    updateDimensions: function () {
        currentEnclosure.update(playingField.dimensions);
        spawnProfile.radius = (typeof currentEnclosure.radius === 'number') ? currentEnclosure.radius : 700;
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
