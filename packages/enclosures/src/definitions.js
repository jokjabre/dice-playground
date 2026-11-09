import { BoxEnclosure } from './BoxEnclosure.js';
import { CylinderEnclosure } from './CylinderEnclosure.js';
import { SphereEnclosure } from './SphereEnclosure.js';

/**
 * @typedef {Object} EnclosureDefinition
 * @property {string} id
 * @property {'box'|'sphere'|'cylinder'} type
 * @property {string} label
 * @property {string} description
 */

/**
 * Built-in enclosure definitions. Content selects them by id; the world resolves
 * the id to a factory through `createEnclosure`.
 *
 * @type {Readonly<Record<string, EnclosureDefinition>>}
 */
export const ENCLOSURE_DEFINITIONS = Object.freeze({
  box: Object.freeze({
    id: 'box',
    type: 'box',
    label: 'Box',
    description: 'Rectangular tray with floor, walls, and an optional ceiling.'
  }),
  sphere: Object.freeze({
    id: 'sphere',
    type: 'sphere',
    label: 'Sphere',
    description: 'Hollow sphere approximated by tangent planes and containment.'
  }),
  cylinder: Object.freeze({
    id: 'cylinder',
    type: 'cylinder',
    label: 'Cylinder',
    description: 'Open cylinder with a bottom cap and polygonal wall facets.'
  })
});

/**
 * @type {ReadonlyArray<string>}
 */
export const ENCLOSURE_IDS = Object.freeze(Object.keys(ENCLOSURE_DEFINITIONS));

/**
 * @param {string} id
 * @returns {EnclosureDefinition}
 */
export function getEnclosureDefinition(id) {
  const definition = ENCLOSURE_DEFINITIONS[id];

  if (!definition) {
    throw new RangeError(`Unknown enclosure id: ${id}`);
  }

  return definition;
}

/**
 * Create an enclosure by id or definition.
 *
 * @param {string|EnclosureDefinition} idOrDefinition
 * @param {Record<string, any>} [options]
 * @returns {import('./Enclosure.js').Enclosure}
 */
export function createEnclosure(idOrDefinition, options = {}) {
  const definition =
    typeof idOrDefinition === 'string'
      ? getEnclosureDefinition(idOrDefinition)
      : idOrDefinition;

  const type = definition.type ?? definition.id;

  switch (type) {
    case 'box':
      return new BoxEnclosure(options);
    case 'sphere':
      return new SphereEnclosure(options);
    case 'cylinder':
      return new CylinderEnclosure(options);
    default:
      throw new RangeError(`Unknown enclosure type: ${String(type)}`);
  }
}
