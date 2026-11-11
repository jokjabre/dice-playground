import { classicTray } from '@dice/content';
import { createDiceEngine } from '@dice/engine';
import { createElement, downloadJsonFile, pickJsonFile } from '@dice/ui';
import {
  SECTION_IDS,
  createEnvelope,
  deserializeEnvelope,
  extractApplicableSections,
  extractSection,
  getCanonicalBaseDefaults,
  isResetMarker,
  mergeSettingsPatch,
  normalizeSettings,
  validateEnvelopeStructure,
  buildEffectiveMinusBase,
  deepEqualValue,
  cloneSettingsValue,
  applyHotSettings,
  applyStructuralSettings,
  classifySettingsPatch,
  canonicalToEngineConfig
} from '@dice/settings';

/** @param {any} engine */
function getEngineWorld(engine) {
  return engine?.world ?? engine;
}

/** @typedef {{ id: string, name: string, envelope: any, settings: Record<string, any>, validation: any, raw: any, enabled: boolean, order: number }} LoadedFile */
/** @typedef {{ path: string[], key: string, choices: Array<{ fileId: string, fileName: string, value: any }>, selectedFileId: string, selectedIndex?: number, status: 'conflict'|'resolved' }} Conflict */

let uid = 1;
function nextId() { return `f${uid++}`; }

/** @param {any} v @returns {v is Record<string, any>} */
function isPlainObject(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }

/** @param {string[]} path */
function pathKey(path) { return path.map(String).join('.'); }

/** @param {any} v @param {number} [max] */
function valuePreview(v, max = 140) {
  let s;
  try { s = typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch { s = String(v); }
  if (s == null) s = String(v);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** @param {any} v */
function pretty(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/** deep set immutable-ish by cloning path */
/** @param {Record<string, any>} root @param {string[]} path @param {any} value */
function setAt(root, path, value) {
  if (!path.length) return (isPlainObject(value) ? cloneSettingsValue(value) : value);
  const out = cloneSettingsValue(root || {});
  /** @type {any} */
  let cur = out;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = isPlainObject(cur[k]) ? cloneSettingsValue(cur[k]) : (Array.isArray(cur[k]) ? cur[k].slice() : {});
    cur = cur[k];
  }
  cur[path[path.length - 1]] = cloneSettingsValue(value);
  return out;
}

/** @param {any} obj @param {string[]} path */
function getAt(obj, path) {
  let cur = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

/**
 * Collect explicit assignments as path->value for conflict detection.
 * We treat reset markers and primitives/arrays as leaf assignments, and recurse into plain objects
 * to detect finer-grained overlaps where supported.
 * @param {any} value @param {string[]} basePath @param {Array<{path:string[], value:any}>} out
 */
function collectAssignments(value, basePath, out) {
  if (Array.isArray(value) || isResetMarker(value) || !isPlainObject(value)) {
    out.push({ path: basePath.slice(), value: cloneSettingsValue(value) });
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    out.push({ path: basePath.slice(), value: {} });
    return;
  }
  for (const k of keys) {
    collectAssignments(value[k], [...basePath, k], out);
  }
}

/**
 * @param {LoadedFile[]} orderedFiles
 * @returns {{ merged: Record<string, any>, conflicts: Conflict[], byPath: Map<string, Conflict> }}
 */
function mergeWithConflicts(orderedFiles) {
  /** @type {Map<string, { choices: Array<{fileId:string,fileName:string,value:any}>, lastValue:any }>} */
  const seen = new Map();
  for (const file of orderedFiles) {
    if (!file.enabled) continue;
    /** @type {Array<{path:string[], value:any}>} */
    const assigns = [];
    collectAssignments(file.settings || {}, [], assigns);
    for (const a of assigns) {
      const k = pathKey(a.path);
      const existing = seen.get(k);
      if (!existing) {
        seen.set(k, { choices: [{ fileId: file.id, fileName: file.name, value: cloneSettingsValue(a.value) }], lastValue: cloneSettingsValue(a.value) });
      } else {
        // record choice only if different from previous distinct choices by file sequence; always update last
        const lastChoice = existing.choices[existing.choices.length - 1];
        if (!deepEqualValue(lastChoice.value, a.value) || lastChoice.fileId !== file.id) {
          existing.choices.push({ fileId: file.id, fileName: file.name, value: cloneSettingsValue(a.value) });
        }
        existing.lastValue = cloneSettingsValue(a.value);
      }
    }
  }

  /** @type {Conflict[]} */
  const conflicts = [];
  /** @type {Record<string, any>} */
  let merged = {};
  // apply in file order to get base merged, then overlay resolutions for conflicting paths
  for (const file of orderedFiles) {
    if (!file.enabled) continue;
    merged = mergeSettingsPatch(merged, file.settings || {});
  }

  for (const [k, info] of seen.entries()) {
    // conflict if more than one contributing assignment and any differ
    /** @type {Array<{fileId:string,fileName:string,value:any}>} */
    const distinct = [];
    for (const c of info.choices) {
      if (!distinct.some(d => deepEqualValue(d.value, c.value))) distinct.push(c);
    }
    if (info.choices.length > 1 && distinct.length > 1) {
      const path = k ? k.split('.') : [];
      const defaultChoice = info.choices[info.choices.length - 1]; // file-order default: last/highest priority
      /** @type {Conflict} */
      const conflict = { path, key: k, choices: info.choices.slice(), selectedFileId: String(defaultChoice.fileId || ''), selectedIndex: info.choices.length - 1, status: 'conflict' };
      conflicts.push(conflict);
      // ensure merged reflects default (last) - already true from merge order, but explicit
      merged = setAt(merged, path, cloneSettingsValue(defaultChoice.value));
    }
  }

  // stable sort by path
  conflicts.sort((a,b) => a.key.localeCompare(b.key));
  const byPath = new Map(conflicts.map(c => [c.key, c]));
  return { merged, conflicts, byPath };
}

/**
 * @param {Record<string, any>} baseMerged
 * @param {Conflict[]} conflicts
 */
function applyConflictResolutions(baseMerged, conflicts) {
  let out = cloneSettingsValue(baseMerged || {});
  for (const c of (conflicts || [])) {
    const choice = c.choices[(c.selectedIndex ?? (c.choices.length - 1))] || c.choices.find((/** @type {any} */ ch) => ch.fileId === c.selectedFileId) || c.choices[c.choices.length - 1];
    if (choice) out = setAt(out, c.path, cloneSettingsValue(choice.value));
  }
  return out;
}

/** @param {Record<string, any>} settings */
function summarizeSettings(settings) {
  const present = SECTION_IDS.filter(id => settings && Object.prototype.hasOwnProperty.call(settings, id));
  return { present, count: present.length };
}

/** @param {any} rawValue @param {string} name */
function loadFromRaw(rawValue, name) {
  // Try envelope first
  const des = deserializeEnvelope(rawValue, { migrate: true, normalize: true });
  if (des.ok && des.envelope) {
    const envelope = des.envelope;
    const settings = isPlainObject(envelope.settings) ? envelope.settings : {};
    const validation = {
      ok: des.ok,
      errors: des.errors || [],
      warnings: des.warnings || [],
      envelope: validateEnvelopeStructure(envelope)
    };
    return { envelope, settings, validation, wrapped: false };
  }
  // Fallback: accept raw settings object and wrap
  if (isPlainObject(rawValue)) {
    const maybeSettings = isPlainObject(rawValue.settings) && (rawValue.format || rawValue.schemaVersion != null)
      ? rawValue.settings
      : rawValue;
    const extracted = extractApplicableSections(maybeSettings);
    const settings = extracted.extracted;
    const envelope = createEnvelope(settings, { kind: 'full', meta: { name, source: 'import-raw' } });
    const v = validateEnvelopeStructure(envelope);
    const validation = {
      ok: true,
      errors: [],
      warnings: [
        `Loaded "${name}" as raw settings (not a valid dice-settings envelope); wrapped for processing.`,
        ...(des.errors && des.errors.length ? [`Envelope parse notes: ${des.errors.join('; ')}`] : []),
        ...(extracted.ignoredKeys.length ? [`Ignored non-canonical keys: ${extracted.ignoredKeys.join(', ')}`] : [])
      ],
      envelope: v
    };
    return { envelope, settings, validation, wrapped: true };
  }
  const validation = { ok: false, errors: des.errors?.length ? des.errors : ['Unsupported file content.'], warnings: des.warnings || [], envelope: null };
  return { envelope: null, settings: {}, validation, wrapped: false };
}

/**
 * @param {{
 *   filesPanel: HTMLElement,
 *   mergePanel: HTMLElement,
 *   resolvedPanel: HTMLElement,
 *   previewPanel: HTMLElement,
 *   reportPanel: HTMLElement
 * }} options
 */
export function createSettingsManager(options) {
  const { filesPanel, mergePanel, resolvedPanel, previewPanel, reportPanel } = options;

  /** @type {LoadedFile[]} */
  let files = [];
  /** @type {Conflict[]} */
  let conflicts = [];
  /** @type {Record<string, any>} */
  let resolvedSettings = {};
  /** @type {{ exportMode: 'overrides'|'effective', exportScope: 'full'|'section', exportSectionId: string }} */
  const exportState = { exportMode: 'effective', exportScope: 'full', exportSectionId: SECTION_IDS[0] };
  /** @type {{ selectedContext: string, status: string, error: string|null, engine: any|null, container: HTMLElement|null, engineContainer: HTMLElement|null, stale: boolean }} */
  const previewState = { selectedContext: 'generic', status: 'idle', error: null, engine: null, container: null, engineContainer: null, stale: false };
  let previewBusy = false;

  function getOrderedEnabledFiles() {
    return files.slice().sort((a,b) => a.order - b.order).filter(f => f.enabled);
  }

  function recompute() {
    const ordered = getOrderedEnabledFiles();
    const res = mergeWithConflicts(ordered);
    // preserve selections for existing paths if still present
    /** @type {Map<string, string>} */
    const prevSel = new Map(conflicts.map(c => [c.key, c.selectedFileId]));
    conflicts = res.conflicts.map(c => {
      if (prevSel.has(c.key)) {
        const sel = prevSel.get(c.key);
        return { ...c, selectedFileId: sel ?? c.selectedFileId };
      }
      return c;
    });
    resolvedSettings = applyConflictResolutions(res.merged, conflicts);
    renderAll();
  }

  function setStatusReport() {
    // rendered in renderReport
  }

  function renderFilesPanel() {
    filesPanel.replaceChildren();
    filesPanel.appendChild(createElement('h2', {}, ['Loaded files']));

    const actions = createElement('div', { className: 'sm-row' }, []);
    const loadBtn = createElement('button', { type: 'button', className: 'primary', 'data-testid': 'load-files-button' }, ['Load settings files']);
    loadBtn.addEventListener('click', async () => {
      try {
        // pick sequentially? pickJsonFile picks one; loop by prompting multiple times is awkward.
        // Implement: one pick; user can click again to add more. Also support input multiple via hidden input.
        await loadFilesFlow();
      } catch (e) {
        // cancellation is normal
      }
    });
    const loadMultiBtn = createElement('button', { type: 'button', 'data-testid': 'load-multi-files-button' }, ['Load multiple…']);
    loadMultiBtn.addEventListener('click', () => loadMultipleViaInput());
    const clearBtn = createElement('button', { type: 'button', className: 'danger', 'data-testid': 'clear-files-button' }, ['Clear all']);
    clearBtn.addEventListener('click', () => { files = []; recompute(); });
    actions.append(loadBtn, loadMultiBtn, clearBtn);
    filesPanel.appendChild(actions);
    filesPanel.appendChild(createElement('p', { className: 'sm-muted' }, ['Files are merged in list order (top = lower priority, bottom = higher priority). Reorder to change conflict defaults and merge outcome.']));

    if (!files.length) {
      filesPanel.appendChild(createElement('p', { className: 'sm-muted' }, ['No files loaded. Load one or more .json settings files to inspect, split, and merge.']));
      return;
    }

    const list = createElement('ul', { className: 'sm-list', 'data-testid': 'files-list' }, []);
    const ordered = files.slice().sort((a,b) => a.order - b.order);
    ordered.forEach((file, idx) => {
      const sum = summarizeSettings(file.settings);
      const item = createElement('li', { className: 'sm-file-item', 'data-testid': `file-item-${file.id}` }, []);
      const head = createElement('div', { className: 'sm-file-head' }, []);
      const left = createElement('div', {}, []);
      left.appendChild(createElement('div', { className: 'sm-file-name' }, [file.name]));
      const metaParts = [
        `order ${idx + 1}`,
        file.envelope?.kind ? `kind ${file.envelope.kind}` : null,
        file.envelope?.appId ? `app ${file.envelope.appId}` : null,
        file.envelope?.sectionId ? `section ${file.envelope.sectionId}` : null,
        `${sum.count} section(s)`
      ].filter(Boolean);
      left.appendChild(createElement('div', { className: 'sm-file-meta' }, [metaParts.join(' · ')]));
      const right = createElement('div', { className: 'sm-row' }, []);
      const up = /** @type {HTMLButtonElement} */ (createElement('button', { type: 'button', 'data-testid': `move-up-${file.id}` }, ['↑']));
      const down = /** @type {HTMLButtonElement} */ (createElement('button', { type: 'button', 'data-testid': `move-down-${file.id}` }, ['↓']));
      const toggle = createElement('button', { type: 'button' }, [file.enabled ? 'Disable' : 'Enable']);
      const remove = createElement('button', { type: 'button', className: 'danger' }, ['Remove']);
      up.disabled = idx === 0;
      down.disabled = idx === ordered.length - 1;
      up.addEventListener('click', () => moveFile(file.id, -1));
      down.addEventListener('click', () => moveFile(file.id, +1));
      toggle.addEventListener('click', () => { file.enabled = !file.enabled; recompute(); });
      remove.addEventListener('click', () => { files = files.filter(f => f.id !== file.id); recompute(); });
      right.append(up, down, toggle, remove);
      head.append(left, right);
      item.appendChild(head);

      const chips = createElement('div', { className: 'sm-chip-row' }, []);
      chips.appendChild(createElement('span', { className: `sm-chip ${file.validation?.ok ? 'ok' : 'err'}` }, [file.validation?.ok ? 'valid' : 'invalid']));
      if (file.validation?.warnings?.length) chips.appendChild(createElement('span', { className: 'sm-chip warn' }, [`${file.validation.warnings.length} warning(s)`]));
      if (file.validation?.errors?.length) chips.appendChild(createElement('span', { className: 'sm-chip err' }, [`${file.validation.errors.length} error(s)`]));
      for (const sid of sum.present) chips.appendChild(createElement('span', { className: 'sm-chip' }, [sid]));
      item.appendChild(chips);

      // Inspect details
      const details = createElement('details', { className: 'sm-details' }, []);
      details.appendChild(createElement('summary', {}, ['Inspect']));
      const pre = createElement('pre', { className: 'sm-pre sm-kv' }, [pretty({ envelopeMeta: {
        format: file.envelope?.format, schemaVersion: file.envelope?.schemaVersion, kind: file.envelope?.kind,
        appId: file.envelope?.appId, sectionId: file.envelope?.sectionId, meta: file.envelope?.meta
      }, validation: { errors: file.validation?.errors || [], warnings: file.validation?.warnings || [] }, settings: file.settings })]);
      details.appendChild(pre);
      item.appendChild(details);

      // Split controls
      item.appendChild(renderSplitControls(file));

      list.appendChild(item);
    });
    filesPanel.appendChild(list);
  }

  /** @param {LoadedFile} file */
  function renderSplitControls(file) {
    const wrap = createElement('div', { style: 'margin-top:8px;' }, []);
    wrap.appendChild(createElement('div', { className: 'sm-muted', style: 'margin-bottom:4px;' }, ['Split & export chunks']));
    const present = SECTION_IDS.filter(id => file.settings && Object.prototype.hasOwnProperty.call(file.settings, id));
    if (!present.length) {
      wrap.appendChild(createElement('div', { className: 'sm-muted' }, ['No canonical sections to split.']));
      return wrap;
    }
    const grid = createElement('div', { className: 'sm-split-grid' }, []);
    for (const sid of present) {
      const btn = createElement('button', { type: 'button', 'data-testid': `split-section-${file.id}-${sid}` }, [`Export ${sid}`]);
      btn.addEventListener('click', () => exportSectionChunk(file.settings, sid, `${sid}.settings.json`, { appId: file.envelope?.appId }));
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);

    // Finer-grained: export individual top-level keys inside each section (where supported)
    const fine = createElement('details', { className: 'sm-details' }, []);
    fine.appendChild(createElement('summary', {}, ['Finer-grained split (by section keys)']));
    const fineWrap = createElement('div', {}, []);
    for (const sid of present) {
      const sectionVal = /** @type {any} */ (file.settings)[sid];
      if (!isPlainObject(sectionVal)) continue;
      const keys = Object.keys(sectionVal);
      if (keys.length <= 1) continue;
      const row = createElement('div', { style: 'margin-top:6px;' }, []);
      row.appendChild(createElement('div', { className: 'sm-file-meta' }, [sid]));
      const kg = createElement('div', { className: 'sm-split-grid' }, []);
      for (const k of keys) {
        const b = createElement('button', { type: 'button' }, [`${sid}.${k}`]);
        b.addEventListener('click', () => {
          const chunk = { [sid]: { [k]: cloneSettingsValue(sectionVal[k]) } };
          const env = createEnvelope(chunk, { kind: 'section', sectionId: sid, appId: file.envelope?.appId, meta: { name: `${sid}.${k}`, source: 'settings-manager-split' } });
          downloadJsonFile(`${sid}.${k}.settings.json`, env, { pretty: 2 });
        });
        kg.appendChild(b);
      }
      row.appendChild(kg);
      fineWrap.appendChild(row);
    }
    if (!fineWrap.childNodes.length) fineWrap.appendChild(createElement('div', { className: 'sm-muted' }, ['No finer-grained object keys available for splitting.']));
    fine.appendChild(fineWrap);
    wrap.appendChild(fine);
    return wrap;
  }

  /**
   * @param {Record<string, any>} settings
   * @param {string} sectionId
   * @param {string} filename
   * @param {{ appId?: string }} [meta]
   */
  function exportSectionChunk(settings, sectionId, filename, meta = {}) {
    const extracted = extractSection(settings, sectionId);
    const env = createEnvelope(extracted, { kind: 'section', sectionId, appId: meta.appId, meta: { name: sectionId, source: 'settings-manager-split' } });
    downloadJsonFile(filename || `${sectionId}.settings.json`, env, { pretty: 2 });
  }

  /** @param {string} id @param {number} delta */
  function moveFile(id, delta) {
    const ordered = files.slice().sort((a,b) => a.order - b.order);
    const idx = ordered.findIndex(f => f.id === id);
    const j = idx + delta;
    if (idx < 0 || j < 0 || j >= ordered.length) return;
    const tmp = ordered[idx].order;
    ordered[idx].order = ordered[j].order;
    ordered[j].order = tmp;
    recompute();
  }

  async function loadFilesFlow() {
    const picked = await pickJsonFile();
    ingestPicked(/** @type {any} */ (picked));
  }

  function loadMultipleViaInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const list = Array.from(input.files || []);
      for (const file of list) {
        try {
          const text = await file.text();
          let data;
          try { data = JSON.parse(text); } catch (e) { data = text; }
          ingestPicked({ name: file.name, text, data, file });
        } catch (e) {
          // ignore single-file read errors, reported per-file not critical here
        }
      }
      input.remove();
      recompute();
    });
    document.body.appendChild(input);
    input.click();
  }

  /** @param {{name?:string,data:any,text?:string,file?:File}} picked */
  function ingestPicked(picked) {
    const name = String(picked?.name || 'settings.json');
    const loaded = loadFromRaw(picked.data, name);
    const order = files.length ? Math.max(...files.map(f => f.order)) + 1 : 1;
    /** @type {LoadedFile} */
    const item = {
      id: nextId(),
      name: picked.name || `settings-${order}.json`,
      envelope: loaded.envelope,
      settings: loaded.settings || {},
      validation: loaded.validation,
      raw: picked.data,
      enabled: loaded.validation?.ok !== false || Object.keys(loaded.settings || {}).length > 0,
      order
    };
    files.push(item);
    recompute();
  }

  function renderMergePanel() {
    mergePanel.replaceChildren();
    mergePanel.appendChild(createElement('h2', {}, ['Merge & conflict resolution']));
    const ordered = getOrderedEnabledFiles();
    mergePanel.appendChild(createElement('p', { className: 'sm-muted' }, [
      `Merging ${ordered.length} enabled file(s) in order. Conflicts: ${conflicts.length}. Default selection follows file order (last/higher-priority file).`
    ]));

    const bulk = createElement('div', { className: 'sm-row' }, []);
    const acceptDefaults = createElement('button', { type: 'button', 'data-testid': 'accept-defaults-button' }, ['Accept file-order defaults']);
    acceptDefaults.addEventListener('click', () => {
      conflicts = conflicts.map(c => ({ ...c, selectedIndex: c.choices.length - 1, selectedFileId: c.choices[c.choices.length - 1].fileId }));
      resolvedSettings = applyConflictResolutions(mergeWithConflicts(ordered).merged, conflicts);
      renderAll();
    });
    bulk.appendChild(acceptDefaults);
    mergePanel.appendChild(bulk);

    if (!conflicts.length) {
      mergePanel.appendChild(createElement('p', { className: 'sm-muted', 'data-testid': 'no-conflicts' }, ['No conflicts detected for current file order/selection.']));
      return;
    }

    const listEl = createElement('ul', { className: 'sm-list', 'data-testid': 'conflicts-list' }, conflicts.map(c => renderConflictItem(c, ordered)));
    mergePanel.appendChild(listEl);
  }

  // store selectedIndex on conflict for UI correctness
  /** @param {Conflict & {selectedIndex?: number}} conflict @param {LoadedFile[]} ordered */
  function renderConflictItem(conflict, ordered) {
    if (typeof conflict.selectedIndex !== 'number') conflict.selectedIndex = conflict.choices.length - 1;
    // sync selectedFileId
    conflict.selectedFileId = conflict.choices[conflict.selectedIndex]?.fileId;
    const li = createElement('li', { className: 'sm-conflict-item', 'data-testid': `conflict-${conflict.key.replace(/[^a-zA-Z0-9_-]/g,'_')}` }, []);
    li.appendChild(createElement('div', { className: 'sm-file-name sm-kv' }, [conflict.key || '(root)']));
    li.appendChild(createElement('div', { className: 'sm-file-meta' }, [`${conflict.choices.length} assignment(s) across files`]));
    const choicesWrap = createElement('div', { className: 'sm-conflict-choices' }, []);
    conflict.choices.forEach((ch, idx) => {
      const selected = conflict.selectedIndex === idx;
      const row = createElement('label', { className: `sm-choice ${selected ? 'selected' : ''}` }, []);
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `conflict-${conflict.key}`;
      radio.checked = selected;
      radio.addEventListener('change', () => {
        conflict.selectedIndex = idx;
        conflict.selectedFileId = ch.fileId;
        const base = mergeWithConflicts(ordered).merged;
        resolvedSettings = applyConflictResolutions(base, conflicts);
        renderResolvedPanel();
        renderReportPanel();
        renderPreviewStatusOnly();
      });
      const label = createElement('div', {}, [
        createElement('div', { className: 'sm-file-meta' }, [`${idx + 1}. ${ch.fileName}${idx === conflict.choices.length - 1 ? ' (file-order default)' : ''}`]),
      ]);
      const val = createElement('div', { className: 'sm-choice-value sm-kv' }, [valuePreview(ch.value, 500)]);
      row.append(radio, label);
      row.appendChild(val);
      choicesWrap.appendChild(row);
    });
    li.appendChild(choicesWrap);
    return li;
  }

  function renderResolvedPanel() {
    resolvedPanel.replaceChildren();
    resolvedPanel.appendChild(createElement('h2', {}, ['Resolved result & export']));
    const summary = summarizeSettings(resolvedSettings);
    resolvedPanel.appendChild(createElement('p', { className: 'sm-muted' }, [
      `Resolved sections: ${summary.present.join(', ') || '(none)'}. Conflicts applied: ${conflicts.length}.`
    ]));

    const modeRow = createElement('div', { className: 'sm-row' }, []);
    modeRow.appendChild(createElement('span', { className: 'sm-inline-label' }, ['Export mode:']));
    const modeSel = /** @type {HTMLSelectElement} */ (document.createElement('select'));
    modeSel.setAttribute('data-testid', 'export-mode-select');
    modeSel.innerHTML = `<option value="effective">Include defaults (effective minus engine base)</option><option value="overrides">Only top level (explicit overrides/dirty merged result)</option>`;
    modeSel.value = exportState.exportMode;
    modeSel.addEventListener('change', () => { exportState.exportMode = /** @type {any} */ (modeSel.value); });
    modeRow.appendChild(modeSel);
    resolvedPanel.appendChild(modeRow);

    const scopeRow = createElement('div', { className: 'sm-row' }, []);
    scopeRow.appendChild(createElement('span', { className: 'sm-inline-label' }, ['Scope:']));
    const scopeSel = /** @type {HTMLSelectElement} */ (document.createElement('select'));
    scopeSel.setAttribute('data-testid', 'export-scope-select');
    scopeSel.innerHTML = `<option value="full">Full (all resolved sections)</option><option value="section">Single section</option>`;
    scopeSel.value = exportState.exportScope;
    const secSel = /** @type {HTMLSelectElement} */ (document.createElement('select'));
    secSel.setAttribute('data-testid', 'export-section-select');
    for (const sid of SECTION_IDS) {
      const opt = document.createElement('option');
      opt.value = sid; opt.textContent = sid;
      secSel.appendChild(opt);
    }
    secSel.value = exportState.exportSectionId;
    secSel.disabled = exportState.exportScope !== 'section';
    scopeSel.addEventListener('change', () => { exportState.exportScope = /** @type {any} */ (scopeSel.value); secSel.disabled = exportState.exportScope !== 'section'; });
    secSel.addEventListener('change', () => { exportState.exportSectionId = secSel.value; });
    scopeRow.append(scopeSel, secSel);
    resolvedPanel.appendChild(scopeRow);

    const btnRow = createElement('div', { className: 'sm-row' }, []);
    const exportBtn = createElement('button', { type: 'button', className: 'primary', 'data-testid': 'export-resolved-button' }, ['Export resolved']);
    exportBtn.addEventListener('click', () => exportResolved());
    const copyBtn = createElement('button', { type: 'button' }, ['Copy JSON']);
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard?.writeText(pretty(buildExportPayload().envelope)); } catch {}
    });
    btnRow.append(exportBtn, copyBtn);
    resolvedPanel.appendChild(btnRow);

    const details = /** @type {HTMLDetailsElement} */ (createElement('details', { className: 'sm-details' }, []));
    details.open = false;
    details.appendChild(createElement('summary', {}, ['View resolved JSON']));
    details.appendChild(createElement('pre', { className: 'sm-pre sm-kv', 'data-testid': 'resolved-json' }, [pretty(resolvedSettings)]));
    resolvedPanel.appendChild(details);
  }

  function buildExportPayload() {
    let settings = cloneSettingsValue(resolvedSettings || {});
    if (exportState.exportScope === 'section') {
      settings = extractSection(settings, exportState.exportSectionId);
    }

    const base = getCanonicalBaseDefaults();
    // Both export modes MUST never include engine base. In this manager, the
    // resolved result represents explicit merged assignments (conflicts resolved);
    // we export values differing from engine base.
    // - "effective" (include defaults): baked snapshot minus engine base.
    // - "overrides": explicit/merged result minus engine base (portable patch-like output).
    // Both are computed as effective-minus-base to guarantee base exclusion; mode is
    // recorded in meta for intent/provenance.
    let outSettings = buildEffectiveMinusBase(settings, base);
    if (!isPlainObject(outSettings)) outSettings = {};

    const kind = exportState.exportScope === 'section' ? 'section' : 'full';
    const envelope = createEnvelope(outSettings, {
      kind,
      sectionId: exportState.exportScope === 'section' ? exportState.exportSectionId : undefined,
      meta: {
        name: exportState.exportScope === 'section' ? exportState.exportSectionId : 'resolved',
        source: 'settings-manager',
        includesDefaults: exportState.exportMode === 'effective',
        exportMode: exportState.exportMode
      }
    });
    const filename = exportState.exportScope === 'section'
      ? `${exportState.exportSectionId}.settings.json`
      : `resolved-full.settings.json`;
    return { envelope, filename, settings: outSettings };
  }

  function exportResolved() {
    const payload = buildExportPayload();
    downloadJsonFile(payload.filename, payload.envelope, { pretty: 2 });
  }

  function renderReportPanel() {
    reportPanel.replaceChildren();
    reportPanel.appendChild(createElement('h2', {}, ['Validation & report']));

    /** @type {Array<{level:'ok'|'warn'|'err', text:string}>} */
    const items = [];
    const ordered = getOrderedEnabledFiles();
    for (const f of ordered) {
      if (f.validation?.ok) items.push({ level: 'ok', text: `${f.name}: envelope/settings valid.` });
      for (const e of (f.validation?.errors || [])) items.push({ level: 'err', text: `${f.name}: ${e}` });
      for (const w of (f.validation?.warnings || [])) items.push({ level: 'warn', text: `${f.name}: ${w}` });
      // unknown/ignored keys relative to canonical sections
      const extracted = extractApplicableSections(f.settings || {});
      if (extracted.ignoredKeys.length) items.push({ level: 'warn', text: `${f.name}: unknown/ignored non-canonical keys: ${extracted.ignoredKeys.join(', ')}` });
      // reset markers count
      const resets = countResetMarkers(f.settings || {});
      if (resets > 0) items.push({ level: 'ok', text: `${f.name}: contains ${resets} reset marker(s) (handled during merge/apply).` });
    }

    // resolved validation
    const resEnv = createEnvelope(resolvedSettings || {}, { kind: 'full', meta: { source: 'settings-manager-resolved' } });
    const resVal = validateEnvelopeStructure(resEnv);
    if (resVal.ok) items.push({ level: 'ok', text: 'Resolved result: structurally valid (canonical envelope/settings).' });
    for (const e of resVal.errors || []) items.push({ level: 'err', text: `Resolved result: ${e}` });
    for (const w of resVal.warnings || []) items.push({ level: 'warn', text: `Resolved result: ${w}` });
    if (conflicts.length) items.push({ level: 'warn', text: `Manual conflict resolution: ${conflicts.length} conflict path(s); current selections applied.` });
    if (!ordered.length) items.push({ level: 'warn', text: 'No enabled files loaded; resolved result is empty.' });

    const list = createElement('ul', { className: 'sm-list', 'data-testid': 'report-list' }, []);
    if (!items.length) list.appendChild(createElement('li', { className: 'sm-muted' }, ['No report items.']));
    for (const it of items) {
      const li = createElement('li', { className: 'sm-report-item' }, []);
      li.appendChild(createElement('span', { className: `sm-chip ${it.level}` }, [it.level.toUpperCase()]));
      li.appendChild(document.createTextNode(' ' + it.text));
      list.appendChild(li);
    }
    reportPanel.appendChild(list);
  }

  /** @param {any} value @returns {number} */
  function countResetMarkers(value) {
    if (isResetMarker(value)) return 1;
    if (Array.isArray(value)) return value.reduce((n, v) => n + countResetMarkers(v), 0);
    if (isPlainObject(value)) return Object.values(value).reduce((n, v) => n + countResetMarkers(v), 0);
    return 0;
  }

  function renderPreviewPanel() {
    previewPanel.replaceChildren();
    previewPanel.appendChild(createElement('h2', {}, ['Best-effort scene preview']));
    previewPanel.appendChild(createElement('p', { className: 'sm-muted' }, [
      'Preview applies merged/selected settings in a generic scene context. Structural changes may require rebuild; preview is best-effort.'
    ]));

    const row = createElement('div', { className: 'sm-row' }, []);
    const ctxSel = /** @type {HTMLSelectElement} */ (document.createElement('select'));
    ctxSel.setAttribute('data-testid', 'preview-context-select');
    ctxSel.innerHTML = `<option value="generic">Generic (classic tray)</option><option value="resolved">Resolved selection (same context)</option>`;
    ctxSel.value = previewState.selectedContext;
    ctxSel.addEventListener('change', () => { previewState.selectedContext = ctxSel.value; });
    const applyBtn = createElement('button', { type: 'button', className: 'primary', 'data-testid': 'preview-apply-button' }, ['Preview resolved settings']);
    applyBtn.addEventListener('click', () => { void runPreview(); });
    const destroyBtn = createElement('button', { type: 'button' }, ['Stop preview']);
    destroyBtn.addEventListener('click', () => { void destroyPreview(); renderPreviewPanel(); });
    row.append(ctxSel, applyBtn, destroyBtn);
    previewPanel.appendChild(row);

    const status = createElement('div', { className: 'sm-muted', 'data-testid': 'preview-status', style: 'margin-bottom:8px;' }, [previewStatusText()]);
    previewPanel.appendChild(status);

    if (previewState.error) {
      const warn = createElement('div', { className: 'sm-file-item', style: 'border-color:#f2b8b2;background:#fff5f4;color:#b42318;' }, []);
      warn.appendChild(createElement('div', { className: 'sm-file-name' }, ['Preview blocker/fallback']));
      warn.appendChild(createElement('div', { className: 'sm-file-meta' }, [previewState.error]));
      warn.appendChild(createElement('div', { className: 'sm-muted', style: 'margin-top:6px;' }, ['Core split/merge/conflict/export flows remain functional. Preview completion can be handled in Phase 5b if runtime coupling prevents reliable embedding here.']));
      previewPanel.appendChild(warn);
    }

    const stage = createElement('div', { className: 'sm-preview-stage', 'data-testid': 'preview-stage' }, []);
    stage.style.minHeight = '260px';
    previewState.container = stage;
    previewPanel.appendChild(stage);

    if (previewState.engine && previewState.engineContainer && !previewState.stale) {
      // Engine canvas lives in engineContainer (created/used during runPreview); reattach it.
      stage.appendChild(previewState.engineContainer);
    } else if (previewState.engine || previewState.stale) {
      stage.appendChild(createElement('div', { className: 'sm-muted', style: 'padding:8px;' }, ['Preview engine is no longer attached to this view. Click "Preview resolved settings" to reapply the current result.']));
    }
  }

  function renderPreviewStatusOnly() {
    const el = previewPanel.querySelector('[data-testid="preview-status"]');
    if (el) el.textContent = previewStatusText();
  }

  function previewStatusText() {
    const parts = [`Status: ${previewState.status}.`];
    if (previewBusy) parts.push('Applying…');
    if (previewState.engine && !previewState.stale) parts.push('Scene active.');
    else parts.push('Click "Preview resolved settings" to (re)apply current resolved result.');
    return parts.join(' ');
  }

  async function destroyPreview() {
    if (previewState.engine) {
      try { previewState.engine.destroy?.(); } catch {}
      previewState.engine = null;
    }
    previewState.engineContainer = null;
    previewState.stale = false;
    previewState.status = 'stopped';
  }

  async function runPreview() {
    if (previewBusy) return;
    previewBusy = true;
    renderPreviewStatusOnly();
    try {
      previewState.error = null;
      const stage = previewState.container;
      if (!stage) throw new Error('Preview container not available.');

      // Clean existing preview and ensure a visible, measurable stage.
      await destroyPreview();
      previewState.stale = false;
      stage.replaceChildren();

      // Dedicated container for the engine/canvas so it can be reattached if the panel rerenders.
      const container = /** @type {HTMLElement} */ (createElement('div', { className: 'sm-preview-engine-host' }, []));
      container.style.position = container.style.position || 'relative';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.minHeight = '260px';
      stage.appendChild(container);

      const settings = cloneSettingsValue(resolvedSettings || {});
      const normalized = normalizeSettings(settings);
      const effective = isPlainObject(normalized) ? normalized : {};
      const engineCfg = canonicalToEngineConfig(effective) || {};
      const diceCount = effective?.diceVisuals?.count ?? engineCfg?.dice?.count ?? 5;
      const content = classicTray;

      // Create a minimal generic engine instance (best-effort context).
      let engine;
      try {
        engine = await createDiceEngine(/** @type {any} */ ({
          container,
          content,
          dice: {
            count: Number.isFinite(Number(diceCount)) ? Math.max(1, Math.min(12, Number(diceCount))) : 5,
            ...(engineCfg.dice || {})
          },
          rendering: engineCfg.rendering || engineCfg.render || {},
          physics: engineCfg.physics || {},
          loop: engineCfg.loop || {},
          settle: engineCfg.settle || {}
        }));
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
        throw new Error(`Failed to create preview engine/context: ${msg}`);
      }

      previewState.engine = engine;
      previewState.engineContainer = container;
      previewState.stale = false;
      previewState.status = 'engine-created';

      // Size to the stage after mount (canvas may initialize at 0x0 otherwise).
      try { engine.resize?.(); } catch {}
      await new Promise((resolve) => setTimeout(resolve, 0));
      try { engine.resize?.(); } catch {}

      // Apply merged/selected settings best-effort using runtime helpers.
      // Compare against canonical base defaults to avoid unnecessary structural rebuilds.
      try {
        if (Object.keys(effective).length) {
          const base = getCanonicalBaseDefaults();
          const classification = classifySettingsPatch(effective, { previousEffective: base, nextEffective: effective });
          const sections = classification.sections.length ? classification.sections : SECTION_IDS.slice();
          if (classification.action === 'hot') {
            applyHotSettings(engine, effective, sections);
          } else {
            // Best-effort structural pass; if it cannot fully rebuild in-place, fall back to hot apply.
            try {
              applyStructuralSettings(engine, base, effective, sections);
            } catch (_) {
              /* fall through to hot apply */
            }
            applyHotSettings(engine, effective, SECTION_IDS.slice());
          }
          previewState.status = classification.sections.length ? 'applied' : 'applied (default)';
        } else {
          previewState.status = 'applied (default scene)';
        }
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
        previewState.status = 'partially-applied';
        previewState.error = `Settings applied partially in preview: ${msg}`;
      }

      // Kick a roll for visibility (best effort) and ensure a render tick.
      try {
        const previewDiceCount = effective?.diceVisuals?.count ?? diceCount;
        const req = Number.isFinite(Number(previewDiceCount)) ? { dice: Math.max(1, Math.min(12, Number(previewDiceCount))) } : undefined;
        if (typeof engine.roll === 'function') {
          void Promise.resolve(engine.roll(req)).catch(() => {});
        }
      } catch {}
      try { engine.resize?.(); } catch {}
      try { getEngineWorld(engine)?.render?.(); } catch {}
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
      previewState.status = 'blocked';
      previewState.error = msg;
      await destroyPreview();
    } finally {
      previewBusy = false;
      renderPreviewPanel();
    }
  }

  function renderAll() {
    renderFilesPanel();
    renderMergePanel();
    renderResolvedPanel();
    renderReportPanel();
    // Rerender preview UI. If an engine exists it was attached to the previous
    // stage node (now detached), so destroy it and ask the user to reapply.
    const prevErr = previewState.error;
    const hadEngine = Boolean(previewState.engine);
    if (hadEngine) {
      try { previewState.engine.destroy?.(); } catch {}
      previewState.engine = null;
      previewState.engineContainer = null;
      previewState.stale = true;
      previewState.status = 'stale (reapply to preview latest result)';
      previewState.error = prevErr;
    }
    renderPreviewPanel();
  }

  renderAll();

  return {
    getState: () => ({ files: files.slice(), conflicts: conflicts.slice(), resolvedSettings: cloneSettingsValue(resolvedSettings), exportState: { ...exportState }, previewState: { ...previewState } }),
    destroy: () => { void destroyPreview(); }
  };
}
