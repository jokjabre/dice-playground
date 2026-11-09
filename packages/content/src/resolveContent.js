import { ConfigurationError, mergeConfig } from '@dice/core';

import { validateContentPack } from './validateContentPack.js';

/**
 * Package defaults, before any content pack or app override is applied.
 *
 * @type {Readonly<Record<string, any>>}
 */
export const DEFAULT_CONTENT = Object.freeze({
  enclosure: Object.freeze({ type: 'box' }),
  dice: Object.freeze({ definition: 'd6', count: 6, style: 'classic' }),
  table: Object.freeze({}),
  camera: Object.freeze({}),
  physics: Object.freeze({
    gravity: Object.freeze({ x: 0, y: 0, z: -2940 })
  }),
  scenarios: Object.freeze({})
});

/**
 * Merge defaults < content pack < app overrides and return concrete
 * ids and values. Registries are injected; content never imports runtime
 * packages. Unknown ids throw a `ConfigurationError` naming the path.
 *
 * @param {Record<string, any>} pack
 * @param {{ diceRegistry?: any, enclosureRegistry?: any, styleRegistry?: any, appOverrides?: Record<string, any> }} [options]
 * @returns {Record<string, any>} Resolved content.
 */
export function resolveContent(pack, options = {}) {
  const merged = mergeConfig(
    /** @type {Record<string, any>} */ (DEFAULT_CONTENT),
    /** @type {Record<string, any>} */ (pack ?? {}),
    /** @type {Record<string, any>} */ (options.appOverrides ?? {})
  );

  const validation = validateContentPack(merged, {
    diceRegistry: options.diceRegistry,
    enclosureRegistry: options.enclosureRegistry,
    styleRegistry: options.styleRegistry
  });

  if (!validation.ok) {
    const first = validation.errors[0];
    throw new ConfigurationError(
      `Invalid content: ${first.path} — ${first.message}`,
      { path: first.path }
    );
  }

  const enclosureId = merged.enclosure?.type ?? merged.enclosure?.id;
  const diceDefinition = merged.dice?.definition;

  return {
    id: merged.id,
    version: merged.version ?? 1,
    label: merged.label ?? merged.id,
    enclosure: { ...merged.enclosure, id: enclosureId, type: enclosureId },
    dice: {
      ...merged.dice,
      definition: diceDefinition,
      count: merged.dice?.count ?? 6,
      style: merged.dice?.style ?? 'classic'
    },
    table: { ...merged.table },
    camera: { ...merged.camera },
    physics: {
      ...merged.physics,
      gravity: merged.physics?.gravity ?? { x: 0, y: 0, z: -2940 }
    },
    scenarios: { ...merged.scenarios }
  };
}
