import { DiceError } from '@dice/core';

import { FaceReader } from './faces/FaceReader.js';
import {
  assertFaceMapping,
  createFaceMapping
} from './faces/faceMapping.js';

/**
 * @typedef {import('./definitions/D6.js').DieDefinition} DieDefinition
 * @typedef {import('./definitions/D6.js').Vec3} Vec3
 * @typedef {import('./faces/FaceReader.js').Quaternion} Quaternion
 */

/**
 * @typedef {'idle'|'rolling'|'settled'|'removed'} DiceState
 */

/**
 * @typedef {Object} BodyHandleLike
 * @property {() => Vec3} getPosition
 * @property {() => Quaternion} getQuaternion
 * @property {(transform: { position?: Vec3, quaternion?: Quaternion }) => void} setTransform
 */

/**
 * @typedef {Object} VisualHandleLike
 * @property {(mapping: number[]) => void} setFaceMapping
 * @property {(transform: { position: Vec3, quaternion: Quaternion }) => void} setTransform
 * @property {() => void} dispose
 */

/**
 * @typedef {Object} DiceEntityInit
 * @property {string} id Stable id assigned by the world.
 * @property {DieDefinition} definition
 * @property {BodyHandleLike|null} [body]
 * @property {VisualHandleLike|null} [visual]
 * @property {number[]} [faceMapping]
 * @property {boolean} [selected]
 * @property {DiceState} [state]
 */

/**
 * One die instance. Stores physics and visual handles but never imports those
 * packages; all interaction goes through the narrow handle contracts.
 */
export class DiceEntity {
  /** @type {string} */
  id;

  /** @type {DieDefinition} */
  definition;

  /** @type {BodyHandleLike|null} */
  body;

  /** @type {VisualHandleLike|null} */
  visual;

  /** @type {number[]} */
  faceMapping;

  /** @type {boolean} */
  selected;

  /** @type {DiceState} */
  state;

  /**
   * @param {DiceEntityInit} init
   */
  constructor(init) {
    if (!init || typeof init.id !== 'string' || init.id.length === 0) {
      throw new DiceError('DiceEntity requires a non-empty id assigned by the world.', {
        code: 'INVALID_DICE_ID'
      });
    }
    if (!init.definition) {
      throw new DiceError('DiceEntity requires a die definition.', {
        code: 'INVALID_DIE_DEFINITION'
      });
    }

    this.id = init.id;
    this.definition = init.definition;
    this.body = init.body ?? null;
    this.visual = init.visual ?? null;
    this.faceMapping = init.faceMapping
      ? cloneFaceMapping(init.definition, init.faceMapping)
      : createFaceMapping(init.definition);
    this.selected = init.selected ?? false;
    this.state = init.state ?? 'idle';
  }

  /**
   * Displayed value of the face pointing up, or `null` when the die has no
   * physics body or has been removed.
   *
   * @returns {number|null}
   */
  get value() {
    if (!this.body || this.state === 'removed') return null;

    return FaceReader.getValue(
      this.definition,
      this.body.getQuaternion(),
      this.faceMapping
    );
  }

  /**
   * Replace the label permutation. Rendering refreshes through the visual
   * handle; geometry is never cloned.
   *
   * @param {number[]} mapping
   * @returns {void}
   */
  setFaceMapping(mapping) {
    this.faceMapping = cloneFaceMapping(this.definition, mapping);

    if (this.visual) {
      this.visual.setFaceMapping(this.faceMapping);
    }
  }

  /**
   * Copy the physics transform onto the visual handle.
   *
   * @returns {void}
   */
  sync() {
    if (!this.body || !this.visual) return;

    this.visual.setTransform({
      position: this.body.getPosition(),
      quaternion: this.body.getQuaternion()
    });
  }

  /**
   * @param {{ position?: Vec3, quaternion?: Quaternion }} transform
   * @returns {void}
   */
  reset(transform) {
    if (!this.body) {
      throw new DiceError('DiceEntity.reset requires a physics body.', {
        code: 'MISSING_DICE_BODY'
      });
    }

    this.body.setTransform(transform);
    this.state = 'idle';
    this.sync();
  }

  /**
   * Dispose the visual handle. The world owns physics body removal.
   *
   * @returns {void}
   */
  dispose() {
    if (this.state === 'removed') return;

    if (this.visual) {
      this.visual.dispose();
      this.visual = null;
    }

    this.selected = false;
    this.state = 'removed';
  }
}

/**
 * @param {DieDefinition} definition
 * @param {number[]} mapping
 * @returns {number[]}
 */
function cloneFaceMapping(definition, mapping) {
  assertFaceMapping(definition, mapping);
  return mapping.slice();
}
