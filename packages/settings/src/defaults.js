import { SECTION_IDS } from './constants.js';

/**
 * Canonical engine/base defaults catalog.
 *
 * IMPORTANT: this module is for internal/runtime resolution only. Values derived
 * from these defaults MUST NOT be written to exported settings files except as
 * explicitly represented by "effective minus base" snapshot logic, which by
 * contract excludes equality-to-base values at the export boundary.
 */

/** @param {any} value */
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const CANONICAL_BASE_DEFAULTS = deepFreeze({
  diceVisuals: {
    definition: 'd6',
    count: 6,
    style: 'classic',
    styleDescriptor: null,
    geometry: {
      chamfer: null,
      radiusScale: 1
    },
    colors: {
      body: null,
      label: null
    },
    material: {
      shininess: null,
      specular: null
    },
    faceMapping: null,
    faceLabels: null
  },
  enclosure: {
    type: 'box',
    scale: 1,
    options: {
      margin: null,
      ceiling: null
    }
  },
  camera: {
    distance: 1,
    near: 1,
    far: 0,
    fov: 20
  },
  lighting: {
    primary: {
      position: { x: 0, y: 0, z: 0 },
      intensity: 2,
      castShadow: true,
      color: null
    },
    ambientColor: 0xf0f5fb,
    spotlightColor: 0xefdfd5
  },
  scene: {
    background: 0xffffff,
    deskColor: 0x2596be,
    shadows: true,
    antialias: true,
    spotlightIntensity: 2,
    castShadow: true
  },
  physicsWorld: {
    gravity: { x: 0, y: 0, z: -2940 }
  },
  physicsSolver: {
    iterations: 20,
    fixedStep: 1 / 60,
    maxSubSteps: 4,
    maxFrameGap: 0.25,
    maxFrames: 1000,
    settle: {
      velocityThreshold: 6,
      settleFrames: 3,
      maxIterations: 1000,
      fixedStep: 1 / 60
    }
  },
  physicsMaterials: {
    mass: 300,
    linearDamping: 0.01,
    angularDamping: 0.01,
    bodyMaterial: 'die',
    contactPairs: {
      'die:die': { friction: 0, restitution: 0.5 },
      'die:desk': { friction: 0.01, restitution: 0.5 },
      'die:screen': { friction: 0, restitution: 0.5 },
      'die:barrier_left': { friction: 0, restitution: 1 },
      'die:barrier_right': { friction: 0, restitution: 1 },
      'die:barrier_top': { friction: 0, restitution: 1 },
      'die:barrier_bottom': { friction: 0, restitution: 1 },
      'die:sphere_boundary': { friction: 0, restitution: 0.6 },
      'die:glass_boundary': { friction: 0, restitution: 0.4 }
    }
  },
  throwSpawn: {
    throw: {
      strength: null,
      speedJitter: null,
      angleDeviation: null,
      upwardVelocityRatio: null,
      flickInterrupt: false,
      maxRollDurationMs: null
    },
    spawn: {
      profile: null,
      origin: null,
      height: null,
      collisionDistance: null,
      margin: null,
      randomization: null
    }
  },
  determinism: {
    mode: null,
    requestedValues: null,
    enabled: false
  },
  appMode: {}
});

/**
 * @returns {Record<string, any>} a deep-cloned canonical defaults object.
 */
export function createDefaultCanonicalSettings() {
  return structuredClone(CANONICAL_BASE_DEFAULTS);
}

export function getCanonicalBaseDefaults() {
  return CANONICAL_BASE_DEFAULTS;
}

/**
 * @param {string} sectionId
 */
export function getSectionBaseDefaults(sectionId) {
  if (!SECTION_IDS.includes(/** @type {any} */ (sectionId))) return undefined;
  const value = /** @type {any} */ (CANONICAL_BASE_DEFAULTS)[sectionId];
  return value === undefined ? undefined : structuredClone(value);
}
