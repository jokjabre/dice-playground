// @ts-nocheck
/**
 * Minimal in-memory physics world and render scene used by enclosure tests.
 *
 * The fake physics world implements the same public surface the enclosures use:
 * static plane bodies, dynamic sphere bodies, gravity, stepping, and post-step
 * callbacks. It is deliberately small but integrates motion and resolves plane
 * contacts, so containment tests exercise real geometry rather than mocks.
 */

let bodySequence = 0;

/**
 * @param {Object} [options]
 * @returns {any}
 */
export function createFakePhysicsWorld(options = {}) {
  /** @type {any[]} */
  const bodies = [];
  /** @type {Set<Function>} */
  const postSteps = new Set();
  /** @type {Map<string, { friction: number, restitution: number }>} */
  const contacts = new Map();

  let gravity = options.gravity ?? { x: 0, y: 0, z: -2940 };

  const world = {
    bodies,
    postSteps,
    contacts,

    /** @returns {any[]} */
    getBodies() {
      return [...bodies];
    },

    /**
     * @param {any} spec
     * @returns {any}
     */
    createBody(spec) {
      const body = createBodyHandle(spec);
      bodies.push(body);
      return body;
    },

    /** @param {any} body */
    removeBody(body) {
      const index = bodies.indexOf(body);
      if (index >= 0) bodies.splice(index, 1);
    },

    /**
     * @param {Function} callback
     * @returns {() => void}
     */
    addPostStep(callback) {
      postSteps.add(callback);
      return () => postSteps.delete(callback);
    },

    /** @param {Function} callback */
    removePostStep(callback) {
      postSteps.delete(callback);
    },

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setGravity(x, y, z) {
      gravity = { x, y, z };
    },

    /** @returns {{ x: number, y: number, z: number }} */
    getGravity() {
      return { ...gravity };
    },

    /**
     * @param {string} materialA
     * @param {string} materialB
     * @param {{ friction?: number, restitution?: number }} settings
     */
    setContactMaterial(materialA, materialB, settings) {
      const key = [materialA, materialB].sort().join('::');
      const contact = {
        friction: settings.friction ?? 0,
        restitution: settings.restitution ?? 0
      };
      contacts.set(key, contact);
      return { ...contact };
    },

    /**
     * @param {string} materialA
     * @param {string} materialB
     * @returns {{ friction: number, restitution: number }|null}
     */
    getContactMaterial(materialA, materialB) {
      const key = [materialA, materialB].sort().join('::');
      const contact = contacts.get(key);
      return contact ? { ...contact } : null;
    },

    /** @param {number} dt */
    step(dt) {
      for (const body of bodies) {
        if (body.mass <= 0) continue;

        body.velocity.x += gravity.x * dt;
        body.velocity.y += gravity.y * dt;
        body.velocity.z += gravity.z * dt;

        body.position.x += body.velocity.x * dt;
        body.position.y += body.velocity.y * dt;
        body.position.z += body.velocity.z * dt;
      }

      for (const body of bodies) {
        if (body.mass <= 0) continue;

        for (const plane of bodies) {
          if (plane.mass !== 0 || plane.shape?.type !== 'plane') continue;
          resolvePlane(body, plane);
        }
      }

      for (const callback of [...postSteps]) {
        callback(world, dt);
      }
    },

    dispose() {
      bodies.length = 0;
      postSteps.clear();
      contacts.clear();
    }
  };

  return world;
}

/**
 * @param {any} spec
 * @returns {any}
 */
function createBodyHandle(spec) {
  let mass = spec.mass ?? 300;

  const body = {
    id: spec.id ?? `body-${++bodySequence}`,
    shape: spec.shape,
    position: spec.transform?.position
      ? { ...spec.transform.position }
      : { x: 0, y: 0, z: 0 },
    quaternion: spec.transform?.quaternion
      ? { ...spec.transform.quaternion }
      : { x: 0, y: 0, z: 0, w: 1 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    linearDamping: spec.linearDamping ?? 0.01,
    angularDamping: spec.angularDamping ?? 0.01,

    get mass() {
      return mass;
    },

    set mass(value) {
      mass = value;
    },

    get isStatic() {
      return mass === 0;
    },

    getPosition() {
      return { ...body.position };
    },

    getQuaternion() {
      return { ...body.quaternion };
    },

    getVelocity() {
      return { ...body.velocity };
    },

    getAngularVelocity() {
      return { ...body.angularVelocity };
    },

    getSleepState() {
      return 'awake';
    },

    getDamping() {
      return {
        linear: body.linearDamping,
        angular: body.angularDamping
      };
    },

    getTransform() {
      return {
        position: body.getPosition(),
        quaternion: body.getQuaternion()
      };
    },

    /** @param {any} transform */
    setTransform(transform) {
      if (transform.position) {
        Object.assign(body.position, transform.position);
      }
      if (transform.quaternion) {
        Object.assign(body.quaternion, transform.quaternion);
      }
    },

    /** @param {any} velocity */
    setVelocity(velocity) {
      Object.assign(body.velocity, velocity);
    },

    /** @param {any} velocity */
    setAngularVelocity(velocity) {
      Object.assign(body.angularVelocity, velocity);
    },

    /** @param {number} value */
    setMass(value) {
      mass = value;
    },

    /**
     * @param {number} linear
     * @param {number} angular
     */
    setDamping(linear, angular) {
      body.linearDamping = linear;
      body.angularDamping = angular;
    },

    /** @param {any} impulse */
    applyImpulse(impulse) {
      body.velocity.x += impulse.x / mass;
      body.velocity.y += impulse.y / mass;
      body.velocity.z += impulse.z / mass;
    },

    /** @param {any} force */
    applyForce(force) {
      body.velocity.x += force.x / mass / 60;
      body.velocity.y += force.y / mass / 60;
      body.velocity.z += force.z / mass / 60;
    },

    wakeUp() {}
  };

  return body;
}

/**
 * Resolve one dynamic body against an inward-facing plane.
 *
 * @param {any} body
 * @param {any} plane
 */
function resolvePlane(body, plane) {
  const normal = plane.shape.normal;
  const planePosition = plane.position;
  const planeDistance =
    normal.x * planePosition.x +
    normal.y * planePosition.y +
    normal.z * planePosition.z;

  const radius = body.shape?.type === 'sphere' ? body.shape.radius : 0;
  const signedDistance =
    normal.x * body.position.x +
    normal.y * body.position.y +
    normal.z * body.position.z -
    planeDistance;

  const penetration = radius - signedDistance;
  if (penetration <= 0) return;

  body.position.x += normal.x * penetration;
  body.position.y += normal.y * penetration;
  body.position.z += normal.z * penetration;

  const normalVelocity =
    body.velocity.x * normal.x +
    body.velocity.y * normal.y +
    body.velocity.z * normal.z;

  if (normalVelocity < 0) {
    const restitution = 0.5;
    body.velocity.x -= (1 + restitution) * normalVelocity * normal.x;
    body.velocity.y -= (1 + restitution) * normalVelocity * normal.y;
    body.velocity.z -= (1 + restitution) * normalVelocity * normal.z;
  }
}

/**
 * @returns {any}
 */
export function createFakeRenderScene() {
  /** @type {any[]} */
  const visuals = [];

  return {
    visuals,

    /** @param {any} descriptor */
    createEnclosureVisual(descriptor) {
      const entry = {
        descriptor: { ...descriptor },
        position: { x: 0, y: 0, z: 0 },
        visible: true,
        disposed: false
      };

      const handle = {
        id: descriptor.type,

        /** @param {any} transform */
        setTransform(transform) {
          if (transform.position) {
            Object.assign(entry.position, transform.position);
          }
        },

        setFaceMapping() {},

        /** @param {boolean} visible */
        setVisible(visible) {
          entry.visible = visible;
        },

        dispose() {
          entry.disposed = true;
          const index = visuals.indexOf(entry);
          if (index >= 0) visuals.splice(index, 1);
        }
      };

      entry.handle = handle;
      visuals.push(entry);
      return handle;
    }
  };
}
