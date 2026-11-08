import { defineContentPack } from '../defineContentPack.js';
import { DICE_PRESETS } from './dice.js';
import { ENCLOSURE_PRESETS } from './enclosures.js';
import { SCENARIOS } from './scenarios.js';
import { TABLE_PRESETS } from './tables.js';

/**
 * Built-in content packs. They compose the shared presets by reference and
 * carry no definitions of their own.
 *
 * @type {Readonly<Record<string, Readonly<Record<string, any>>>>}
 */
export const BUILTIN_CONTENT_PACKS = Object.freeze({
  classicTray: defineContentPack({
    id: 'classic-tray',
    version: 1,
    label: 'Classic Tray',
    enclosure: { ...ENCLOSURE_PRESETS.box },
    table: { ...TABLE_PRESETS.classic },
    camera: { distance: 1, near: 1, far: 0 },
    dice: { ...DICE_PRESETS.classic },
    physics: {
      gravity: { x: 0, y: 0, z: -2940 },
      materials: 'default-dice'
    },
    scenarios: {
      standard: { ...SCENARIOS.standard },
      predeterminedSix: {
        ...SCENARIOS.predeterminedSix,
        values: [...SCENARIOS.predeterminedSix.values]
      }
    }
  }),
  darkStudio: defineContentPack({
    id: 'dark-studio',
    version: 1,
    label: 'Dark Studio',
    enclosure: { ...ENCLOSURE_PRESETS.sphere },
    table: { ...TABLE_PRESETS.darkStudio },
    camera: { distance: 1, near: 1, far: 0 },
    dice: { ...DICE_PRESETS.dark },
    physics: {
      gravity: { x: 0, y: 0, z: -2940 },
      materials: 'default-dice'
    },
    scenarios: {
      standard: { ...SCENARIOS.standard }
    }
  })
});

/**
 * The default built-in pack used by apps that do not supply their own.
 *
 * @type {Readonly<Record<string, any>>}
 */
export const classicTray = BUILTIN_CONTENT_PACKS.classicTray;
