import { createElement } from '../dom/createElement.js';
import { SettingsSection } from './SettingsSection.js';
import { downloadJsonFile, pickJsonFile } from './file.js';
import { getUiSection, listUiSections } from './registry.js';
import {
  FILE_NAMING,
  buildEffectiveMinusBase,
  buildOverridesOnly,
  clearDefaultSettings,
  createDefaultCanonicalSettings,
  createEnvelope,
  deserializeEnvelope,
  extractApplicableSections,
  extractSection,
  loadDefaultSettings,
  saveDefaultSettings
} from '@dice/settings';

function nowIso() { try { return new Date().toISOString(); } catch { return undefined; } }

/**
 * Shared, registry-driven settings UI panel.
 * Renders sections from UI registry definitions and provides consistent
 * import/export/apply-default/clear-default flows wired to Phase 1 APIs.
 */
export class SettingsPanel {
  /** @type {HTMLElement} */
  #element;
  /** @type {HTMLElement} */
  #sectionsHost;
  /** @type {HTMLElement} */
  #controlsHost;
  /** @type {HTMLElement} */
  #statusEl;
  /** @type {Map<string, SettingsSection>} */
  #sections = new Map();
  /** @type {Set<(payload:any)=>void>} */
  #changeHandlers = new Set();
  /** @type {Set<(payload:any)=>void>} */
  #importHandlers = new Set();
  /** @type {string} */
  #appId;
  /** @type {Record<string, any>} */
  #currentSettings;
  /** @type {Record<string, any>} */
  #resolvedBelow;
  #storage;

  /**
   * @param {{
   *   appId?: string,
   *   sectionIds?: string[],
   *   definitions?: Record<string, any>,
   *   values?: Record<string, any>,
   *   resolvedBelow?: Record<string, any>,
   *   container?: HTMLElement|null,
   *   title?: string,
   *   collapsibleSections?: boolean,
   *   storage?: Storage|null,
   *   testId?: string
   * }} [options]
   */
  constructor(options = {}) {
    this.#appId = options.appId || 'app';
    this.#currentSettings = options.values && typeof options.values === 'object' ? { ...options.values } : {};
    this.#resolvedBelow = options.resolvedBelow && typeof options.resolvedBelow === 'object' ? { ...options.resolvedBelow } : createDefaultCanonicalSettings();
    this.#storage = options.storage;

    this.#sectionsHost = createElement('div', { className: 'dice-settings-sections' }, []);
    this.#controlsHost = createElement('div', { className: 'dice-settings-actions' }, []);
    this.#statusEl = createElement('div', { className: 'dice-settings-status', 'aria-live': 'polite', 'data-testid': 'settings-status' }, []);

    const sectionIds = options.sectionIds || listUiSections().map((s) => s.id);
    for (const sid of sectionIds) {
      const def = (options.definitions && options.definitions[sid]) || getUiSection(sid);
      if (!def) continue;
      const section = new SettingsSection({
        sectionId: sid,
        definition: def,
        value: this.#currentSettings[sid] || {},
        collapsible: options.collapsibleSections !== false,
        testId: `settings-section-${sid}`
      });
      section.onChange((ev) => this.#onFieldChange(ev));
      this.#sections.set(sid, section);
      this.#sectionsHost.appendChild(section.element);
    }

    this.#buildActionControls();

    this.#element = createElement('div', {
      className: 'dice-settings-panel',
      'data-testid': options.testId || 'settings-panel',
      'data-app-id': this.#appId
    }, [
      options.title ? createElement('h2', { className: 'dice-panel-title', text: options.title }) : null,
      this.#sectionsHost,
      this.#controlsHost,
      this.#statusEl
    ].filter(Boolean));

    if (options.container) options.container.appendChild(this.#element);
  }

  /** @param {string} message @param {string} [kind] */
  #setStatus(message, kind = 'info') {
    this.#statusEl.textContent = message || '';
    this.#statusEl.setAttribute('data-status-kind', kind);
  }

  /** @param {any} ev */
  #onFieldChange(ev) {
    const sec = this.#currentSettings[ev.sectionId] && typeof this.#currentSettings[ev.sectionId] === 'object'
      ? { ...this.#currentSettings[ev.sectionId] }
      : {};
    // simple path set within section
    let cur = sec;
    const path = ev.path || [];
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i];
      cur[k] = cur[k] && typeof cur[k] === 'object' ? { ...cur[k] } : {};
      cur = cur[k];
    }
    if (path.length) cur[path[path.length - 1]] = ev.value;
    else if (ev.id) sec[ev.id] = ev.value;
    this.#currentSettings = { ...this.#currentSettings, [ev.sectionId]: sec };
    for (const h of [...this.#changeHandlers]) h({ ...ev, settings: this.getSettings() });
  }

  #buildActionControls() {
    const scopeSel = createElement('select', { className: 'dice-control-input', 'data-testid': 'settings-export-scope' }, [
      createElement('option', { value: 'full', text: 'Full' }),
      createElement('option', { value: 'section', text: 'Section' })
    ]);
    const sectionSel = createElement('select', { className: 'dice-control-input', 'data-testid': 'settings-export-section' },
      [...this.#sections.keys()].map((id) => createElement('option', { value: id, text: (getUiSection(id)?.label || id) }))
    );
    const modeSel = createElement('select', { className: 'dice-control-input', 'data-testid': 'settings-export-mode' }, [
      createElement('option', { value: 'overrides', text: 'Overrides only' }),
      createElement('option', { value: 'effective', text: 'Effective minus base' })
    ]);
    const importTargetSel = createElement('select', { className: 'dice-control-input', 'data-testid': 'settings-import-target' }, [
      createElement('option', { value: 'auto', text: 'Auto/full' }),
      ...[...this.#sections.keys()].map((id) => createElement('option', { value: id, text: `Section: ${getUiSection(id)?.label || id}` }))
    ]);

    /** @param {string} id @param {string} label @param {() => any} onClick */
    const btn = (id, label, onClick) => {
      const b = createElement('button', { type: 'button', className: 'dice-control-button', 'data-testid': id, text: label });
      b.addEventListener('click', onClick);
      return b;
    };

    const exportBtn = btn('settings-export', 'Export', () => this.exportCurrent({
      scope: /** @type {'full'|'section'} */ (/** @type {HTMLSelectElement} */ (scopeSel).value),
      sectionId: /** @type {HTMLSelectElement} */ (sectionSel).value,
      mode: /** @type {'overrides'|'effective'} */ (/** @type {HTMLSelectElement} */ (modeSel).value)
    }));
    const importBtn = btn('settings-import', 'Import', () => this.importFromPicker({
      target: /** @type {HTMLSelectElement} */ (importTargetSel).value
    }));
    const applyDefaultBtn = btn('settings-apply-default', 'Apply as default', () => this.saveAsDefault());
    const clearDefaultBtn = btn('settings-clear-default', 'Clear default', () => this.clearDefault());

    const row1 = createElement('div', { className: 'dice-settings-action-row' }, [
      createElement('label', { className: 'dice-control-label' }, ['Scope ', scopeSel]),
      createElement('label', { className: 'dice-control-label' }, ['Section ', sectionSel]),
      createElement('label', { className: 'dice-control-label' }, ['Mode ', modeSel]),
      exportBtn
    ]);
    const row2 = createElement('div', { className: 'dice-settings-action-row' }, [
      createElement('label', { className: 'dice-control-label' }, ['Import target ', importTargetSel]),
      importBtn,
      applyDefaultBtn,
      clearDefaultBtn
    ]);
    this.#controlsHost.appendChild(row1);
    this.#controlsHost.appendChild(row2);
  }

  /**
   * Build and download an export based on scope/mode selection.
   * @param {{ scope?: 'full'|'section', sectionId?: string, mode?: 'overrides'|'effective', filename?: string }} [options]
   */
  exportCurrent(options = {}) {
    try {
      const scope = options.scope || 'full';
      const mode = options.mode || 'overrides';
      const sectionId = options.sectionId || [...this.#sections.keys()][0];
      const effective = this.getSettings();
      let settingsPayload;
      if (mode === 'effective') {
        settingsPayload = buildEffectiveMinusBase(effective, createDefaultCanonicalSettings());
      } else {
        settingsPayload = buildOverridesOnly(this.#resolvedBelow, effective);
      }
      if (scope === 'section' && sectionId) {
        settingsPayload = extractSection(settingsPayload, sectionId);
      }
      const kind = scope === 'section' ? 'section' : (mode === 'overrides' ? 'patch' : 'full');
      const env = createEnvelope(settingsPayload, {
        kind,
        appId: this.#appId,
        sectionId: scope === 'section' ? sectionId : undefined,
        meta: { createdAt: nowIso(), source: 'user-export', includesDefaults: mode === 'effective' }
      });
      const filename = options.filename || (scope === 'section' && sectionId ? FILE_NAMING.section(sectionId) : FILE_NAMING.full(this.#appId));
      downloadJsonFile(filename, env, { pretty: 2 });
      this.#setStatus(`Exported ${filename}.`, 'ok');
      return { ok: true, envelope: env, filename };
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
      this.#setStatus(`Export failed: ${msg}`, 'error');
      return { ok: false, error: msg };
    }
  }

  /**
   * Pick, parse, and apply/import a settings file. Target can be auto/full or a specific section.
   * @param {{ target?: string }} [options]
   */
  async importFromPicker(options = {}) {
    try {
      const picked = await pickJsonFile();
      return this.importData(picked.data, { target: options.target, filename: picked.name });
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
      this.#setStatus(`Import failed: ${msg}`, 'error');
      return { ok: false, error: msg };
    }
  }

  /**
   * Import an envelope/object and emit for app to apply.
   * @param {any} data
   * @param {{ target?: string, filename?: string }} [options]
   */
  importData(data, options = {}) {
    const des = deserializeEnvelope(data);
    if (!des.ok || !des.envelope) {
      const msg = (des.errors || []).join(' ') || 'Invalid settings document.';
      this.#setStatus(`Import failed: ${msg}`, 'error');
      return { ok: false, errors: des.errors, warnings: des.warnings };
    }
    const target = options.target || 'auto';
    let settings = des.envelope.settings || {};
    /** @type {string[]} */
    let ignoredKeys = [];
    if (target && target !== 'auto') {
      const res = extractApplicableSections(settings, { sectionIds: [target] });
      settings = res.extracted;
      ignoredKeys = res.ignoredKeys;
    }
    const payload = { envelope: des.envelope, settings, target, ignoredKeys, warnings: des.warnings || [], filename: options.filename };
    for (const h of [...this.#importHandlers]) h(payload);
    const warn = ignoredKeys.length ? ` (ignored: ${ignoredKeys.join(', ')})` : '';
    this.#setStatus(`Imported ${options.filename || 'settings'}${warn}.`, 'ok');
    return { ok: true, ...payload };
  }

  /** Persist current effective/resolved settings as per-app default. */
  saveAsDefault() {
    try {
      const env = createEnvelope(this.getSettings(), { kind: 'full', appId: this.#appId, meta: { createdAt: nowIso(), source: 'default', includesDefaults: true } });
      const res = saveDefaultSettings(this.#appId, env, this.#storage ? { storage: this.#storage } : undefined);
      if (!res.ok) throw new Error(res.error || 'Failed to save default.');
      this.#setStatus('Saved as app default.', 'ok');
      return res;
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
      this.#setStatus(`Save default failed: ${msg}`, 'error');
      return { ok: false, error: msg };
    }
  }

  /** Clear per-app default. */
  clearDefault() {
    const res = clearDefaultSettings(this.#appId, this.#storage ? { storage: this.#storage } : undefined);
    if (res.ok) this.#setStatus('Cleared app default.', 'ok');
    else this.#setStatus(`Clear default failed: ${res.error || 'unknown error'}`, 'error');
    return res;
  }

  /** Load stored per-app default (deserialized) if present. */
  loadDefault() {
    return loadDefaultSettings(this.#appId, { ...(this.#storage ? { storage: this.#storage } : {}), deserialize: true });
  }

  get element() { return this.#element; }
  getSettings() { return { ...this.#currentSettings }; }
  setSettings(values = {}) {
    this.#currentSettings = values && typeof values === 'object' ? { ...values } : {};
    for (const [sid, section] of this.#sections) section.setSectionValue(this.#currentSettings[sid] || {});
  }
  setResolvedBelow(value = {}) { this.#resolvedBelow = value && typeof value === 'object' ? value : {}; }

  /** @param {(payload:any)=>void} handler */
  onChange(handler) { this.#changeHandlers.add(handler); return () => this.#changeHandlers.delete(handler); }
  /** @param {(payload:any)=>void} handler */
  onImport(handler) { this.#importHandlers.add(handler); return () => this.#importHandlers.delete(handler); }

  destroy() {
    for (const s of this.#sections.values()) s.destroy();
    this.#sections.clear();
    this.#changeHandlers.clear();
    this.#importHandlers.clear();
    if (this.#element.parentNode) this.#element.parentNode.removeChild(this.#element);
  }
}
