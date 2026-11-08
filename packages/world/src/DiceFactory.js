import { quat } from '@dice/core';
import {
  DiceEntity,
  createDiceCollisionData,
  createDiceMeshData,
  getDiceStyle
} from '@dice/dice';
import { computeDieRadius } from '@dice/enclosures';
import { createDiceMaterialSet } from '@dice/rendering';

/**
 * @typedef {Object} DiceFactoryOptions
 * @property {any} physics Physics world with createBody.
 * @property {any|null} renderer Render scene or null for headless.
 * @property {any} diceRegistry Registry with get(id).
 * @property {() => Record<string, any>} getMetrics Returns current ViewportMetrics.
 * @property {string|any} [style] Dice style id or descriptor.
 * @property {number} [mass]
 * @property {number} [linearDamping]
 * @property {number} [angularDamping]
 * @property {string} [material] Physics material name for die bodies.
 */

/**
 * @typedef {Object} CreateDieOptions
 * @property {string} id
 * @property {any} definition Die definition object.
 * @property {{ x: number, y: number, z: number }} [position]
 * @property {{ x: number, y: number, z: number }} [velocity]
 * @property {{ x: number, y: number, z: number }} [angularVelocity]
 * @property {{ x: number, y: number, z: number, w: number }} [quaternion]
 * @property {{ x: number, y: number, z: number, a?: number }} [axis]
 * @property {number[]} [faceMapping]
 * @property {boolean} [selected]
 * @property {string} [state]
 */

/**
 * Creates dice by wiring a physics body, an optional rendering visual, and a
 * DiceEntity. Geometry, collision, and material data come from pure dice data;
 * the factory never imports a backend implementation.
 */
export class DiceFactory {
  /** @type {any} */
  #physics;

  /** @type {any|null} */
  #renderer;

  /** @type {any} */
  #diceRegistry;

  /** @type {() => Record<string, any>} */
  #getMetrics;

  /** @type {string|any} */
  #style;

  /** @type {number} */
  #mass;

  /** @type {number} */
  #linearDamping;

  /** @type {number} */
  #angularDamping;

  /** @type {string} */
  #material;

  /** @type {Map<string, { meshData: any, collisionData: any }>} */
  #geometryCache = new Map();

  /**
   * @param {DiceFactoryOptions} options
   */
  constructor(options) {
    if (!options || !options.physics) {
      throw new TypeError('DiceFactory requires a physics world.');
    }
    if (!options.diceRegistry) {
      throw new TypeError('DiceFactory requires a dice registry.');
    }

    this.#physics = options.physics;
    this.#renderer = options.renderer ?? null;
    this.#diceRegistry = options.diceRegistry;
    this.#getMetrics = options.getMetrics ?? (() => ({}));
    this.#style = options.style ?? 'classic';
    this.#mass = options.mass ?? 300;
    this.#linearDamping = options.linearDamping ?? 0.1;
    this.#angularDamping = options.angularDamping ?? 0.1;
    this.#material = options.material ?? 'die';
  }

  /**
   * @param {any|null} renderer
   * @returns {void}
   */
  setRenderer(renderer) {
    this.#renderer = renderer;
  }

  /**
   * @param {string|any} style
   * @returns {void}
   */
  setStyle(style) {
    this.#style = style;
  }

  /**
   * The vertex radius for the current viewport.
   *
   * @returns {number}
   */
  getDieRadius() {
    return computeDieRadius(this.#getMetrics());
  }

  /**
   * @param {any} definition
   * @returns {{ meshData: any, collisionData: any }}
   */
  #geometryFor(definition) {
    const radius = this.getDieRadius();
    const key = `${definition.id}:${radius}`;
    let cached = this.#geometryCache.get(key);

    if (!cached) {
      cached = {
        meshData: createDiceMeshData(definition, { radius }),
        collisionData: createDiceCollisionData(definition, { radius })
      };
      this.#geometryCache.set(key, cached);
    }

    return cached;
  }

  /**
   * Resolve the active style descriptor from an id or a descriptor object.
   *
   * @returns {any}
   */
  #resolveStyle() {
    if (typeof this.#style === 'string') {
      return getDiceStyle(this.#style);
    }
    return this.#style;
  }

  /**
   * Create one die: physics body, optional visual, and DiceEntity.
   *
   * @param {CreateDieOptions} options
   * @returns {any} DiceEntity
   */
  createDie(options) {
    if (!options || typeof options.id !== 'string' || options.id.length === 0) {
      throw new TypeError('DiceFactory.createDie requires a die id.');
    }
    if (!options.definition) {
      throw new TypeError('DiceFactory.createDie requires a die definition.');
    }

    const definition = options.definition;
    const position = options.position ?? { x: 0, y: 0, z: 200 };
    const velocity = options.velocity ?? { x: 0, y: 0, z: 0 };
    const angularVelocity = options.angularVelocity ?? { x: 0, y: 0, z: 0 };

    /** @type {{ x: number, y: number, z: number, w: number }} */
    let quaternion = { x: 0, y: 0, z: 0, w: 1 };
    if (options.quaternion) {
      quaternion = { ...options.quaternion };
    } else if (options.axis) {
      const angle = options.axis.a !== undefined ? options.axis.a * Math.PI * 2 : 0;
      quaternion = quat.fromAxisAngle(
        { x: options.axis.x, y: options.axis.y, z: options.axis.z },
        angle
      );
    } else {
      quaternion = quat.identity();
    }

    const { meshData, collisionData } = this.#geometryFor(definition);

    const body = this.#physics.createBody({
      id: options.id,
      shape: collisionData,
      mass: this.#mass,
      material: this.#material,
      transform: {
        position: { ...position },
        quaternion: { ...quaternion }
      },
      linearDamping: this.#linearDamping,
      angularDamping: this.#angularDamping
    });

    body.setVelocity({ ...velocity });
    body.setAngularVelocity({ ...angularVelocity });

    /** @type {any|null} */
    let visual = null;
    if (this.#renderer) {
      const labels = Array.from(
        new Set(definition.faces.map((/** @type {any} */ face) => face.defaultLabel))
      ).sort((a, b) => a - b);
      const style = this.#resolveStyle();
      const materialSet = createDiceMaterialSet({ style, labels });

      visual = this.#renderer.createDiceVisual({
        id: options.id,
        meshData,
        materialSet,
        faceMapping: options.faceMapping ?? definition.createFaceMapping()
      });
    }

    /** @type {any} */
    const entityInit = {
      id: options.id,
      definition,
      body,
      visual,
      faceMapping: options.faceMapping,
      selected: options.selected ?? false,
      state: options.state ?? 'rolling'
    };
    const entity = new DiceEntity(/** @type {any} */ (entityInit));
    entity.sync();
    return entity;
  }

  /**
   * Clear cached geometry. Called when metrics change so the next die uses the
   * new radius.
   *
   * @returns {void}
   */
  clearCache() {
    this.#geometryCache.clear();
  }
}
