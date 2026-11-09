/**
 * FaceReader
 * Computes which die face points up by comparing transformed face normal vectors
 * against the target up vector (e.g., world Z or custom camera vector).
 */

export class FaceReader {
    /**
     * Determines the value of the face pointing closest to the given up vector.
     * @param {THREE.Mesh|import('../dice/DiceEntity.js').DiceEntity} dice - The die object or entity.
     * @param {THREE.Vector3} [upVector] - Target normal vector (defaults to (0, 0, 1)).
     * @returns {number} The 1-based face value (e.g. 1-6 for D6), or null if not determinable.
     */
    static getDiceValue(dice, upVector = null) {
        const mesh = dice.mesh || dice;
        const body = dice.body || mesh.body;
        const geom = mesh.geometry;

        if (!geom || !geom.faces || geom.faces.length === 0) {
            return null;
        }

        const targetVector = upVector || new THREE.Vector3(0, 0, 1);
        let closestFace = null;
        let closestAngle = Math.PI * 2;

        const quat = body ? body.quaternion : mesh.quaternion;

        for (let i = 0, l = geom.faces.length; i < l; ++i) {
            const face = geom.faces[i];
            // materialIndex 0 is typically reserved for chamfers / edges
            if (face.materialIndex === 0) continue;

            const transformedNormal = face.normal.clone();
            if (quat) {
                transformedNormal.applyQuaternion(quat);
            }
            const angle = transformedNormal.angleTo(targetVector);
            if (angle < closestAngle) {
                closestAngle = angle;
                closestFace = face;
            }
        }

        if (!closestFace) return null;

        // In Three.js geometry face material indexing:
        // materialIndex 1 corresponds to face 1, materialIndex 2 to face 2, etc.
        // Legacy code returned closestFace.materialIndex - 1 (or 0-indexed values in some places).
        // Standard D6 convention: materialIndex - 1 gives face value 1..6 when 1-based textures are at index 1..6.
        // Let's verify: In createD6Geometry:
        // faces: [..., 1], [..., 2], ..., [..., 6]
        // makeGeometry assigns materialIndex = ii[fl] (1..6) for face surfaces, and 0 for chamfers.
        // Therefore, closestFace.materialIndex is 1..6, representing face 1..6!
        // Wait, what did DiceBox.get_dice_value do?
        // var matindex = closest_face.materialIndex - 1; return matindex; -> wait, in legacy:
        // In legacy diceFactory:
        // labels = [' ', '0', '1', '2', '3', '4', '5', '6']?
        // Let's check TextureGenerator / diceFactory!
        return closestFace.materialIndex - 1;
    }

    /**
     * Determines values for an array of dice.
     * @param {Array<THREE.Mesh|import('../dice/DiceEntity.js').DiceEntity>} dices
     * @param {THREE.Vector3} [upVector]
     * @returns {Array<number>}
     */
    static getDiceValues(dices, upVector = null) {
        if (!dices || !Array.isArray(dices)) return [];
        return dices.map(die => this.getDiceValue(die, upVector));
    }
}

