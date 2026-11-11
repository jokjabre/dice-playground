import { SECTION_IDS } from '@dice/settings';
import { normalizeSectionUiDef } from './registry.js';

const PAIRS = [
  'die:die',
  'die:desk',
  'die:screen',
  'die:barrier_left',
  'die:barrier_right',
  'die:barrier_top',
  'die:barrier_bottom',
  'die:sphere_boundary',
  'die:glass_boundary'
];

/** @param {string} id @param {string} label @param {string|string[]} path @param {Record<string, any>} [opts] */
function num(id, label, path, opts = {}) {
  return { id, label, path, type: 'number', ...opts };
}
/** @param {string} id @param {string} label @param {string|string[]} path @param {Record<string, any>} [opts] */
function range(id, label, path, opts = {}) {
  return { id, label, path, type: 'range', ...opts };
}
/** @param {string} id @param {string} label @param {string|string[]} path @param {Record<string, any>} [opts] */
function text(id, label, path, opts = {}) {
  return { id, label, path, type: 'text', ...opts };
}
/** @param {string} id @param {string} label @param {string|string[]} path @param {Record<string, any>} [opts] */
function color(id, label, path, opts = {}) {
  return { id, label, path, type: 'color', ...opts };
}
/** @param {string} id @param {string} label @param {string|string[]} path @param {Array<any>} options @param {Record<string, any>} [opts] */
function select(id, label, path, options, opts = {}) {
  return { id, label, path, type: 'select', options, ...opts };
}
/** @param {string} id @param {string} label @param {string|string[]} path @param {Record<string, any>} [opts] */
function toggle(id, label, path, opts = {}) {
  return { id, label, path, type: 'toggle', ...opts };
}
/** @param {string} id @param {string} label @param {Array<any>} fields @param {Record<string, any>} [opts] */
function group(id, label, fields, opts = {}) {
  return { id, label, type: 'group', fields, ...opts };
}

/** @type {Record<string, any>} */
export const SECTION_UI_DEFINITIONS = {
  diceVisuals: {
    id: 'diceVisuals',
    label: 'Dice / Visuals',
    fields: [
      group('definition', 'Definition & count', [
        text('definitionId', 'Definition ID', 'definition', { help: 'Registered dice definition id (e.g. d6).' }),
        range('count', 'Dice count', 'count', { min: 1, max: 20, step: 1, apply: 'partial-rebuild' }),
        text('style', 'Style ID', 'style', { help: 'Named style id (e.g. classic, dark) if used.' })
      ]),
      group('geometry', 'Geometry', [
        range('chamfer', 'Chamfer factor', 'geometry.chamfer', { min: 0, max: 0.5, step: 0.01, apply: 'full-reload' }),
        range('radiusScale', 'Radius scale', 'geometry.radiusScale', { min: 0.5, max: 2, step: 0.05, apply: 'full-reload' })
      ]),
      group('colors', 'Colors', [
        color('bodyColor', 'Body color', 'colors.body'),
        color('labelColor', 'Label color', 'colors.label')
      ]),
      group('material', 'Material', [
        range('shininess', 'Shininess', 'material.shininess', { min: 0, max: 200, step: 1 }),
        color('specular', 'Specular color', 'material.specular')
      ]),
      group('mapping', 'Face mapping / labels', [
        text('faceMapping', 'Face mapping (comma-separated)', 'faceMappingText', { help: 'Example: 1,2,3,4,5,6. Applied as mapping array when valid.' }),
        text('faceLabels', 'Face labels (comma-separated)', 'faceLabelsText', { help: 'Optional label override list.' })
      ])
    ]
  },
  enclosure: {
    id: 'enclosure',
    label: 'Enclosure',
    fields: [
      select('type', 'Type', 'type', [
        { value: 'box', label: 'Box' },
        { value: 'sphere', label: 'Sphere' },
        { value: 'cylinder', label: 'Cylinder' }
      ], { apply: 'full-reload' }),
      range('scale', 'Scale', 'scale', { min: 0.25, max: 3, step: 0.05, apply: 'full-reload' }),
      group('options', 'Options', [
        num('margin', 'Margin', 'options.margin', { step: 0.01, apply: 'full-reload' }),
        num('ceiling', 'Ceiling', 'options.ceiling', { step: 0.01, apply: 'full-reload' })
      ])
    ]
  },
  camera: {
    id: 'camera',
    label: 'Camera',
    fields: [
      range('distance', 'Distance', 'distance', { min: 0.1, max: 10, step: 0.05 }),
      num('near', 'Near', 'near', { min: 0.01, step: 0.1 }),
      num('far', 'Far', 'far', { min: 0, step: 1 }),
      range('fov', 'FOV', 'fov', { min: 5, max: 120, step: 1 })
    ]
  },
  lighting: {
    id: 'lighting',
    label: 'Light(s)',
    fields: [
      group('primary', 'Primary light', [
        num('posX', 'Position X', 'primary.position.x', { step: 1 }),
        num('posY', 'Position Y', 'primary.position.y', { step: 1 }),
        num('posZ', 'Position Z', 'primary.position.z', { step: 1 }),
        range('intensity', 'Intensity', 'primary.intensity', { min: 0, max: 10, step: 0.1 }),
        toggle('castShadow', 'Cast shadow', 'primary.castShadow'),
        color('color', 'Color', 'primary.color')
      ]),
      group('colors', 'Scene light colors', [
        color('ambientColor', 'Ambient color', 'ambientColor'),
        color('spotlightColor', 'Spotlight color', 'spotlightColor')
      ])
    ]
  },
  scene: {
    id: 'scene',
    label: 'Scene / Table / Rendering',
    fields: [
      color('background', 'Background', 'background'),
      color('deskColor', 'Desk / floor color', 'deskColor'),
      toggle('shadows', 'Shadows', 'shadows'),
      toggle('antialias', 'Antialias', 'antialias'),
      range('spotlightIntensity', 'Spotlight intensity', 'spotlightIntensity', { min: 0, max: 10, step: 0.1 }),
      toggle('castShadow', 'Cast shadow', 'castShadow')
    ]
  },
  physicsWorld: {
    id: 'physicsWorld',
    label: 'Physics (World)',
    fields: [
      group('gravity', 'Gravity', [
        num('gx', 'Gravity X', 'gravity.x', { step: 10 }),
        num('gy', 'Gravity Y', 'gravity.y', { step: 10 }),
        num('gz', 'Gravity Z', 'gravity.z', { step: 10 })
      ])
    ]
  },
  physicsSolver: {
    id: 'physicsSolver',
    label: 'Physics (Solver & Settle)',
    fields: [
      range('iterations', 'Solver iterations', 'iterations', { min: 1, max: 100, step: 1 }),
      num('fixedStep', 'Fixed step (s)', 'fixedStep', { min: 0.001, step: 0.001, apply: 'partial-rebuild' }),
      range('maxSubSteps', 'Max substeps', 'maxSubSteps', { min: 1, max: 64, step: 1, apply: 'partial-rebuild' }),
      num('maxFrameGap', 'Max frame gap (s)', 'maxFrameGap', { min: 0, step: 0.01, apply: 'partial-rebuild' }),
      num('maxFrames', 'Max frames / duration cap', 'maxFrames', { min: 1, step: 1, apply: 'partial-rebuild' }),
      group('settle', 'Settle', [
        num('velocityThreshold', 'Velocity threshold', 'settle.velocityThreshold', { min: 0, step: 0.1 }),
        num('settleFrames', 'Settle frames', 'settle.settleFrames', { min: 0, step: 1 }),
        num('maxIterations', 'Max settle iterations', 'settle.maxIterations', { min: 1, step: 1 }),
        num('settleFixedStep', 'Settle fixed step (s)', 'settle.fixedStep', { min: 0.001, step: 0.001, apply: 'partial-rebuild' })
      ])
    ]
  },
  physicsMaterials: {
    id: 'physicsMaterials',
    label: 'Physics (Materials & Interactions)',
    fields: [
      group('body', 'Body', [
        num('mass', 'Mass', 'mass', { min: 0, step: 1 }),
        num('linearDamping', 'Linear damping', 'linearDamping', { min: 0, max: 1, step: 0.001 }),
        num('angularDamping', 'Angular damping', 'angularDamping', { min: 0, max: 1, step: 0.001 }),
        text('bodyMaterial', 'Body material', 'bodyMaterial')
      ]),
      group('contacts', 'Contact pairs (friction / restitution)', PAIRS.flatMap((pair) => {
        const safe = pair.replace(/[^a-z0-9_]/gi, '_');
        return [
          num(`${safe}_friction`, `${pair} friction`, `contactPairs.${pair}.friction`, { min: 0, step: 0.01 }),
          num(`${safe}_restitution`, `${pair} restitution`, `contactPairs.${pair}.restitution`, { min: 0, step: 0.01 })
        ];
      }))
    ]
  },
  throwSpawn: {
    id: 'throwSpawn',
    label: 'Throw / Spawn / Input',
    fields: [
      group('throw', 'Throw', [
        num('strength', 'Strength', 'throw.strength', { step: 0.1 }),
        num('speedJitter', 'Speed jitter', 'throw.speedJitter', { step: 0.01 }),
        num('angleDeviation', 'Angle deviation', 'throw.angleDeviation', { step: 0.01 }),
        num('upwardVelocityRatio', 'Upward velocity ratio', 'throw.upwardVelocityRatio', { step: 0.01 }),
        toggle('flickInterrupt', 'Flick interrupts current roll', 'throw.flickInterrupt'),
        num('maxRollDurationMs', 'Max roll duration (ms)', 'throw.maxRollDurationMs', { min: 0, step: 100 })
      ]),
      group('spawn', 'Spawn', [
        text('profile', 'Spawn profile', 'spawn.profile'),
        num('height', 'Height', 'spawn.height', { step: 1 }),
        num('collisionDistance', 'Collision distance', 'spawn.collisionDistance', { step: 1 }),
        num('margin', 'Margin', 'spawn.margin', { step: 1 }),
        text('randomization', 'Randomization', 'spawn.randomization')
      ])
    ]
  },
  determinism: {
    id: 'determinism',
    label: 'Determinism / Predetermined',
    fields: [
      toggle('enabled', 'Enabled', 'enabled'),
      select('mode', 'Mode', 'mode', [
        { value: 'predict-and-shift', label: 'Predict and shift' },
        { value: 'predict-only', label: 'Predict only' }
      ], { help: 'Determinism plugin mode when available.' }),
      text('requestedValues', 'Requested values (comma-separated)', 'requestedValuesText', { help: 'Default/template target values, e.g. 6,6,6.' })
    ]
  },
  appMode: {
    id: 'appMode',
    label: 'App / Mode',
    fields: [
      text('notes', 'App notes / scoped prefs', 'notes', { help: 'Truly app-scoped settings. Engine-relevant knobs should live in shared sections.' })
    ]
  }
};

export function getDefaultSectionUiDefinitions() {
  return SECTION_IDS.map((id) => normalizeSectionUiDef(SECTION_UI_DEFINITIONS[id] || { id, fields: [] }));
}
