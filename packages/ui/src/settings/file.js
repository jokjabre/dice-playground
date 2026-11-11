/**
 * Framework-agnostic DOM helpers for settings file import/export.
 * Safe to import in Node (no document access at module load).
 */

/**
 * Trigger a client-side download of a text payload.
 *
 * @param {string} filename
 * @param {string} content
 * @param {{ mimeType?: string }} [options]
 * @returns {void}
 */
export function downloadTextFile(filename, content, options = {}) {
  if (typeof document === 'undefined') {
    throw new Error('downloadTextFile requires a DOM document.');
  }
  const mimeType = options.mimeType ?? 'application/json';
  const blob = new Blob([String(content ?? '')], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'settings.json';
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Download a JSON-serializable value as a .json file.
 *
 * @param {string} filename
 * @param {unknown} value
 * @param {{ pretty?: number|boolean }} [options]
 * @returns {string} serialized JSON
 */
export function downloadJsonFile(filename, value, options = {}) {
  const space =
    options.pretty === true ? 2 : typeof options.pretty === 'number' ? options.pretty : 2;
  const json = typeof value === 'string' ? value : JSON.stringify(value, null, space);
  downloadTextFile(filename, json, { mimeType: 'application/json' });
  return json;
}

/**
 * Open a file picker and read a single file as text.
 *
 * @param {{ accept?: string }} [options]
 * @returns {Promise<{ name: string, text: string, file: File }>}
 */
export function pickTextFile(options = {}) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('pickTextFile requires a DOM document.'));
  }
  const accept = options.accept ?? '.json,application/json';
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';

    const cleanup = () => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      if (input.parentNode) input.parentNode.removeChild(input);
    };
    const onCancel = () => {
      cleanup();
      reject(new Error('File selection cancelled.'));
    };
    const onChange = () => {
      const file = input.files && input.files[0];
      cleanup();
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, text: String(reader.result ?? ''), file });
      };
      reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
      reader.readAsText(file);
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Pick and parse a JSON file.
 *
 * @param {{ accept?: string }} [options]
 * @returns {Promise<{ name: string, text: string, data: any, file: File }>}
 */
export async function pickJsonFile(options = {}) {
  const picked = await pickTextFile(options);
  let data;
  try {
    data = JSON.parse(picked.text);
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(/** @type {any} */ (e).message) : String(e);
    throw new Error(`Invalid JSON in "${picked.name}": ${msg}`);
  }
  return { ...picked, data };
}
