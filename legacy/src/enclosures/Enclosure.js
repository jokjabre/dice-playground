/**
 * Abstract base class / interface for enclosures.
 * Enclosures define the physics boundaries (walls, floor, barriers) and optional visual meshes.
 */
export class Enclosure {
    /**
     * @param {Object} [options]
     */
    constructor(options = {}) {
        this.options = options;
        this.physicsBodies = [];
        this.visualMeshes = [];
    }

    /**
     * Create and register physics bodies for this enclosure.
     * @param {PhysicsWorld} physicsWorld
     * @returns {Array<CANNON.RigidBody>}
     */
    createPhysicsBodies(physicsWorld) {
        throw new Error('Enclosure.createPhysicsBodies() must be implemented by subclass');
    }

    /**
     * Create optional Three.js meshes representing walls, floor, or container.
     * @param {THREE.Scene|Object} renderScene
     * @returns {Array<THREE.Mesh>}
     */
    createVisualMeshes(renderScene) {
        return [];
    }

    /**
     * Update boundary dimensions or scale when container/viewport resizes.
     * @param {Object} dimensions
     */
    update(dimensions) {
        // Optional override
    }

    /**
     * Cleanly tear down and remove physics bodies and visual meshes.
     * @param {PhysicsWorld} physicsWorld
     * @param {THREE.Scene|Object} [renderScene]
     */
    destroy(physicsWorld, renderScene) {
        if (physicsWorld) {
            for (const body of this.physicsBodies) {
                physicsWorld.removeBody(body);
            }
        }
        this.physicsBodies = [];

        if (renderScene) {
            for (const mesh of this.visualMeshes) {
                if (typeof renderScene.remove === 'function') {
                    renderScene.remove(mesh);
                }
            }
        }
        this.visualMeshes = [];
    }
}

