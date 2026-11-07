import { DEFAULT_CONTACT_MATERIALS } from './config/defaults.js';

/**
 * @typedef {Object} ContactSettings
 * @property {number} friction
 * @property {number} restitution
 */

/**
 * @param {string} materialA
 * @param {string} materialB
 * @returns {string}
 */
export function contactMaterialKey(materialA, materialB) {
  return [materialA, materialB].sort().join(':');
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {number}
 */
function contactNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite number of zero or greater.`);
  }
  return value;
}

/**
 * Backend-neutral registry for named materials and their contact settings.
 * Native material and contact objects stay inside the backend.
 */
export class ContactManager {
  /** @type {any} */
  #backend;

  /** @type {any} */
  #world;

  /** @type {Map<string, ContactSettings>} */
  #settings = new Map();

  /** @type {boolean} */
  #disposed = false;

  /**
   * @param {{ backend: any, world: any, contacts?: Record<string, Partial<ContactSettings>> }} config
   */
  constructor(config) {
    this.#backend = config.backend;
    this.#world = config.world;

    if (!this.#backend || !this.#world) {
      throw new Error('ContactManager requires a backend and a world.');
    }

    for (const [key, settings] of Object.entries(DEFAULT_CONTACT_MATERIALS)) {
      const [materialA, materialB] = this.#parseKey(key);
      this.setContactMaterial(materialA, materialB, settings);
    }

    for (const [key, settings] of Object.entries(config.contacts ?? {})) {
      const [materialA, materialB] = this.#parseKey(key);
      this.setContactMaterial(materialA, materialB, settings);
    }
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {Partial<ContactSettings>} settings
   * @returns {ContactSettings}
   */
  setContactMaterial(materialA, materialB, settings) {
    this.#assertActive();
    this.#assertMaterialName(materialA);
    this.#assertMaterialName(materialB);

    const current = this.getContactMaterial(materialA, materialB);
    const next = {
      friction: contactNumber(
        settings.friction ?? current?.friction ?? 0,
        'contact friction'
      ),
      restitution: contactNumber(
        settings.restitution ?? current?.restitution ?? 0.5,
        'contact restitution'
      )
    };

    this.#backend.setContactMaterial(this.#world, materialA, materialB, next);
    this.#settings.set(contactMaterialKey(materialA, materialB), next);
    return { ...next };
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @returns {ContactSettings|null}
   */
  getContactMaterial(materialA, materialB) {
    const settings = this.#settings.get(contactMaterialKey(materialA, materialB));
    return settings ? { ...settings } : null;
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {number} friction
   * @returns {ContactSettings}
   */
  setFriction(materialA, materialB, friction) {
    return this.setContactMaterial(materialA, materialB, { friction });
  }

  /**
   * @param {string} materialA
   * @param {string} materialB
   * @param {number} restitution
   * @returns {ContactSettings}
   */
  setRestitution(materialA, materialB, restitution) {
    return this.setContactMaterial(materialA, materialB, { restitution });
  }

  /** @returns {string[]} */
  getMaterialNames() {
    return this.#backend.getMaterialNames(this.#world);
  }

  dispose() {
    if (this.#disposed) return;
    this.#settings.clear();
    this.#disposed = true;
  }

  /**
   * @param {string} key
   * @returns {[string, string]}
   */
  #parseKey(key) {
    const [materialA, materialB, ...rest] = key.split(':');
    if (!materialA || !materialB || rest.length > 0) {
      throw new Error(`Contact material keys must use "materialA:materialB": ${key}`);
    }
    return [materialA, materialB];
  }

  /**
   * @param {string} name
   */
  #assertMaterialName(name) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Material names must be non-empty strings.');
    }
  }

  #assertActive() {
    if (this.#disposed) {
      throw new Error('ContactManager has been disposed.');
    }
  }
}
