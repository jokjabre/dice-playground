import { Enclosure } from './Enclosure.js';
import { computeSphereRadius, computeDieRadius } from '../config/enclosureScale.js';

/**
 * Hollow spherical enclosure.
 * Dice bounce against the inner surface of the sphere.
 *
 * Since the bundled cannon.js build has no Trimesh/heightfield support for
 * concave colliders, the inner surface is approximated by a set of infinite
 * static Plane bodies with their normals facing the center. The planes are
 * positioned so the resulting polyhedron is INSCRIBED inside the visual
 * sphere (die surface ends flush with the wireframe). Increase `segments`
 * for a tighter approximation. A hard post-step containment clamp is a
 * backstop for very high die speeds.
 *
 * Size is derived from the playing field dimensions (computeSphereRadius),
 * applied identically to physics, containment, and visuals.
 */
export class SphereEnclosure extends Enclosure {
    /**
     * @param {Object} [options]
     * @param {number} [options.radius=700] Radius of the spherical containment (visual sphere)
     * @param {number} [options.segments=128] Number of tangent boundary planes (more = tighter approximation)
     * @param {Object} [options.center] Sphere center {x, y, z} (defaults to world origin)
     * @param {boolean} [options.showMesh=true] Whether to render a translucent sphere mesh
     * @param {number} [options.meshOpacity=0.15] Opacity of the visual sphere when shown
     */
    constructor(options = {}) {
        super(options);
        // Radius is fixed and single-sourced: both the physics planes and the
        // visual meshes derive from it, so they can never diverge.
        this.radius = options.radius || 700;
        this.segments = Math.max(20, options.segments || 128);
        this.center = Object.assign({ x: 0, y: 0, z: 0 }, options.center || {});
        this.showMesh = options.showMesh !== false;
        this.meshOpacity = options.meshOpacity !== undefined ? options.meshOpacity : 0.10;
        this.dieRadius = options.dieRadius !== undefined ? options.dieRadius : 40;
    }

    /**
     * Measure the covering radius of the plane lattice: the smallest
     * cosine of the angle between any surface direction and the closest
     * plane normal. Used to inscribe the polyhedron in the visual sphere.
     * @param {Array<{x:number, y:number, z:number}>} dirs
     * @returns {number} cos(coveringRadius), with a small safety margin
     */
    _measureCoverage(dirs) {
        const samples = this._sphereDirections(1200);
        let minCos = 1;
        for (const s of samples) {
            let m = -1;
            for (const u of dirs) {
                const d = s.x * u.x + s.y * u.y + s.z * u.z;
                if (d > m) m = d;
            }
            if (m < minCos) minCos = m;
        }
        // Clamp into a sane range; dense lattices get within a few units of the sphere
        return Math.max(0.8, Math.min(0.999, minCos));
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

        // Hard containment backstop: the infinite one-sided planes are the
        // primary bounce surface, but at very high die speeds this cannon.js
        // build loses resolution. Clamp dynamic bodies inside the sphere and
        // reflect their radial velocity every step so dice can never escape.
        const center = this.center;
        this._containBodies = (bodies) => {
            const maxR = Math.max(10, this.radius - this.dieRadius - 2);
            const maxRSq = maxR * maxR;
            for (const body of bodies) {
                if (!body || body.mass === 0 || !body.position) continue;
                const dx = body.position.x - center.x;
                const dy = body.position.y - center.y;
                const dz = body.position.z - center.z;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > maxRSq && distSq > 0) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist, ny = dy / dist, nz = dz / dist;
                    // Pull the die back inside the boundary
                    body.position.set(
                        center.x + nx * maxR,
                        center.y + ny * maxR,
                        center.z + nz * maxR
                    );
                    // Reflect outward radial velocity (restitution 0.6)
                    const vel = body.velocity;
                    const vr = vel.x * nx + vel.y * ny + vel.z * nz;
                    if (vr > 0) {
                        const e = 0.6;
                        vel.x -= (1 + e) * vr * nx;
                        vel.y -= (1 + e) * vr * ny;
                        vel.z -= (1 + e) * vr * nz;
                    }
                }
            }
        };
        if (physicsWorld.postStepCallbacks) {
            physicsWorld.postStepCallbacks.push(this._containBodies);
        }

        const { x: cx, y: cy, z: cz } = this.center;
        // Measure the lattice covering radius: the largest angle from any
        // direction to the nearest plane normal. Planes are pushed in by
        // cos(coveringRadius) so their polyhedron stays strictly INSCRIBED
        // inside the visual sphere instead of bulging out past the wireframe.
        this._dirs = this._sphereDirections(this.segments);
        this._cosCover = this._measureCoverage(this._dirs);
        this._updatePlaneDistance();
        const r = this._planeDistance;
        const zAxis = new CANNON.Vec3(0, 0, 1);
        const xAxis = new CANNON.Vec3(1, 0, 0);

        for (const dir of this._dirs) {
            const body = new CANNON.RigidBody(0, new CANNON.Plane(), sphereMat);

            // Plane sits on the inscribed polyhedron at the outward direction point.
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
            side: THREE.DoubleSide,
            depthWrite: false,
            wireframe: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(this.center.x, this.center.y, this.center.z);
        mesh.userData.baseRadius = this.radius;

        this.visualMeshes.push(mesh);

        // Faint outline so the full boundary reads clearly from any angle
        const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(new THREE.SphereGeometry(this.radius, 16, 12)),
            new THREE.LineBasicMaterial({
                color: 0x2f6f9f,
                transparent: true,
                opacity: 0.45
            })
        );
        wireframe.position.copy(mesh.position);
        wireframe.userData.baseRadius = this.radius;
        this.visualMeshes.push(wireframe);

        if (renderScene) {
            for (const item of this.visualMeshes) {
                if (typeof renderScene.add === 'function') {
                    renderScene.add(item);
                } else if (typeof renderScene.addObject === 'function') {
                    renderScene.addObject(item);
                }
            }
        }

        return this.visualMeshes;
    }

    /**
     * Tear down: unregister the containment callback, then remove bodies/meshes.
     * @param {PhysicsWorld} physicsWorld
     * @param {THREE.Scene|RenderScene} [renderScene]
     */
    destroy(physicsWorld, renderScene) {
        if (physicsWorld && this._containBodies && physicsWorld.postStepCallbacks) {
            const idx = physicsWorld.postStepCallbacks.indexOf(this._containBodies);
            if (idx !== -1) {
                physicsWorld.postStepCallbacks.splice(idx, 1);
            }
        }
        this._containBodies = null;
        super.destroy(physicsWorld, renderScene);
    }

    /**
     * Update boundary scale when the container/viewport resizes.
     * Recomputes radius from the same sizing used at activation, repositions
     * the tangent planes, the containment clamp, and rescales the visuals.
     * @param {Object} dimensions
     */
    update(dimensions) {
        if (dimensions && (dimensions.scene_width || dimensions.scale)) {
            const newRadius = computeSphereRadius(dimensions);
            const newDieRadius = computeDieRadius(dimensions);
            if (Math.abs(newRadius - this.radius) > 1 || Math.abs(newDieRadius - this.dieRadius) > 1) {
                this.radius = newRadius;
                this.dieRadius = newDieRadius;
                this._updatePlaneDistance();
                this._repositionBodies();
            }
        }
        for (const mesh of this.visualMeshes) {
            const base = mesh.userData.baseRadius || this.radius;
            mesh.scale.setScalar(this.radius / base);
        }
    }

    /**
     * Move tangent plane bodies to match the current plane distance.
     */
    _repositionBodies() {
        if (!this._dirs) return;
        this._updatePlaneDistance();
        const { x: cx, y: cy, z: cz } = this.center;
        const r = this._planeDistance;
        for (let i = 0; i < this.physicsBodies.length && i < this._dirs.length; i++) {
            const d = this._dirs[i];
            this.physicsBodies[i].position.set(cx + d.x * r, cy + d.y * r, cz + d.z * r);
        }
    }

    /**
     * Recompute the plane distance so a die (vertex radius dieRadius)
     * resting against a plane has its surface flush with the visual sphere.
     */
    _updatePlaneDistance() {
        const inner = Math.max(10, this.radius - this.dieRadius);
        this._planeDistance = inner * (this._cosCover || 1);
    }


}
