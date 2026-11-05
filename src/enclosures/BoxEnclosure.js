import { Enclosure } from './Enclosure.js';

/**
 * Concrete BoxEnclosure representing rectangular playing field with desk floor,
 * 4 barrier walls (left, right, top, bottom), and optional ceiling / screen barrier.
 */
export class BoxEnclosure extends Enclosure {
    /**
     * @param {Object} [options]
     * @param {number} [options.boundaryMargin=0.93] Margin factor applied to scene dimensions
     * @param {number} [options.screenHeight=2700] Z position of top screen/ceiling boundary
     * @param {boolean} [options.hasCeiling=true] Whether to include the screen/ceiling barrier
     */
    constructor(options = {}) {
        super(options);
        this.boundaryMargin = options.boundaryMargin !== undefined ? options.boundaryMargin : 0.93;
        this.screenHeight = options.screenHeight !== undefined ? options.screenHeight : 2700;
        this.hasCeiling = options.hasCeiling !== undefined ? options.hasCeiling : true;

        this.bodies = {
            desk: null,
            screen: null,
            barrier_left: null,
            barrier_right: null,
            barrier_top: null,
            barrier_bottom: null
        };

        this.materials = {
            desk: null,
            screen: null,
            barrier_left: null,
            barrier_right: null,
            barrier_top: null,
            barrier_bottom: null
        };
    }

    /**
     * Create physics bodies and contacts for desk, walls, and ceiling.
     * @param {PhysicsWorld} physicsWorld
     * @returns {Array<CANNON.RigidBody>}
     */
    createPhysicsBodies(physicsWorld) {
        const cm = physicsWorld.contactManager;

        // Material names to create
        const names = ['desk', 'screen', 'barrier_left', 'barrier_right', 'barrier_top', 'barrier_bottom'];

        names.forEach(name => {
            if (name === 'screen' && !this.hasCeiling) return;

            const mat = cm.getOrCreateMaterial(name);
            this.materials[name] = mat;

            // Register contact with die
            const contact = cm.createDieContact(name, mat);
            physicsWorld.addContactMaterial(contact);

            // Create plane rigid body
            const body = new CANNON.RigidBody(0, new CANNON.Plane(), mat);
            this.bodies[name] = body;
            this.physicsBodies.push(body);
        });

        // Set barrier orientations
        // Top barrier: rotated around X by +PI/2
        this.bodies.barrier_top.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

        // Bottom barrier: rotated around X by -PI/2
        this.bodies.barrier_bottom.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

        // Right barrier: rotated around Y by -PI/2
        this.bodies.barrier_right.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);

        // Left barrier: rotated around Y by +PI/2
        this.bodies.barrier_left.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);

        // Screen/ceiling barrier: rotated around Y by PI
        if (this.bodies.screen) {
            this.bodies.screen.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
        }

        // Add bodies to physics world
        for (const body of this.physicsBodies) {
            physicsWorld.addBody(body);
        }

        return this.physicsBodies;
    }

    /**
     * Position barrier bodies according to current dimensions.
     * @param {Object} dimensions
     * @param {number} dimensions.scene_width
     * @param {number} dimensions.scene_height
     */
    update(dimensions) {
        if (!dimensions) return;

        const w = dimensions.scene_width;
        const h = dimensions.scene_height;
        const m = this.boundaryMargin;

        if (this.bodies.barrier_top) {
            this.bodies.barrier_top.position.set(0, h * m, 0);
        }
        if (this.bodies.barrier_bottom) {
            this.bodies.barrier_bottom.position.set(0, -h * m, 0);
        }
        if (this.bodies.barrier_right) {
            this.bodies.barrier_right.position.set(w * m, 0, 0);
        }
        if (this.bodies.barrier_left) {
            this.bodies.barrier_left.position.set(-w * m, 0, 0);
        }
        if (this.bodies.screen) {
            this.bodies.screen.position.set(w, h, this.screenHeight);
        }
    }
}

