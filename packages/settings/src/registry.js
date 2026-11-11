import { SECTION_IDS } from './constants.js';

/** @type {Record<string, string[]>} */
const APP_VISIBILITY = {
  sandbox: ['enclosure', 'camera', 'lighting', 'appMode'],
  'enclosure-gallery': ['enclosure', 'camera', 'lighting', 'physicsWorld', 'appMode'],
  'physics-lab': ['physicsWorld', 'physicsSolver', 'physicsMaterials', 'appMode'],
  'predetermined-roll': ['determinism', 'appMode'],
  'dice-visual-lab': ['diceVisuals', 'appMode'],
  yamb: ['appMode']
};

/** @type {Record<string, any>} */
const DESCRIPTORS = {
  diceVisuals: { id: 'diceVisuals', label: 'Dice / Visuals', defaultApplyMode: 'partial-rebuild' },
  enclosure: { id: 'enclosure', label: 'Enclosure', defaultApplyMode: 'full-reload' },
  camera: { id: 'camera', label: 'Camera', defaultApplyMode: 'hot' },
  lighting: { id: 'lighting', label: 'Light(s)', defaultApplyMode: 'hot' },
  scene: { id: 'scene', label: 'Scene / Table / Rendering', defaultApplyMode: 'hot' },
  physicsWorld: { id: 'physicsWorld', label: 'Physics (World)', defaultApplyMode: 'hot' },
  physicsSolver: { id: 'physicsSolver', label: 'Physics (Solver & Settle)', defaultApplyMode: 'partial-rebuild' },
  physicsMaterials: { id: 'physicsMaterials', label: 'Physics (Materials & Interactions)', defaultApplyMode: 'hot' },
  throwSpawn: { id: 'throwSpawn', label: 'Throw / Spawn / Input', defaultApplyMode: 'hot' },
  determinism: { id: 'determinism', label: 'Determinism / Predetermined', defaultApplyMode: 'hot' },
  appMode: { id: 'appMode', label: 'App / Mode', defaultApplyMode: 'hot' }
};

export const SECTION_REGISTRY = Object.freeze(
  Object.fromEntries(SECTION_IDS.map((id) => [id, Object.freeze({ ...DESCRIPTORS[id] })]))
);

/** @param {string} id */
export function getSectionDescriptor(id) {
  return /** @type {any} */ (SECTION_REGISTRY)[id];
}

export function listSections() {
  return SECTION_IDS.map((id) => /** @type {any} */ (SECTION_REGISTRY)[id]);
}

/** @param {string} appId */
export function getVisibleSectionIdsForApp(appId) {
  return (APP_VISIBILITY[appId] || []).slice();
}

/** @param {string} appId */
export function getHiddenButApplicableSectionIdsForApp(appId) {
  const visible = new Set(getVisibleSectionIdsForApp(appId));
  return SECTION_IDS.filter((id) => !visible.has(id));
}

/** @param {string} id @param {Record<string, any>} descriptor */
export function registerOrUpdateSectionDescriptor(id, descriptor) {
  DESCRIPTORS[id] = { ...(DESCRIPTORS[id] || { id }), ...descriptor, id };
  return DESCRIPTORS[id];
}

export function getAppVisibilityMatrix() {
  return JSON.parse(JSON.stringify(APP_VISIBILITY));
}
