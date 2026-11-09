/**
 * DiceEntity
 * Represents a single die instance, coupling its Three.js visual mesh,
 * Cannon.js rigid body, resting/stopped state tracking, and current value.
 */

export class DiceEntity {
    /**
     * @param {THREE.Mesh} mesh - The Three.js mesh.
     * @param {CANNON.RigidBody} body - The Cannon.js rigid body.
     */
    constructor(mesh, body) {
        this.mesh = mesh;
        this.body = body;
        
        // Ensure circular reference for easy traversal in sync and raycast routines
        this.mesh.body = body;
        this.body.mesh = mesh;

        // Custom property used by physics settle detection
        this.dice_stopped = undefined;
    }

    /**
     * Current position vector from rigid body (or mesh if detached).
     */
    get position() {
        return this.body ? this.body.position : this.mesh.position;
    }

    /**
     * Current linear velocity vector.
     */
    get velocity() {
        return this.body ? this.body.velocity : null;
    }

    /**
     * Current angular velocity vector.
     */
    get angularVelocity() {
        return this.body ? this.body.angularVelocity : null;
    }

    /**
     * Resting / stopped state.
     */
    get isStopped() {
        return this.dice_stopped === true;
    }

    set isStopped(val) {
        this.dice_stopped = val;
    }

    /**
     * Synchronizes the visual mesh position and orientation with the Cannon.js physics body.
     */
    syncMesh() {
        if (!this.mesh || !this.body) return;
        this.mesh.position.copy(this.body.position);
        this.mesh.quaternion.copy(this.body.quaternion);
    }

    /**
     * Resets or sets the dynamic state (position, velocity, angle, axis) of this die.
     * @param {Object} pos - {x, y, z}
     * @param {Object} velocity - {x, y, z}
     * @param {Object} angle - {x, y, z}
     * @param {Object} axis - {x, y, z, a}
     */
    resetTransform(pos, velocity, angle, axis) {
        if (pos) {
            this.body.position.set(pos.x, pos.y, pos.z);
        }
        if (axis) {
            this.body.quaternion.setFromAxisAngle(
                new CANNON.Vec3(axis.x, axis.y, axis.z),
                (axis.a !== undefined ? axis.a : 1.0) * Math.PI * 2
            );
        }
        if (angle) {
            this.body.angularVelocity.set(angle.x, angle.y, angle.z);
        }
        if (velocity) {
            this.body.velocity.set(velocity.x, velocity.y, velocity.z);
        }
        this.dice_stopped = undefined;
        this.syncMesh();
    }
}

