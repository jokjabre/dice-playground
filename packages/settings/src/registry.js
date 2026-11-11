import { SECTION_IDS } from './constants.js';

/**
 * @typedef {'hot'|'partial-rebuild'|'full-reload'} ApplyMode
 */

/**
 * @typedef {Object} SectionDescriptor
 * @property {string} id
 * @property {string} label
 * @property {string} [description]
 * @property {ApplyMode} [defaultApplyMode]
 * @property {readonly string[]} [fieldPaths] Canonical dotted/segmented paths (Phase 1+).
 */

/**
 * Phase 0 skeleton registry: declares canonical section metadata and provides
 * lookup helpers. Field-level definitions, control bindings, visibility rules,
 * and per-field apply classification are added in Phase 1-4 as the inventory
 * is implemented declaratively.
 */

/** @type {Readonly<Record<string, SectionDescriptor>>} */
export const SECTION_REGISTRY = Object.freeze(
  Object.fromEntries(
    SECTION_IDS.map((id) => [
      id,
      Object.freeze({
        id,
        label: id,
        defaultApplyMode: /** @type {ApplyMode} */ ('partial-rebuild')
      })
    ])
  )
);

/**
 * @param {string} id
 * @returns {SectionDescriptor|undefined}
 */
export function getSectionDescriptor(id) {
  return SECTION_REGISTRY[id];
}

/**
 * @returns {SectionDescriptor[]}
 */
export function listSections() {
  return SECTION_IDS.map((id) => SECTION_REGISTRY[id]);
}

/**
 * @param {string} appId
 * @returns {readonly string[]}
 * Phase 0 stub: visibility matrix is documented in INVENTORY.md; runtime
 * per-app composition is wired in Phase 2/4.
 */
export function getVisibleSectionIdsForApp(appId) {
  void appId;
  return SECTION_IDS;
}
