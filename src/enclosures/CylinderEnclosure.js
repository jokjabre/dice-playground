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

    /**
     * Create a faint wireframe of the cup wall and base ring.
     * @param {THREE.Scene|RenderScene} renderScene
     * @returns {Array<THREE.LineSegments|THREE.LineLoop>}
     */
    createVisualMeshes(renderScene) {
        if (typeof THREE === 'undefined') {
            return this.visualMeshes;
        }

        // Wall: open-ended cylinder rotated so its axis lies along Z
        const wallGeometry = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 24, 1, true);
        const wallMaterial = new THREE.LineBasicMaterial({
            color: 0xffd9a0,
            transparent: true,
            opacity: 0.35
        });
        const wall = new THREE.LineSegments(new THREE.WireframeGeometry(wallGeometry), wallMaterial);
        wall.rotation.x = Math.PI / 2;
        wall.position.set(0, 0, this.height / 2);
        wall.userData.baseHeight = this.height;
        wall.userData.baseRadius = this.radius;
        this.visualMeshes.push(wall);

        // Base ring at z = 0
        const circlePoints = [];
        for (let i = 0; i <= 48; i++) {
            const theta = (i / 48) * Math.PI * 2;
            circlePoints.push(new THREE.Vector3(Math.cos(theta) * this.radius, Math.sin(theta) * this.radius, 0));
        }
        const base = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(circlePoints),
            new THREE.LineBasicMaterial({
                color: 0xffd9a0,
                transparent: true,
                opacity: 0.6
            })
        );
        base.userData.baseRadius = this.radius;
        this.visualMeshes.push(base);

        if (renderScene && typeof renderScene.add === 'function') {
            for (const item of this.visualMeshes) {
                renderScene.add(item);
            }
        }

        return this.visualMeshes;
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
        for (const mesh of this.visualMeshes) {
            const baseRadius = mesh.userData.baseRadius || this.radius;
            const rScale = this.radius / baseRadius;
            if (mesh.userData.baseHeight !== undefined) {
                // Wall cylinder is rotated: local Y maps to world Z (height axis)
                mesh.scale.set(rScale, this.height / mesh.userData.baseHeight, rScale);
                mesh.position.z = this.height / 2;
            } else {
                // Base ring lies in the world XY plane
                mesh.scale.set(rScale, rScale, 1);
            }
        }
    }
}

