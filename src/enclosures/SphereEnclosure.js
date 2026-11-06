import { Enclosure } from './Enclosure.js';

/**
 * Hollow spherical enclosure.
 * Dice bounce against the inner surface of the sphere.
 *
 * Since the bundled cannon.js build has no Trimesh/heightfield support for
 * concave colliders, the inner surface is approximated by a set of infinite
 * static Plane bodies tangent to the sphere, with their normals facing the
 * center. The intersection of these half-spaces forms a convex polyhedron
 * that tightly circumscribes the sphere, so dice are contained regardless of
 * where they hit. Increase `segments` for a tighter approximation.
 */
export class SphereEnclosure extends Enclosure {
    /**
     * @param {Object} [options]
     * @param {number} [options.radius=700] Radius of the spherical containment
     * @param {number} [options.segments=42] Number of tangent boundary planes (more = tighter approximation)
     * @param {Object} [options.center] Sphere center {x, y, z} (defaults to world origin)
     * @param {boolean} [options.showMesh=true] Whether to render a translucent sphere mesh
     * @param {number} [options.meshOpacity=0.15] Opacity of the visual sphere when shown
     */
    constructor(options = {}) {
        super(options);
        this.radius = options.radius || 700;
        this.segments = Math.max(4, options.segments || 42);
        this.center = Object.assign({ x: 0, y: 0, z: 0 }, options.center || {});
        this.showMesh = options.showMesh !== false;
        this.meshOpacity = options.meshOpacity !== undefined ? options.meshOpacity : 0.15;
    }

    /**
     * Evenly distribute `n` unit directions over the sphere using a
     * Fibonacci lattice. Good uniform coverage without clustering at poles.
     * @param {number} n
     * @returns {Array<{x:number, y:number, z:number}>}
     */
    _sphereDirections(n) {
        const dirs = [];
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < n; i++) {
            const y = 1 - (2 * (i + 0.5)) / n; // 1 .. -1
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = goldenAngle * i;
            dirs.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: y });
        }
        return dirs;
    }

    /**
     * Create and register the tangent plane bodies bounding the sphere.
     * @param {PhysicsWorld} physicsWorld
     * @returns {Array<CANNON.RigidBody>}
     */
    createPhysicsBodies(physicsWorld) {
        const cm = physicsWorld.contactManager;
        const sphereMat = cm.getOrCreateMaterial('sphere_boundary');
        const contact = cm.createDieContact('sphere_boundary', sphereMat);
        physicsWorld.addContactMaterial(contact);

        const { x: cx, y: cy, z: cz } = this.center;
        const r = this.radius;
        const zAxis = new CANNON.Vec3(0, 0, 1);
        const xAxis = new CANNON.Vec3(1, 0, 0);

        this._dirs = this._sphereDirections(this.segments);
        for (const dir of this._dirs) {
            const body = new CANNON.RigidBody(0, new CANNON.Plane(), sphereMat);

            // Plane sits on the sphere surface at the outward direction point.
            body.position.set(cx + dir.x * r, cy + dir.y * r, cz + dir.z * r);

            // Rotate the plane's +Z normal to face the sphere center (inward).
            const inward = new CANNON.Vec3(-dir.x, -dir.y, -dir.z);
            if (inward.z < -0.9999) {
                // setFromVectors degenerates for antiparallel vectors
                body.quaternion.setFromAxisAngle(xAxis, Math.PI);
            } else {
                body.quaternion.setFromVectors(zAxis, inward);
            }

            this.physicsBodies.push(body);
            physicsWorld.addBody(body);
        }

        return this.physicsBodies;
    }

    /**
     * Create an optional translucent visual sphere so the boundary is visible.
     * @param {THREE.Scene|RenderScene} renderScene
     * @returns {Array<THREE.Mesh>}
     */
    createVisualMeshes(renderScene) {
        if (!this.showMesh || typeof THREE === 'undefined') {
            return this.visualMeshes;
        }

        const geometry = new THREE.SphereGeometry(this.radius, 32, 24);
        const material = new THREE.MeshPhongMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: this.meshOpacity,
            side: THREE.BackSide,
            depthWrite: false,
            wireframe: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(this.center.x, this.center.y, this.center.z);
        mesh.userData.baseRadius = this.radius;

        this.visualMeshes.push(mesh);
        if (renderScene) {
            if (typeof renderScene.add === 'function') {
                renderScene.add(mesh);
            } else if (typeof renderScene.addObject === 'function') {
                renderScene.addObject(mesh);
            }
        }

        return this.visualMeshes;
    }

    /**
     * Update boundary scale when the container/viewport resizes.
     * Repositions the tangent planes and rescales the visual mesh to the new radius.
     * @param {Object} dimensions
     */
    update(dimensions) {
        if (dimensions && dimensions.scale) {
            // ~700 at the default 500x300 field (scale ~= 45), clamped to a sane minimum
            const newRadius = Math.max(400, dimensions.scale * 15.5);
            if (Math.abs(newRadius - this.radius) > 1) {
                this.radius = newRadius;
                this._repositionBodies();
            }
        }
        for (const mesh of this.visualMeshes) {
            const base = mesh.userData.baseRadius || this.radius;
            mesh.scale.setScalar(this.radius / base);
        }
    }

    /**
     * Move tangent plane bodies to match the current radius.
     */
    _repositionBodies() {
        if (!this._dirs) return;
        const { x: cx, y: cy, z: cz } = this.center;
        const r = this.radius;
        for (let i = 0; i < this.physicsBodies.length && i < this._dirs.length; i++) {
            const d = this._dirs[i];
            this.physicsBodies[i].position.set(cx + d.x * r, cy + d.y * r, cz + d.z * r);
        }
    }
}
