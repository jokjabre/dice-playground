import { Enclosure } from './Enclosure.js';

/**
 * Architectural placeholder / contract for a hollow spherical enclosure.
 * Dice bounce against inner sphere boundaries.
 */
export class SphereEnclosure extends Enclosure {
    /**
     * @param {Object} [options]
     * @param {number} [options.radius=500] Radius of the spherical containment
     * @param {number} [options.segments=32] Approximation resolution
     */
    constructor(options = {}) {
        super(options);
        this.radius = options.radius || 500;
        this.segments = options.segments || 32;
    }

    createPhysicsBodies(physicsWorld) {
        // Architectural hook: In Cannon.js, an inward sphere boundary can be modeled
        // via a compound shape of inverted planes/convex polyhedra or Trimesh.
        const cm = physicsWorld.contactManager;
        const sphereMat = cm.getOrCreateMaterial('sphere_boundary');
        const contact = cm.createDieContact('sphere_boundary', sphereMat);
        physicsWorld.addContactMaterial(contact);

        // Subclasses or full implementations instantiate specific inward colliders
        return this.physicsBodies;
    }

    update(dimensions) {
        if (dimensions && dimensions.scale) {
            this.radius = dimensions.scale * 3;
        }
    }
}

