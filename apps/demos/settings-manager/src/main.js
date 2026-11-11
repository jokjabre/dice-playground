import { createSettingsManager } from './app.js';
import '@dice/ui/styles/settings.css';
import './styles.css';

const errorHost = /** @type {HTMLElement|null} */ (document.getElementById('sm-error'));

/** @param {Error} error */
function showFatal(error) {
  if (!errorHost) return;
  errorHost.hidden = false;
  errorHost.textContent = `Unable to start settings manager: ${error.message}`;
}

async function start() {
  const filesPanel = /** @type {HTMLElement|null} */ (document.getElementById('files-panel'));
  const mergePanel = /** @type {HTMLElement|null} */ (document.getElementById('merge-panel'));
  const resolvedPanel = /** @type {HTMLElement|null} */ (document.getElementById('resolved-panel'));
  const previewPanel = /** @type {HTMLElement|null} */ (document.getElementById('preview-panel'));
  const reportPanel = /** @type {HTMLElement|null} */ (document.getElementById('report-panel'));

  if (!filesPanel || !mergePanel || !resolvedPanel || !previewPanel || !reportPanel) {
    showFatal(new Error('Settings manager mount points are missing from the document.'));
    return;
  }

  const manager = createSettingsManager({
    filesPanel,
    mergePanel,
    resolvedPanel,
    previewPanel,
    reportPanel
  });

  const teardown = () => {
    try { manager.destroy?.(); } catch {}
  };
  window.addEventListener('beforeunload', teardown);
  import.meta.hot?.dispose(teardown);

  if (import.meta.env.DEV) {
    /** @type {any} */ (window).__settingsManager = manager;
  }
}

start().catch((error) => {
  const failure = error instanceof Error ? error : new Error(String(error));
  console.error(failure);
  showFatal(failure);
});
