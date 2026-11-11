export {
  SETTINGS_FORMAT,
  SCHEMA_VERSION,
  SETTINGS_KINDS,
  RESET_MARKER_KEY,
  SECTION_IDS,
  FILE_NAMING,
  createResetMarker,
  isResetMarker,
  defaultSettingsStorageKey
} from './constants.js';

export {
  createEnvelope,
  validateEnvelopeStructure,
  serializeEnvelope,
  deserializeEnvelope
} from './envelope.js';

export {
  mergeSettingsPatch,
  extractSection,
  extractApplicableSections,
  applyPatch,
  applyPatchWithFallback,
  resolveLayers,
  diffOverrides,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  deepEqualValue,
  cloneSettingsValue,
  setDirtyPath,
  getPathValue
} from './merge.js';

export {
  storageKeyForApp,
  loadDefaultSettings,
  saveDefaultSettings,
  clearDefaultSettings
} from './storage.js';

export {
  SECTION_REGISTRY,
  getSectionDescriptor,
  listSections,
  getVisibleSectionIdsForApp,
  getHiddenButApplicableSectionIdsForApp,
  getAppVisibilityMatrix
} from './registry.js';

export {
  createEmptyCanonicalSettings,
  normalizeSettings,
  validateSettings,
  createDefaultCanonicalSettings,
  getBaseDefaults,
  migrateSettings,
  CURRENT_SCHEMA_VERSION,
  isKnownSectionId
} from './schema.js';

export {
  CANONICAL_BASE_DEFAULTS,
  getCanonicalBaseDefaults,
  getSectionBaseDefaults
} from './defaults.js';

export {
  registerMigration
} from './migration.js';

export {
  canonicalToEngineConfig,
  canonicalToWorldConfig,
  canonicalToRenderConfig,
  canonicalToPhysicsConfig,
  canonicalToContentPack,
  runtimeStateToCanonical
} from './adapters.js';

export {
  createApplyController,
  classifySettingsPatch,
  resolveCanonicalLayers,
  applyHotSettings,
  applyStructuralSettings
} from './runtime.js';
