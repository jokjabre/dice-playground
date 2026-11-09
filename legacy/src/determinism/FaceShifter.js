/**
 * FaceShifter
 * Remaps materialIndex on geometry faces so the die displays a predetermined target number.
 * Fixes the legacy bug where shift_dice_faces had an incorrect function scope.
 */

export class FaceShifter {
    /**
     * Shifts the face textures / material indices of a die so that the desired value
     * appears on the face that naturally lands on top.
     * 
     * @param {THREE.Mesh|import('../dice/DiceEntity.js').DiceEntity} dice - Die mesh or DiceEntity.
     * @param {number} value - Target predetermined outcome value (1..6 for standard D6).
     * @param {number} res - The simulated natural outcome value that lands facing up.
     * @param {Array<number>} [range=[1, 6]] - Valid face value range [min, max].
     */
    static shiftDiceFaces(dice, value, res, range = [1, 6]) {
        const mesh = dice.mesh || dice;
        if (!mesh || !mesh.geometry) return;

        const [minVal, maxVal] = range;
        if (typeof value !== 'number' || value < minVal || value > maxVal) {
            return;
        }

        const num = value - res;
        if (num === 0) return; // No shift needed

        const geom = mesh.geometry.clone();
        for (let i = 0, l = geom.faces.length; i < l; ++i) {
            let matindex = geom.faces[i].materialIndex;
            // Index 0 is reserved for edge/chamfer material, never shift it
            if (matindex === 0) continue;

            matindex += num - 1;
            while (matindex > maxVal) matindex -= maxVal;
            while (matindex < minVal) matindex += maxVal;
            geom.faces[i].materialIndex = matindex + 1;
        }

        geom.elementsNeedUpdate = true;
        mesh.geometry = geom;
    }
}

