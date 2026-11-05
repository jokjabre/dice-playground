import { Enclosure } from './Enclosure.js';

/**
 * Architectural placeholder / contract for a cylindrical enclosure (e.g. drinking water glass or cup).
 * Dice bounce inside the cylinder walls and against the flat circular base.
 */
export class CylinderEnclosure extends Enclosure {
    /**
     * @param {Object} [options]
     * @param {number} [options.radius=300] Cylinder radius
     * @param {number} [options.height=800] Cylinder height
     * @param {number} [options.segments=16] Number of perimeter boundary facets
     */
    constructor(options = {}) {
        super(options);
        this.radius = options.radius || 300;
        this.height = options.height || 800;
        this.segments = options.segments || 16;
    }

    createPhysicsBodies(physicsWorld) {
        // Architectural hook: cylinder wall facets arranged in a regular polygon prism
        // plus bottom plane cap.
        const cm = physicsWorld.contactManager;
        const glassMat = cm.getOrCreateMaterial('glass_boundary');
        const contact = cm.createDieContact('glass_boundary', glassMat);
        physicsWorld.addContactMaterial(contact);

        return this.physicsBodies;
    }

    update(dimensions) {
        if (dimensions && dimensions.scene_width) {
            this.radius = dimensions.scene_width * 0.4;
            this.height = dimensions.wall_height || 800;
        }
    }
}

