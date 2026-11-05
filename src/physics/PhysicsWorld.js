import { ContactManager } from './ContactManager.js';

/**
 * Encapsulates CANNON.World with dynamic gravity, body lifecycle, and contact management.
 */
export class PhysicsWorld {
    /**
     * @param {Object} [config]
     * @param {Object} [config.gravity] {x, y, z}
     * @param {number} [config.iterations=20]
     * @param {ContactManager} [config.contactManager]
     */
    constructor(config = {}) {
        this.world = new CANNON.World();
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = config.iterations || 20;

        const gx = (config.gravity && config.gravity.x !== undefined) ? config.gravity.x : 0;
        const gy = (config.gravity && config.gravity.y !== undefined) ? config.gravity.y : 0;
        const gz = (config.gravity && config.gravity.z !== undefined) ? config.gravity.z : -9.8 * 300;

        this.setGravity(gx, gy, gz);

        this.contactManager = config.contactManager || new ContactManager();
        this.bodies = [];
    }

    /**
     * Set gravity vector dynamically.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setGravity(x, y, z) {
        this.world.gravity.set(x, y, z);
    }

    /**
     * Get current gravity vector.
     * @returns {CANNON.Vec3}
     */
    getGravity() {
        return this.world.gravity;
    }

    /**
     * Step the physics world.
     * @param {number} dt Delta time in seconds
     */
    step(dt) {
        this.world.step(dt);
    }

    /**
     * Add rigid body to world.
     * @param {CANNON.RigidBody} body
     */
    addBody(body) {
        if (!body) return;
        this.world.add(body);
        if (!this.bodies.includes(body)) {
            this.bodies.push(body);
        }
    }

    /**
     * Remove rigid body from world.
     * @param {CANNON.RigidBody} body
     */
    removeBody(body) {
        if (!body) return;
        this.world.remove(body);
        const idx = this.bodies.indexOf(body);
        if (idx !== -1) {
            this.bodies.splice(idx, 1);
        }
    }

    /**
     * Add contact material.
     * @param {CANNON.ContactMaterial} contactMaterial
     */
    addContactMaterial(contactMaterial) {
        if (contactMaterial) {
            this.world.addContactMaterial(contactMaterial);
        }
    }

    /**
     * Clear all bodies from world.
     */
    clearBodies() {
        const bodiesCopy = [...this.bodies];
        for (const body of bodiesCopy) {
            this.removeBody(body);
        }
    }

    /**
     * Get underlying CANNON.World instance for backwards compatibility.
     * @returns {CANNON.World}
     */
    get instance() {
        return this.world;
    }
}

