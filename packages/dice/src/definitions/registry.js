import { DiceError } from '@dice/core';

import { D6 } from './D6.js';

/**
 * @typedef {import('./D6.js').DieDefinition} DieDefinition
 */

/**
 * @param {unknown} definition
 * @returns {DieDefinition}
 */
function validateDefinition(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('A die definition must be an object.');
  }

  const candidate = /** @type {DieDefinition} */ (definition);

  if (typeof candidate.id !== 'string' || candidate.id.length === 0) {
    throw new TypeError('Die definition id must be a non-empty string.');
  }
  if (!Number.isInteger(candidate.faceCount) || candidate.faceCount < 1) {
    throw new RangeError(`Die definition "${candidate.id}" must have faceCount >= 1.`);
  }
  if (!Array.isArray(candidate.vertices) || candidate.vertices.length < 4) {
    throw new RangeError(`Die definition "${candidate.id}" must define at least four vertices.`);
  }
  if (!Array.isArray(candidate.faces) || candidate.faces.length !== candidate.faceCount) {
    throw new RangeError(
      `Die definition "${candidate.id}" must define exactly faceCount faces.`
    );
  }

  for (const face of candidate.faces) {
    if (!face || typeof face !== 'object' || !face.normal) {
      throw new RangeError(`Die definition "${candidate.id}" has an invalid face.`);
    }
    if (face.index !== candidate.faces.indexOf(face)) {
      throw new RangeError(
        `Die definition "${candidate.id}" face indices must match their position.`
      );
    }
    if (!Array.isArray(face.indices) || face.indices.length < 3) {
      throw new RangeError(`Die definition "${candidate.id}" has an invalid face.`);
    }
    const normalLengthSquared =
      face.normal.x * face.normal.x +
      face.normal.y * face.normal.y +
      face.normal.z * face.normal.z;
    if (Math.abs(normalLengthSquared - 1) > 1e-6) {
      throw new RangeError(
        `Die definition "${candidate.id}" face ${face.index} normal must be a unit vector.`
      );
    }
  }

  if (
    !Array.isArray(candidate.labelRange) ||
    candidate.labelRange.length !== 2 ||
    !Number.isInteger(candidate.labelRange[0]) ||
    !Number.isInteger(candidate.labelRange[1]) ||
    candidate.labelRange[0] > candidate.labelRange[1]
  ) {
    throw new RangeError(`Die definition "${candidate.id}" has an invalid labelRange.`);
  }

  if (typeof candidate.createFaceMapping !== 'function') {
    throw new TypeError(
      `Die definition "${candidate.id}" must implement createFaceMapping().`
    );
  }

  return candidate;
}

/**
 * Explicit registry of die definitions. There is no module-level mutable
 * registry; worlds and apps create their own instance.
 */
export class DiceRegistry {
  /** @type {Map<string, DieDefinition>} */
  #definitions = new Map();

  /**
   * @param {{ definitions?: DieDefinition[] }} [options]
   */
  constructor(options = {}) {
    for (const definition of options.definitions ?? []) {
      this.register(definition);
    }
  }

  /**
   * @param {DieDefinition} definition
   * @returns {DieDefinition}
   */
  register(definition) {
    const validated = validateDefinition(definition);

    if (this.#definitions.has(validated.id)) {
      throw new DiceError(`Die definition already registered: ${validated.id}`, {
        code: 'DUPLICATE_DIE_DEFINITION'
      });
    }

    this.#definitions.set(validated.id, validated);
    return validated;
  }

  /**
   * @param {string} id
   * @returns {DieDefinition}
   */
  get(id) {
    const definition = this.#definitions.get(id);
    if (!definition) {
      throw new DiceError(`Unknown die definition: ${id}`, {
        code: 'UNKNOWN_DIE_DEFINITION'
      });
    }
    return definition;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#definitions.has(id);
  }

  /** @returns {string[]} */
  list() {
    return Array.from(this.#definitions.keys());
  }
}

/**
 * Create a registry containing the built-in definitions.
 *
 * @param {DieDefinition[]} [definitions]
 * @returns {DiceRegistry}
 */
export function createDiceRegistry(definitions = [D6]) {
  return new DiceRegistry({ definitions });
}
