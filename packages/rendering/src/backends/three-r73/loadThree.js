import vendorUrl from '../../../vendor/three-r73/three.min.js?url';

/** @type {Promise<any>|null} */
let loadPromise = null;

/**
 * @typedef {Object} LoadThreeOptions
 * @property {Document|null} [document]
 * @property {any} [global]
 */

/**
 * Load the vendored Three r73 UMD build once and resolve the global namespace.
 *
 * The script URL is emitted by Vite as a base-aware hashed asset. The promise
 * is cached so multiple engine instances share a single `<script>` tag.
 *
 * @param {LoadThreeOptions} [options]
 * @returns {Promise<any>}
 */
export function loadThree(options = {}) {
  const globalRef = options.global ?? /** @type {any} */ (globalThis);
  const documentRef =
    options.document ??
    (typeof document === 'undefined' ? null : document);

  if (globalRef.THREE) {
    return Promise.resolve(globalRef.THREE);
  }

  if (loadPromise) {
    return loadPromise;
  }

  if (!documentRef) {
    return Promise.reject(
      new Error(
        'Failed to load vendored Three r73: no browser document is available.'
      )
    );
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = documentRef.createElement('script');
    script.src = vendorUrl;
    script.async = true;

    script.onload = () => {
      if (globalRef.THREE) {
        resolve(globalRef.THREE);
        return;
      }
      loadPromise = null;
      reject(
        new Error('Vendored Three r73 loaded without exposing a THREE global.')
      );
    };

    script.onerror = () => {
      loadPromise = null;
      reject(
        new Error(`Failed to load vendored Three r73 from ${vendorUrl}.`)
      );
    };

    documentRef.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Clear the cached loader promise. Intended for tests that simulate a failed
 * first load in the same process.
 *
 * @returns {void}
 */
export function resetThreeLoader() {
  loadPromise = null;
}

export { vendorUrl };
