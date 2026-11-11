import {
  SECTION_IDS,
  getSectionDescriptor as getCoreSectionDescriptor,
  listSections as listCoreSections
} from '@dice/settings';

/**
 * UI settings registry: declarative binding of canonical section/field
 * definitions to controls, labels/help/constraints, and apply metadata.
 * Adding or hiding a field should be primarily a registry change.
 *
 * @typedef {'text'|'number'|'range'|'select'|'toggle'|'color'|'button'|'group'} FieldType
 * @typedef {Object} FieldDef
 * @property {string} [id] - Stable field id (defaults to path key).
 * @property {string|string[]} [path] - Canonical path within the section settings object.
 * @property {FieldType} type
 * @property {string} [label]
 * @property {string} [help]
 * @property {any} [defaultValue]
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {Array<{ value: any, label: string }>} [options]
 * @property {boolean} [disabled]
 * @property {boolean} [hidden]
 * @property {'hot'|'partial-rebuild'|'full-reload'} [apply]
 * @property {string} [group]
 * @property {FieldDef[]} [fields] - For group/sub-section layout.
 * @property {Record<string, any>} [control] - Extra control props.
 *
 * @typedef {Object} SectionUiDef
 * @property {string} id
 * @property {string} [label]
 * @property {string} [description]
 * @property {FieldDef[]} [fields]
 * @property {boolean} [hidden]
 * @property {'hot'|'partial-rebuild'|'full-reload'} [apply]
 */

/** @type {Map<string, SectionUiDef>} */
const uiSections = new Map();

/** @param {any} path @param {string|undefined} fallbackId */
function normalizePath(path, fallbackId) {
  if (Array.isArray(path)) return path.slice();
  if (typeof path === 'string' && path.length) return path.split('.').filter(Boolean);
  if (fallbackId) return [fallbackId];
  return [];
}

/** @param {FieldDef} field @returns {FieldDef} */
export function normalizeFieldDef(field) {
  const id = field.id || (Array.isArray(field.path) ? field.path.join('.') : String(field.path || field.label || 'field'));
  const path = normalizePath(field.path, id);
  return { ...field, id, path };
}

/** @param {SectionUiDef} def @returns {SectionUiDef} */
export function normalizeSectionUiDef(def) {
  const base = getCoreSectionDescriptor(def.id) || { id: def.id, label: def.id };
  const fields = (def.fields || []).map(normalizeFieldDef);
  return { ...base, ...def, id: def.id, label: def.label || base.label || def.id, fields };
}

/**
 * Register or update a UI definition for a section (declarative).
 * @param {SectionUiDef} def
 * @returns {SectionUiDef}
 */
export function registerUiSection(def) {
  if (!def || !def.id) throw new TypeError('registerUiSection requires a section id.');
  const normalized = normalizeSectionUiDef({ ...(uiSections.get(def.id) || {}), ...def });
  uiSections.set(def.id, normalized);
  return normalized;
}

/**
 * Bulk register section UI definitions.
 * @param {SectionUiDef[]} defs
 */
export function registerUiSections(defs = []) {
  for (const def of defs) registerUiSection(def);
}

/** @param {string} id @returns {SectionUiDef|undefined} */
export function getUiSection(id) {
  if (uiSections.has(id)) return uiSections.get(id);
  const base = getCoreSectionDescriptor(id);
  if (!base) return undefined;
  return normalizeSectionUiDef({ ...base, fields: [] });
}

/** @returns {SectionUiDef[]} */
export function listUiSections() {
  const ids = [...new Set([...SECTION_IDS, ...uiSections.keys()])];
  return /** @type {SectionUiDef[]} */ (ids.map((id) => getUiSection(id)).filter(Boolean));
}

/**
 * Create an isolated registry instance (useful for tests/harnesses).
 * @param {SectionUiDef[]} [defs]
 */
export function createUiRegistry(defs = []) {
  /** @type {Map<string, SectionUiDef>} */
  const map = new Map();
  const api = {
    /** @param {SectionUiDef} def */
    register(def) {
      const n = normalizeSectionUiDef({ ...(map.get(def.id) || {}), ...def });
      map.set(def.id, n);
      return n;
    },
    /** @param {string} id */
    get(id) {
      if (map.has(id)) return map.get(id);
      const base = getCoreSectionDescriptor(id);
      return base ? normalizeSectionUiDef({ ...base, fields: [] }) : undefined;
    },
    list() {
      const ids = [...new Set([...SECTION_IDS, ...map.keys()])];
      return /** @type {SectionUiDef[]} */ (ids.map((id) => api.get(id)).filter(Boolean));
    },
    clear() { map.clear(); }
  };
  for (const d of defs) api.register(d);
  return api;
}

/** Ensure base core sections are known to UI even without fields. */
export function ensureBaseUiSections() {
  for (const s of listCoreSections()) {
    if (!uiSections.has(s.id)) uiSections.set(s.id, normalizeSectionUiDef({ ...s, fields: [] }));
  }
  return listUiSections();
}
