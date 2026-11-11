import { describe, expect, it } from 'vitest';

import {
  FILE_NAMING,
  RESET_MARKER_KEY,
  SCHEMA_VERSION,
  SECTION_IDS,
  SETTINGS_FORMAT,
  createEmptyCanonicalSettings,
  createEnvelope,
  createResetMarker,
  defaultSettingsStorageKey,
  getSectionDescriptor,
  isResetMarker,
  listSections,
  mergeSettingsPatch,
  storageKeyForApp,
  validateEnvelopeStructure
} from '../src/index.js';

describe('@dice/settings Phase 0 contract stubs', () => {
  it('exposes locked envelope and schema constants', () => {
    expect(SETTINGS_FORMAT).toBe('dice-settings');
    expect(SCHEMA_VERSION).toBe(1);
    expect(RESET_MARKER_KEY).toBe('$reset');
    expect(createResetMarker()).toEqual({ $reset: true });
    expect(isResetMarker({ $reset: true })).toBe(true);
    expect(isResetMarker({ $reset: false })).toBe(false);
  });

  it('defines canonical section ids and registry lookups', () => {
    expect(SECTION_IDS.length).toBeGreaterThan(0);
    expect(listSections().map((s) => s.id)).toEqual([...SECTION_IDS]);
    expect(getSectionDescriptor(SECTION_IDS[0])?.id).toBe(SECTION_IDS[0]);
  });

  it('creates and structurally validates an envelope skeleton', () => {
    const env = createEnvelope({ camera: { distance: 1 } }, { kind: 'full', appId: 'sandbox' });
    expect(env.format).toBe(SETTINGS_FORMAT);
    expect(env.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateEnvelopeStructure(env)).toEqual({ ok: true, errors: [] });
  });

  it('provides storage key and filename convention helpers', () => {
    expect(defaultSettingsStorageKey('sandbox')).toBe('dice.settings.default.sandbox');
    expect(storageKeyForApp('yamb')).toBe('dice.settings.default.yamb');
    expect(FILE_NAMING.full('sandbox')).toBe('sandbox-full.settings.json');
    expect(FILE_NAMING.section('camera')).toBe('camera.settings.json');
  });

  it('merge skeleton applies deep object merge and reset-at-path removal', () => {
    const merged = mergeSettingsPatch(
      { camera: { distance: 1, near: 1 }, light: { x: 1 } },
      { camera: { distance: 2, near: { $reset: true } }, light: { $reset: true } }
    );
    expect(merged).toEqual({ camera: { distance: 2 } });
  });

  it('returns an empty canonical settings skeleton', () => {
    expect(createEmptyCanonicalSettings()).toEqual({});
  });
});
