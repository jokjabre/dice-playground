/**
 * Centralized Contact and Material Manager for Cannon.js simulation.
 * Manages material definitions, friction, and restitution pairings.
 */
export class ContactManager {
    /**
     * @param {Object} [config]
     * @param {Object} [config.die_friction]
     * @param {Object} [config.die_restitution]
     */
    constructor(config = {}) {
        this.materials = new Map();
        this.contactMaterials = [];

        this.die_friction = Object.assign({
            die: 0,
            desk: 0.01,
            barrier_left: 0,
            barrier_right: 0,
            barrier_top: 0,
            barrier_bottom: 0,
            screen: 0
        }, config.die_friction || {});

        this.die_restitution = Object.assign({
            die: 0.5,
            desk: 0.5,
            barrier_left: 1.0,
            barrier_right: 1.0,
            barrier_top: 1.0,
            barrier_bottom: 1.0,
            screen: 0.5
        }, config.die_restitution || {});
    }

    /**
     * Get or create a CANNON.Material by name.
     * @param {string} name
     * @returns {CANNON.Material}
     */
    getOrCreateMaterial(name) {
        if (!this.materials.has(name)) {
            const material = new CANNON.Material(name);
            this.materials.set(name, material);
        }
        return this.materials.get(name);
    }

    /**
     * Create or update a ContactMaterial between two materials.
     * @param {CANNON.Material} matA
     * @param {CANNON.Material} matB
     * @param {Object} [options]
     * @param {number} [options.friction]
     * @param {number} [options.restitution]
     * @returns {CANNON.ContactMaterial}
     */
    createContactMaterial(matA, matB, options = {}) {
        const friction = options.friction !== undefined ? options.friction : 0;
        const restitution = options.restitution !== undefined ? options.restitution : 0.5;

        // Check if already registered
        const existing = this.contactMaterials.find(cm =>
            (cm.materials[0] === matA && cm.materials[1] === matB) ||
            (cm.materials[0] === matB && cm.materials[1] === matA)
        );

        if (existing) {
            existing.friction = friction;
            existing.restitution = restitution;
            return existing;
        }

        const contactMat = new CANNON.ContactMaterial(matA, matB, friction, restitution);
        this.contactMaterials.push(contactMat);
        return contactMat;
    }

    /**
     * Create a pair contact with the die material.
     * @param {string} name Material name (e.g., 'desk', 'barrier_left')
     * @param {CANNON.Material} [targetMaterial]
     * @returns {CANNON.ContactMaterial}
     */
    createDieContact(name, targetMaterial) {
        const dieMat = this.getOrCreateMaterial('die');
        const mat = targetMaterial || this.getOrCreateMaterial(name);
        const friction = this.die_friction[name] !== undefined ? this.die_friction[name] : 0;
        const restitution = this.die_restitution[name] !== undefined ? this.die_restitution[name] : 0.5;

        return this.createContactMaterial(mat, dieMat, { friction, restitution });
    }

    /**
     * Get friction value for a surface.
     * @param {string} name
     * @returns {number}
     */
    getFriction(name) {
        return this.die_friction[name] !== undefined ? this.die_friction[name] : 0;
    }

    /**
     * Update friction value dynamically.
     * @param {string} name
     * @param {number} value
     */
    setFriction(name, value) {
        this.die_friction[name] = value;
        const dieMat = this.materials.get('die');
        const mat = this.materials.get(name);
        if (dieMat && mat) {
            const cm = this.contactMaterials.find(c =>
                (c.materials[0] === mat && c.materials[1] === dieMat) ||
                (c.materials[0] === dieMat && c.materials[1] === mat)
            );
            if (cm) cm.friction = value;
        }
    }

    /**
     * Get restitution value for a surface.
     * @param {string} name
     * @returns {number}
     */
    getRestitution(name) {
        return this.die_restitution[name] !== undefined ? this.die_restitution[name] : 0.5;
    }

    /**
     * Update restitution value dynamically.
     * @param {string} name
     * @param {number} value
     */
    setRestitution(name, value) {
        this.die_restitution[name] = value;
        const dieMat = this.materials.get('die');
        const mat = this.materials.get(name);
        if (dieMat && mat) {
            const cm = this.contactMaterials.find(c =>
                (c.materials[0] === mat && c.materials[1] === dieMat) ||
                (c.materials[0] === dieMat && c.materials[1] === mat)
            );
            if (cm) cm.restitution = value;
        }
    }
}

