import * as CANNON from 'cannon-es';

import {
  DEFAULT_ANGULAR_DAMPING,
  DEFAULT_GRAVITY,
  DEFAULT_LINEAR_DAMPING,
  DEFAULT_SOLVER_ITERATIONS
} from '../../config/defaults.js';
import { createShape } from './createShape.js';
import { sleepStateToName, toCannonVec, toPlainQuat, toPlainVec } from './toPlain.js';

/**
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} QuatLike
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} w
 */

/**
 * @typedef {Object} BodySpec
 * @property {import('../../shapes.js').ShapeDescriptor} shape
 * @property {number} mass
 * @property {string} material
 * @property {{ position?: Vec3Like, quaternion?: QuatLike }} [transform]
 * @property {number} [linearDamping]
 * @property {number} [angularDamping]
 */

/**
 * @typedef {Object} WorldState
 * @property {Map<string, CANNON.Material>} materials
 * @property {Map<string, CANNON.ContactMaterial>} contacts
 */

/**
 * @param {string} materialA
 * @param {string} materialB
 * @returns {string}
 */
function contactKey(materialA, materialB) {
  return [materialA, materialB].sort().join('::');
}

/**
 * cannon-es backend. All direct cannon-es access lives here; the rest of the
 * package works with plain descriptors and body handles.
 */
export class CannonEsBackend {
  id = 'cannon-es';

  /** @type {'naive'|'sap'} */
  #broadphase;

  /** @type {WeakMap<any, WorldState>} */
  #states = new WeakMap();

  /**
   * @param {{ broadphase?: 'naive'|'sap' }} [options]
   */
  constructor(options = {}) {
    this.#broadphase = options.broadphase ?? 'naive';
  }

  /**
   * @param {{ gravity?: Vec3Like, iterations?: number }} [options]
   * @returns {CANNON.World}
   */
  createWorld(options = {}) {
    const world = new CANNON.World({
      gravity: toCannonVec(options.gravity ?? DEFAULT_GRAVITY)
    });

    if (this.#broadphase === 'sap') {
      world.broadphase = new CANNON.SAPBroadphase(world);
    }

    /** @type {any} */ (world.solver).iterations =
      options.iterations ?? DEFAULT_SOLVER_ITERATIONS;

    this.#states.set(world, {
      materials: new Map(),
      contacts: new Map()
    });

    return world;
  }

  /**
   * @param {CANNON.World} world
   */
  disposeWorld(world) {
    const state = this.#states.get(world);
    if (!state) return;

    for (const body of [...world.bodies]) {
      world.removeBody(body);
    }
    for (const contact of [...state.contacts.values()]) {
      world.removeContactMaterial(contact);
    }

    state.materials.clear();
    state.contacts.clear();
    this.#states.delete(world);
  }

  /**
   * @param {CANNON.World} world
   * @param {number} dt
   */
  step(world, dt) {
    world.step(dt);
  }

  /**
   * @param {CANNON.World} world
   * @param {number} x
   * @param {number} y
   * @param {number} z
   */
  setGravity(world, x, y, z) {
    world.gravity.set(x, y, z);
  }

  /**
   * @param {CANNON.World} world
   * @returns {{ x: number, y: number, z: number }}
   */
  getGravity(world) {
    return toPlainVec(world.gravity);
  }

  /**
   * @param {CANNON.World} world
   * @param {number} iterations
   */
  setSolverIterations(world, iterations) {
    /** @type {any} */ (world.solver).iterations = iterations;
  }

  /**
   * @param {CANNON.World} world
   * @param {string} name
   * @returns {CANNON.Material}
   */
  ensureMaterial(world, name) {
    const state = this.#state(world);
    let material = state.materials.get(name);

    if (!material) {
      material = new CANNON.Material(name);
      state.materials.set(name, material);
    }

    return material;
  }

  /**
   * @param {CANNON.World} world
   * @returns {string[]}
   */
  getMaterialNames(world) {
    return [...this.#state(world).materials.keys()];
  }

  /**
   * @param {CANNON.World} world
   * @param {string} materialA
   * @param {string} materialB
   * @param {{ friction: number, restitution: number }} settings
   */
  setContactMaterial(world, materialA, materialB, settings) {
    const state = this.#state(world);
    const key = contactKey(materialA, materialB);
    let contact = state.contacts.get(key);

    if (!contact) {
      contact = new CANNON.ContactMaterial(
        this.ensureMaterial(world, materialA),
        this.ensureMaterial(world, materialB),
        {
          friction: settings.friction,
          restitution: settings.restitution
        }
      );
      state.contacts.set(key, contact);
      world.addContactMaterial(contact);
      return;
    }

    contact.friction = settings.friction;
    contact.restitution = settings.restitution;
  }

  /**
   * @param {CANNON.World} world
   * @param {string} materialA
   * @param {string} materialB
   * @returns {{ friction: number, restitution: number }|null}
   */
  getContactMaterial(world, materialA, materialB) {
    const contact = this.#state(world).contacts.get(contactKey(materialA, materialB));
    if (!contact) return null;

    return {
      friction: contact.friction,
      restitution: contact.restitution
    };
  }

  /**
   * @param {CANNON.World} world
   * @param {BodySpec} spec
   * @returns {CANNON.Body}
   */
  createBody(world, spec) {
    const { shape, orientation } = createShape(spec.shape);
    const body = new CANNON.Body({
      mass: spec.mass,
      material: this.ensureMaterial(world, spec.material),
      linearDamping: spec.linearDamping ?? DEFAULT_LINEAR_DAMPING,
      angularDamping: spec.angularDamping ?? DEFAULT_ANGULAR_DAMPING
    });

    body.addShape(shape, undefined, orientation);

    if (spec.transform?.position) {
      body.position.set(
        spec.transform.position.x,
        spec.transform.position.y,
        spec.transform.position.z
      );
    }
    if (spec.transform?.quaternion) {
      body.quaternion.set(
        spec.transform.quaternion.x,
        spec.transform.quaternion.y,
        spec.transform.quaternion.z,
        spec.transform.quaternion.w
      );
    }

    world.addBody(body);
    return body;
  }

  /**
   * @param {CANNON.World} world
   * @param {CANNON.Body} body
   */
  removeBody(world, body) {
    if (world.bodies.includes(body)) {
      world.removeBody(body);
    }
  }

  /**
   * @param {CANNON.Body} body
   * @returns {number}
   */
  getMass(body) {
    return body.mass;
  }

  /**
   * @param {CANNON.Body} body
   * @returns {boolean}
   */
  isStatic(body) {
    return body.type === CANNON.Body.STATIC;
  }

  /**
   * @param {CANNON.Body} body
   * @returns {{ x: number, y: number, z: number }}
   */
  getPosition(body) {
    return toPlainVec(body.position);
  }

  /**
   * @param {CANNON.Body} body
   * @returns {{ x: number, y: number, z: number, w: number }}
   */
  getQuaternion(body) {
    return toPlainQuat(body.quaternion);
  }

  /**
   * @param {CANNON.Body} body
   * @returns {{ x: number, y: number, z: number }}
   */
  getVelocity(body) {
    return toPlainVec(body.velocity);
  }

  /**
   * @param {CANNON.Body} body
   * @returns {{ x: number, y: number, z: number }}
   */
  getAngularVelocity(body) {
    return toPlainVec(body.angularVelocity);
  }

  /**
   * @param {CANNON.Body} body
   * @returns {string}
   */
  getSleepState(body) {
    return sleepStateToName(body.sleepState);
  }

  /**
   * @param {CANNON.Body} body
   * @returns {{ linear: number, angular: number }}
   */
  getDamping(body) {
    return {
      linear: body.linearDamping,
      angular: body.angularDamping
    };
  }

  /**
   * @param {CANNON.Body} body
   * @param {{ position?: Vec3Like, quaternion?: QuatLike }} transform
   */
  setTransform(body, transform) {
    if (transform.position) {
      body.position.set(
        transform.position.x,
        transform.position.y,
        transform.position.z
      );
    }
    if (transform.quaternion) {
      body.quaternion.set(
        transform.quaternion.x,
        transform.quaternion.y,
        transform.quaternion.z,
        transform.quaternion.w
      );
    }

    body.aabbNeedsUpdate = true;
    body.wakeUp();
  }

  /**
   * @param {CANNON.Body} body
   * @param {Vec3Like} velocity
   */
  setVelocity(body, velocity) {
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    body.wakeUp();
  }

  /**
   * @param {CANNON.Body} body
   * @param {Vec3Like} velocity
   */
  setAngularVelocity(body, velocity) {
    body.angularVelocity.set(velocity.x, velocity.y, velocity.z);
    body.wakeUp();
  }

  /**
   * @param {CANNON.Body} body
   * @param {number} mass
   */
  setMass(body, mass) {
    body.mass = mass;
    body.type = mass > 0 ? CANNON.Body.DYNAMIC : CANNON.Body.STATIC;
    body.updateMassProperties();
  }

  /**
   * @param {CANNON.Body} body
   * @param {number} linear
   * @param {number} angular
   */
  setDamping(body, linear, angular) {
    body.linearDamping = linear;
    body.angularDamping = angular;
  }

  /**
   * @param {CANNON.Body} body
   * @param {Vec3Like} impulse
   * @param {Vec3Like} [worldPoint]
   */
  applyImpulse(body, impulse, worldPoint) {
    const nativeImpulse = toCannonVec(impulse);

    if (!worldPoint) {
      body.applyImpulse(nativeImpulse);
      return;
    }

    const relativePoint = new CANNON.Vec3(
      worldPoint.x - body.position.x,
      worldPoint.y - body.position.y,
      worldPoint.z - body.position.z
    );
    body.applyImpulse(nativeImpulse, relativePoint);
  }

  /**
   * @param {CANNON.Body} body
   * @param {Vec3Like} force
   */
  applyForce(body, force) {
    body.applyForce(toCannonVec(force));
  }

  /**
   * @param {CANNON.Body} body
   */
  wakeUp(body) {
    body.wakeUp();
  }

  /**
   * @param {CANNON.World} world
   * @returns {WorldState}
   */
  #state(world) {
    const state = this.#states.get(world);
    if (!state) {
      throw new Error('Physics world is not owned by this cannon-es backend.');
    }
    return state;
  }
}

/**
 * @param {{ broadphase?: 'naive'|'sap' }} [options]
 * @returns {CannonEsBackend}
 */
export function createCannonEsBackend(options = {}) {
  return new CannonEsBackend(options);
}
