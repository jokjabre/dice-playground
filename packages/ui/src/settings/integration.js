import { createApplyController, createDefaultCanonicalSettings, extractApplicableSections, mergeSettingsPatch } from '@dice/settings';
import { SettingsPanel } from './SettingsPanel.js';
import { ensureBaseUiSections, getUiSection, registerDefaultUiDefinitions } from './registry.js';
import { getDefaultSectionUiDefinitions } from './definitions.js';

/**
 * Mount a shared, registry-driven settings panel for a scene app.
 *
 * - Renders visible sections per app composition (caller provides ids).
 * - Applies full/section imports and per-app default persistence via controller.
 * - Hidden sections remain applicable via defaults/imports (controller state).
 * - Provides per-section and full export/import, save-time mode choice,
 *   and apply/clear per-app default controls (SettingsPanel).
 *
 * @param {{
 *   appId: string,
 *   container: HTMLElement,
 *   engine?: any,
 *   getEngine?: () => any,
 *   visibleSectionIds: string[],
 *   title?: string,
 *   appBundledSettings?: any,
 *   storage?: Storage|null,
 *   onChange?: (info:any)=>void,
 *   onApplied?: (info:any)=>void,
 *   onRebuildRequired?: (info:any)=>void|Promise<void>,
 * }} options
 */
export function mountAppSettings(options) {
  const {
    appId,
    container,
    visibleSectionIds,
    title = 'Settings',
    appBundledSettings,
    storage,
    onChange,
    onApplied,
    onRebuildRequired
  } = options;

  // Ensure declarative UI definitions exist.
  try { registerDefaultUiDefinitions(getDefaultSectionUiDefinitions()); } catch {}
  ensureBaseUiSections();

  const controller = createApplyController({
    appId,
    engine: options.engine,
    getEngine: options.getEngine,
    appBundledSettings: appBundledSettings || {},
    storage: storage ?? (typeof globalThis !== 'undefined' ? globalThis.localStorage : null),
    onApplied: (info) => { onApplied?.(info); },
    onRebuildRequired
  });
  controller.init();

  const panel = new SettingsPanel({
    appId,
    title,
    sectionIds: visibleSectionIds.slice(),
    values: controller.getEffective(),
    resolvedBelow: controller.getState().belowLive,
    container,
    storage: storage ?? null,
    collapsibleSections: true,
    testId: `settings-panel-${appId}`
  });

  /** @param {Record<string, any>} patch @param {any} [meta] */
  async function applyPatch(patch, meta = {}) {
    const res = /** @type {any} */ (await controller.applyPatch(patch || {}, meta));
    panel.setResolvedBelow(controller.getState().belowLive);
    panel.setSettings(controller.getEffective());
    if (!res?.ok && res?.errors?.length) {
      // best-effort status via panel internals not exposed; surface in console
      console.warn('[settings] apply errors', res.errors);
    }
    onChange?.({ type: 'apply', patch, result: res, effective: controller.getEffective() });
    return res;
  }

  panel.onChange((ev) => {
    // ev.settings contains current visible section values as edited in panel.
    // Convert to a patch for changed section only.
    const sectionId = ev.sectionId;
    const sectionValue = ev.settings?.[sectionId] ?? {};
    const patch = { [sectionId]: sectionValue };
    void applyPatch(patch, { source: 'ui', field: ev.id, path: ev.path });
  });

  panel.onImport(async (payload) => {
    // payload.settings is extracted/applied target settings tree.
    const settings = payload.settings || {};
    const extracted = extractApplicableSections(settings).extracted;
    // Incremental merge: apply as patch into live overrides so omit=no-change,
    // reset markers honored by merge/patch engine.
    await applyPatch(extracted, { source: 'import', filename: payload.filename });
  });

  return {
    controller,
    panel,
    applyPatch,
    getEffective: () => controller.getEffective(),
    destroy: () => {
      try { panel.destroy(); } catch {}
    }
  };
}
