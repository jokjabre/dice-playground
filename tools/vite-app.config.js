import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(repoRoot, 'apps/registry.json');

/**
 * @typedef {object} AppConfigOptions
 * @property {string} id Registry id.
 * @property {number} port Dev/preview port for this app.
 * @property {string} [basePath] Pages base path. Defaults to BASE_PATH or `/`.
 * @property {object} [config] Extra Vite config merged last.
 */

/**
 * @param {string} basePath
 * @returns {string}
 */
function normalizeBase(basePath) {
  if (!basePath || basePath === '/') return '/';
  return `/${basePath.replace(/^\/+|\/+$/g, '')}/`;
}

/**
 * Build a Vite config for one registry app.
 *
 * @param {AppConfigOptions} options
 */
export function createAppConfig({
  id,
  port,
  basePath = process.env.BASE_PATH || '/',
  config = {}
}) {
  /** @type {Array<{ id: string, path: string, url: string }>} */
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const app = registry.find((entry) => entry.id === id);

  if (!app) {
    throw new Error(`Unknown app id "${id}" in apps/registry.json`);
  }

  const base = `${normalizeBase(basePath)}${app.url}`;
  const root = path.resolve(repoRoot, app.path);
  const outDir = path.resolve(repoRoot, 'dist', app.url);

  return mergeConfig(
    {
      root,
      base,
      server: {
        port,
        strictPort: true
      },
      preview: {
        port,
        strictPort: true
      },
      build: {
        outDir,
        emptyOutDir: false,
        sourcemap: false
      },
      resolve: {
        alias: {
          '@registry': registryPath
        }
      }
    },
    config
  );
}
