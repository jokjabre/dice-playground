import {
  assertFaceMapping,
  createFaceMapping,
  createShiftedFaceMapping
} from '@dice/dice';

/* types only */

/**
 * @typedef {Object} DieDefinitionLike
 * @property {string} id
 * @property {number} faceCount
 * @property {[number, number]} labelRange
 * @property {() => number[]} createFaceMapping
 */

/**
 * Face shifting for predetermined rolls.
 *
 * Producing a mapping never clones geometry and never mutates the input
 * mapping: the renderer later applies `faceMapping` through material slots,
 * which keeps this package free of rendering and physics imports.
 */
export class FaceShifter {
  /**
   * Return a new mapping in which the face that naturally showed
   * `naturalValue` displays `targetValue`.
   *
   * @param {DieDefinitionLike} definition
   * @param {number[]} mapping
   * @param {number} naturalValue
   * @param {number} targetValue
   * @returns {number[]}
   */
  static shiftFaceMapping(definition, mapping, naturalValue, targetValue) {
    return createShiftedFaceMapping(
      /** @type {any} */ (definition),
      mapping,
      naturalValue,
      targetValue
    );
  }

  /**
   * Alias kept for readability at call sites that think in terms of a die
   * rather than a bare mapping.
   *
   * @param {DieDefinitionLike} definition
   * @param {number[]} mapping
   * @param {number} naturalValue
   * @param {number} targetValue
   * @returns {number[]}
   */
  static createMapping(definition, mapping, naturalValue, targetValue) {
    return FaceShifter.shiftFaceMapping(
      definition,
      mapping,
      naturalValue,
      targetValue
    );
  }

  /**
   * Build one mapping per die. Dice without a target keep their base mapping;
   * extra targets beyond the dice count are ignored.
   *
   * @param {DieDefinitionLike} definition
   * @param {number[]} naturalValues
   * @param {Array<number|undefined>} targetValues
   * @param {number[][]} [baseMappings]
   * @returns {number[][]}
   */
  static createFaceMappings(definition, naturalValues, targetValues, baseMappings) {
    return naturalValues.map((natural, index) => {
      const base = baseMappings
        ? (baseMappings[index] ?? createFaceMapping(/** @type {any} */ (definition)))
        : createFaceMapping(/** @type {any} */ (definition));
      assertFaceMapping(/** @type {any} */ (definition), base);
      const target = targetValues[index];
      if (target === undefined) return base.slice();
      return FaceShifter.shiftFaceMapping(definition, base, natural, target);
    });
  }
}
