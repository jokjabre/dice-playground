import { registryHas } from './registries.js';

/**
 * @typedef {{ diceRegistry?: any, enclosureRegistry?: any, styleRegistry?: any }} Registries
 * @typedef {{ ok: boolean, errors: Array<{ path: string, message: string }> }} ValidationResult
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {number} value
 * @returns {boolean}
 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate a content pack, optionally against injected registries.
 *
 * Validation never throws for bad content: it returns
 * `{ ok, errors }` where each error carries the content path
 * (for example `dice.count must be >= 1`). Without a registry, id
 * membership checks are skipped and only structure is validated.
 *
 * @param {Record<string, any>|null|undefined} pack
 * @param {Registries} [registries]
 * @returns {ValidationResult}
 */
export function validateContentPack(pack, registries = {}) {
  /** @type {Array<{ path: string, message: string }> } */
  const errors = [];

  /**
   * @param {string} path
   * @param {string} message
   * @returns {void}
   */
  const fail = (path, message) => {
    errors.push({ path, message });
  };

  if (!isPlainObject(pack)) {
    return {
      ok: false,
      errors: [{ path: 'pack', message: 'Content pack must be a plain object.' }]
    };
  }

  if (typeof pack.id !== 'string' || pack.id.length === 0) {
    fail('id', 'id must be a non-empty string.');
  }
  if (
    pack.version !== undefined &&
    (!Number.isInteger(pack.version) || pack.version < 1)
  ) {
    fail('version', 'version must be an integer >= 1.');
  }
  if (pack.label !== undefined && typeof pack.label !== 'string') {
    fail('label', 'label must be a string.');
  }

  const enclosure = pack.enclosure;
  if (enclosure !== undefined) {
    if (!isPlainObject(enclosure)) {
      fail('enclosure', 'enclosure must be an object.');
    } else {
      const enclosureId = enclosure.type ?? enclosure.id;
      if (typeof enclosureId !== 'string' || enclosureId.length === 0) {
        fail('enclosure.type', 'enclosure.type must be a non-empty string.');
      } else if (!registryHas(registries.enclosureRegistry, enclosureId)) {
        fail(
          'enclosure.type',
          `Unknown enclosure id "${enclosureId}".`
        );
      }
      if (
        enclosure.margin !== undefined &&
        (!isFiniteNumber(enclosure.margin) || enclosure.margin <= 0)
      ) {
        fail('enclosure.margin', 'enclosure.margin must be a number > 0.');
      }
      if (
        enclosure.ceiling !== undefined &&
        typeof enclosure.ceiling !== 'boolean'
      ) {
        fail('enclosure.ceiling', 'enclosure.ceiling must be a boolean.');
      }
    }
  }

  const dice = pack.dice;
  if (dice !== undefined) {
    if (!isPlainObject(dice)) {
      fail('dice', 'dice must be an object.');
    } else {
      if (typeof dice.definition !== 'string' || dice.definition.length === 0) {
        fail('dice.definition', 'dice.definition must be a non-empty string.');
      } else if (!registryHas(registries.diceRegistry, dice.definition)) {
        fail('dice.definition', `Unknown dice definition "${dice.definition}".`);
      }
      if (
        dice.count !== undefined &&
        (!Number.isInteger(dice.count) || dice.count < 1)
      ) {
        fail('dice.count', 'dice.count must be >= 1.');
      }
      if (dice.style !== undefined) {
        if (typeof dice.style === 'string') {
          if (!registryHas(registries.styleRegistry, dice.style)) {
            fail('dice.style', `Unknown dice style "${dice.style}".`);
          }
        } else if (!isPlainObject(dice.style)) {
          fail('dice.style', 'dice.style must be a style id or a style object.');
        }
      }
    }
  }

  const table = pack.table;
  if (table !== undefined) {
    if (!isPlainObject(table)) {
      fail('table', 'table must be an object.');
    } else {
      for (const key of ['floorColor', 'background', 'color', 'lights']) {
        if (table[key] !== undefined && typeof table[key] !== 'string') {
          fail(`table.${key}`, `table.${key} must be a string.`);
        }
      }
      if (table.shadows !== undefined && typeof table.shadows !== 'boolean') {
        fail('table.shadows', 'table.shadows must be a boolean.');
      }
    }
  }

  const camera = pack.camera;
  if (camera !== undefined) {
    if (!isPlainObject(camera)) {
      fail('camera', 'camera must be an object.');
    } else {
      for (const key of ['distance', 'near', 'far']) {
        if (
          camera[key] !== undefined &&
          (!isFiniteNumber(camera[key]) || camera[key] < 0)
        ) {
          fail(`camera.${key}`, `camera.${key} must be a number >= 0.`);
        }
      }
    }
  }

  const physics = pack.physics;
  if (physics !== undefined) {
    if (!isPlainObject(physics)) {
      fail('physics', 'physics must be an object.');
    } else {
      if (physics.gravity !== undefined) {
        const gravity = physics.gravity;
        if (
          !isPlainObject(gravity) ||
          !isFiniteNumber(gravity.x) ||
          !isFiniteNumber(gravity.y) ||
          !isFiniteNumber(gravity.z)
        ) {
          fail(
            'physics.gravity',
            'physics.gravity must be an object with finite x, y, and z numbers.'
          );
        }
      }
      if (
        physics.materials !== undefined &&
        typeof physics.materials !== 'string'
      ) {
        fail('physics.materials', 'physics.materials must be a string.');
      }
    }
  }

  const scenarios = pack.scenarios;
  if (scenarios !== undefined) {
    if (!isPlainObject(scenarios)) {
      fail('scenarios', 'scenarios must be an object.');
    } else {
      for (const [name, scenario] of Object.entries(scenarios)) {
        const path = `scenarios.${name}`;
        if (!isPlainObject(scenario)) {
          fail(path, `${path} must be an object.`);
          continue;
        }
        if (
          scenario.dice !== undefined &&
          (!Number.isInteger(scenario.dice) || scenario.dice < 1)
        ) {
          fail(`${path}.dice`, `${path}.dice must be >= 1.`);
        }
        if (scenario.values !== undefined) {
          if (
            !Array.isArray(scenario.values) ||
            scenario.values.length === 0 ||
            !scenario.values.every(
              (/** @type {unknown} */ value) =>
                Number.isInteger(value) && /** @type {number} */ (value) >= 1
            )
          ) {
            fail(
              `${path}.values`,
              `${path}.values must be a non-empty array of integers >= 1.`
            );
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
