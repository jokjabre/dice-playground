// @ts-nocheck
// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SettingsSection,
  SettingsPanel,
  createUiRegistry,
  downloadJsonFile,
  getUiSection,
  listUiSections,
  registerUiSection,
  renderField
} from '../src/index.js';
import { SECTION_IDS, createDefaultCanonicalSettings, createEnvelope } from '@dice/settings';

describe('settings UI registry', () => {
  it('registers and renders sections from declarative definitions', () => {
    const reg = createUiRegistry();
    reg.register({
      id: 'camera',
      label: 'Camera',
      fields: [
        { id: 'distance', path: ['distance'], type: 'range', label: 'Distance', min: 0, max: 2, step: 0.1, defaultValue: 1 }
      ]
    });
    const def = reg.get('camera');
    expect(def.id).toBe('camera');
    expect(def.fields[0].path).toEqual(['distance']);
    expect(reg.list().some((s) => s.id === 'camera')).toBe(true);
  });

  it('knows base core sections', () => {
    const ids = listUiSections().map((s) => s.id);
    for (const id of SECTION_IDS) expect(ids).toContain(id);
  });
});

describe('field renderers and SettingsSection', () => {
  it('renders fields from registry definition and emits changes with path', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    registerUiSection({
      id: 'testCamera',
      label: 'Test Camera',
      fields: [
        { id: 'distance', path: ['distance'], type: 'number', label: 'Distance', min: 0, max: 5, step: 0.1 },
        { id: 'enabled', path: ['enabled'], type: 'toggle', label: 'Enabled' }
      ]
    });
    const section = new SettingsSection({ sectionId: 'testCamera', value: { distance: 1.2, enabled: true }, container, testId: 'sec-test' });
    expect(container.querySelector('[data-testid="sec-test"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="settings-testCamera-distance"]')).not.toBeNull();

    const changes = [];
    section.onChange((p) => changes.push(p));
    const input = container.querySelector('[data-testid="settings-testCamera-distance"]');
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(changes.some((c) => c.sectionId === 'testCamera' && c.path.join('.') === 'distance')).toBe(true);
    expect(section.getValue('distance')).toBe(2);

    section.setSectionValue({ distance: 3, enabled: false });
    expect(section.getValue('distance')).toBe(3);
    section.destroy();
    container.remove();
  });

  it('renderField supports grouped layout', () => {
    const api = renderField({
      id: 'grp',
      type: 'group',
      label: 'Group',
      fields: [{ id: 'x', path: ['x'], type: 'text', label: 'X' }]
    }, { value: { x: 'a' } });
    expect(api.element.classList.contains('dice-settings-group')).toBe(true);
    expect(api.element.textContent).toContain('Group');
  });
});

describe('file helpers', () => {
  it('downloadJsonFile serializes and triggers download', () => {
    const origCreate = document.createElement.bind(document);
    const a = origCreate('a');
    const click = vi.spyOn(a, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return a;
      return origCreate(tag);
    });
    const createObjectURL = vi.fn(() => 'blob:1');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const json = downloadJsonFile('x.json', { a: 1 }, { pretty: 2 });
    expect(JSON.parse(json).a).toBe(1);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(a.download).toBe('x.json');
    vi.restoreAllMocks();
  });
});

describe('SettingsPanel import/export UX flows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports current settings using selected scope/mode wired to Phase 1 APIs', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    registerUiSection({ id: 'camera', label: 'Camera', fields: [{ id: 'distance', path: ['distance'], type: 'number', label: 'Distance' }] });
    const panel = new SettingsPanel({
      appId: 'sandbox',
      sectionIds: ['camera'],
      values: { camera: { distance: 1.5 } },
      resolvedBelow: createDefaultCanonicalSettings(),
      container
    });
    const origCreate = document.createElement.bind(document);
    const a = origCreate('a');
    vi.spyOn(a, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return a;
      return origCreate(tag);
    });
    global.URL.createObjectURL = () => 'blob:1';
    global.URL.revokeObjectURL = () => {};
    const res = panel.exportCurrent({ scope: 'section', sectionId: 'camera', mode: 'overrides' });
    expect(res.ok).toBe(true);
    expect(res.envelope.kind).toBe('section');
    expect(res.envelope.sectionId).toBe('camera');
    expect(res.envelope.settings.camera).toBeDefined();
    panel.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('imports envelope data and emits settings payload; applies/clears per-app default', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    registerUiSection({ id: 'camera', label: 'Camera', fields: [{ id: 'distance', path: ['distance'], type: 'number', label: 'Distance' }] });
    const panel = new SettingsPanel({ appId: 'sandbox', sectionIds: ['camera'], values: { camera: { distance: 1 } }, container });
    const imported = [];
    panel.onImport((p) => imported.push(p));
    const env = createEnvelope({ camera: { distance: 2 } }, { kind: 'section', sectionId: 'camera', appId: 'sandbox' });
    const res = panel.importData(env, { target: 'auto' });
    expect(res.ok).toBe(true);
    expect(imported.length).toBe(1);
    expect(imported[0].settings.camera.distance).toBe(2);

    const save = panel.saveAsDefault();
    expect(save.ok).toBe(true);
    const loaded = panel.loadDefault();
    expect(loaded && loaded.ok).toBe(true);
    expect(panel.clearDefault().ok).toBe(true);
    panel.destroy();
    container.remove();
  });
});
