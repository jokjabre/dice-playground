/**
 * Synchronizer copying Cannon.js rigid body position and quaternion to Three.js meshes.
 */
export class MeshBodySync {
    /**
     * Synchronize a single mesh with its attached body.
     * @param {THREE.Mesh} mesh Mesh with .body property
     */
    static syncOne(mesh) {
        if (!mesh || !mesh.body) return;
        mesh.position.copy(mesh.body.position);
        mesh.quaternion.copy(mesh.body.quaternion);
    }

    /**
     * Synchronize all mesh children in a Three.js scene that have an attached Cannon body.
     * @param {THREE.Scene} scene
     */
    static syncScene(scene) {
        if (!scene || !scene.children) return;
        const children = scene.children;
        for (let i = 0; i < children.length; ++i) {
            const child = children[i];
            if (child && child.body !== undefined) {
                child.position.copy(child.body.position);
                child.quaternion.copy(child.body.quaternion);
            }
        }
    }

    /**
     * Synchronize a specific list of meshes/entities with rigid bodies.
     * @param {Array<THREE.Mesh|Object>} items
     */
    static syncList(items) {
        if (!items) return;
        for (let i = 0; i < items.length; ++i) {
            const item = items[i];
            if (item) {
                if (item.mesh && item.body) {
                    item.mesh.position.copy(item.body.position);
                    item.mesh.quaternion.copy(item.body.quaternion);
                } else if (item.body) {
                    item.position.copy(item.body.position);
                    item.quaternion.copy(item.body.quaternion);
                }
            }
        }
    }
}

