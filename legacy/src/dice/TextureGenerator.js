/**
 * TextureGenerator
 * Dynamic canvas texture generation for face numbers with custom colors, fonts, and dot markers.
 */

import { GeometryBuilder } from "./GeometryBuilder.js";

export class TextureGenerator {
    /**
     * Creates a Three.js Texture with a drawn label text.
     * @param {string|number} text - Face text or number to draw.
     * @param {Object} [options={}] - Styling configuration.
     * @param {string} [options.color='#000000'] - Font fill color.
     * @param {string} [options.backColor='#ffffff'] - Background canvas fill color.
     * @param {number} [options.size=100] - Base font reference size.
     * @param {number} [options.margin=1.0] - Margin multiplier.
     * @param {string} [options.fontFamily='Arial'] - Font family.
     * @returns {THREE.Texture|null}
     */
    static createTextTexture(text, options = {}) {
        if (text === undefined || text === null) return null;

        const color = options.color || '#000000';
        const backColor = options.backColor || '#ffffff';
        const size = options.size || 100;
        const margin = options.margin !== undefined ? options.margin : 1.0;
        const fontFamily = options.fontFamily || 'Arial';

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const ts = GeometryBuilder.calcTextureSize(size + size * 2 * margin) * 2;
        canvas.width = canvas.height = ts;

        context.font = (ts / (1 + 2 * margin)) + "pt " + fontFamily;
        context.fillStyle = backColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = color;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        // Distinguish between 6 and 9 with an underline or dot marker
        if (text === "6" || text === "9" || text === 6 || text === 9) {
            context.fillText("  .", canvas.width / 2, canvas.height / 2);
        }

        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Creates an array of MeshPhongMaterial instances corresponding to face labels.
     * @param {Array<string|number>} faceLabels - Array of labels, e.g. [" ", "0", "1", "2", "3", "4", "5", "6"]
     * @param {Object} [config={}] - Color and material settings.
     * @param {number} [config.size=100] - Face size for texture resolution.
     * @param {number} [config.margin=1.0] - Texture margin.
     * @param {string} [config.diceLabelColor] - Label text color.
     * @param {string} [config.diceBodyColor] - Die body/background color.
     * @param {Object} [config.materialOptions={}] - Additional Three.js material options.
     * @returns {Array<THREE.MeshPhongMaterial>}
     */
    static createFaceMaterials(faceLabels, config = {}) {
        const size = config.size || 100;
        const margin = config.margin !== undefined ? config.margin : 1.0;
        const labelColor = config.diceLabelColor || '#250000';
        const bodyColor = config.diceBodyColor || '#aaaaaa';
        const materialOptions = config.materialOptions || {};

        const materials = [];
        for (let i = 0; i < faceLabels.length; ++i) {
            const matConfig = Object.assign({}, materialOptions, {
                map: this.createTextTexture(faceLabels[i], {
                    color: labelColor,
                    backColor: bodyColor,
                    size: size,
                    margin: margin
                })
            });
            materials.push(new THREE.MeshPhongMaterial(matConfig));
        }
        return materials;
    }
}

