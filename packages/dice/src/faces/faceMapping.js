import { DiceError, InvalidRollTargetError } from '@dice/core';

/**
 * @typedef {import('../definitions/D6.js').DieDefinition} DieDefinition
 */

/**
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @param {string} message
 * @returns {never}
 */
function invalidMapping(definition, mapping, message) {
  throw new DiceError(
    `${message} Expected a permutation of ${definition.faceCount} labels in the range ` +
      `${definition.labelRange[0]}..${definition.labelRange[1]}, received ${JSON.stringify(mapping)}.`,
    { code: 'INVALID_FACE_MAPPING' }
  );
}

/**
 * Return a fresh copy of the definition's default label mapping.
 *
 * @param {DieDefinition} definition
 * @returns {number[]}
 */
export function createFaceMapping(definition) {
  const mapping =
    typeof definition.createFaceMapping === 'function'
      ? definition.createFaceMapping()
      : definition.faces.map((face) => face.defaultLabel);

  assertFaceMapping(definition, mapping);
  return mapping.slice();
}

/**
 * Validate that `mapping[geometricFaceIndex]` is a complete permutation of the
 * definition's default labels.
 *
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @returns {void}
 */
export function assertFaceMapping(definition, mapping) {
  if (!Array.isArray(mapping) || mapping.length !== definition.faceCount) {
    invalidMapping(
      definition,
      /** @type {any} */ (mapping),
      `Face mapping must contain exactly ${definition.faceCount} entries.`
    );
  }

  for (const label of mapping) {
    if (!Number.isInteger(label)) {
      invalidMapping(definition, mapping, 'Face mapping labels must be integers.');
    }
  }

  const expected = definition.faces
    .map((face) => face.defaultLabel)
    .sort((a, b) => a - b);
  const actual = mapping.slice().sort((a, b) => a - b);

  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      invalidMapping(
        definition,
        mapping,
        'Face mapping must use each definition label exactly once.'
      );
    }
  }
}

/**
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @returns {boolean}
 */
export function isValidFaceMapping(definition, mapping) {
  try {
    assertFaceMapping(definition, mapping);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the displayed label for one geometric face.
 *
 * `faceMapping[geometricFaceIndex] = displayedLabel`. The renderer converts the
 * displayed label to a material slot separately.
 *
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @param {number} faceIndex
 * @returns {number}
 */
export function getFaceLabel(definition, mapping, faceIndex) {
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= definition.faceCount) {
    throw new DiceError(
      `Face index ${String(faceIndex)} is outside 0..${definition.faceCount - 1}.`,
      { code: 'INVALID_FACE_INDEX' }
    );
  }

  return mapping[faceIndex];
}

/**
 * Rotate every label by `offset` within the definition's label range. The
 * result is always another complete permutation.
 *
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @param {number} offset
 * @returns {number[]}
 */
export function shiftFaceMapping(definition, mapping, offset) {
  assertFaceMapping(definition, mapping);

  if (!Number.isInteger(offset)) {
    throw new DiceError('Face mapping offset must be an integer.', {
      code: 'INVALID_FACE_MAPPING'
    });
  }

  const [min, max] = definition.labelRange;
  const span = max - min + 1;
  const normalized = ((offset % span) + span) % span;
  const shifted = mapping.map(
    (label) => min + ((label - min + normalized) % span)
  );

  assertFaceMapping(definition, shifted);
  return shifted;
}

/**
 * Produce a mapping in which the face that naturally showed `naturalValue`
 * displays `targetValue`, without mutating or cloning geometry.
 *
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @param {number} naturalValue
 * @param {number} targetValue
 * @returns {number[]}
 */
export function createShiftedFaceMapping(
  definition,
  mapping,
  naturalValue,
  targetValue
) {
  assertFaceMapping(definition, mapping);

  const [min, max] = definition.labelRange;
  if (
    !Number.isInteger(targetValue) ||
    targetValue < min ||
    targetValue > max
  ) {
    throw new InvalidRollTargetError(targetValue, definition.labelRange);
  }

  if (!mapping.includes(naturalValue)) {
    throw new DiceError(
      `Natural value ${naturalValue} is not present in the current face mapping.`,
      { code: 'INVALID_FACE_MAPPING' }
    );
  }

  return shiftFaceMapping(definition, mapping, targetValue - naturalValue);
}
