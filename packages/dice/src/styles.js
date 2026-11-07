import { DiceError } from '@dice/core';

/**
 * @typedef {Object} DiceMaterialSpec
 * @property {number} shininess
 * @property {number} specular
 */

/**
 * @typedef {Object} DiceStyle
 * @property {string} bodyColor
 * @property {string} labelColor
 * @property {string} fontFamily
 * @property {DiceMaterialSpec} material
 * @property {number} textureSize
 */

/**
 * Style descriptors are plain data. Texture and material creation belongs to
 * `@dice/rendering`.
 *
 * @type {Readonly<Record<string, Readonly<DiceStyle>>>}
 */
export const DICE_STYLES = Object.freeze({
  classic: Object.freeze({
    bodyColor: '#202020',
    labelColor: '#aaaaaa',
    fontFamily: 'Arial',
    material: Object.freeze({ shininess: 30, specular: 0x172022 }),
    textureSize: 256
  }),
  dark: Object.freeze({
    bodyColor: '#111111',
    labelColor: '#f0f0f0',
    fontFamily: 'Arial',
    material: Object.freeze({ shininess: 60, specular: 0x334455 }),
    textureSize: 256
  })
});

/**
 * @type {Readonly<DiceStyle>}
 */
export const DEFAULT_DICE_STYLE = DICE_STYLES.classic;

/**
 * @param {string} [styleId]
 * @returns {Readonly<DiceStyle>}
 */
export function getDiceStyle(styleId = 'classic') {
  if (!Object.hasOwn(DICE_STYLES, styleId)) {
    throw new DiceError(`Unknown dice style: ${styleId}`, {
      code: 'UNKNOWN_DICE_STYLE'
    });
  }

  return DICE_STYLES[styleId];
}
