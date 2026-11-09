import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(repoRoot, 'dist');
const registryPath = path.join(repoRoot, 'apps/registry.json');

const validStatuses = new Set(['planned', 'wip', 'live', 'archived']);
const validCategories = new Set(['landing', 'sandbox', 'demo', 'game']);

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {unknown} registry
 * @returns {any[]}
 */
function validateRegistry(registry) {
  if (!Array.isArray(registry)) {
    throw new Error('apps/registry.json must contain an array');
  }

  const ids = new Set();

  for (const app of registry) {
    for (const field of ['id', 'category', 'title', 'description', 'path', 'url', 'status']) {
      if (typeof app[field] !== 'string') {
        throw new Error(`registry entry ${app.id ?? '<unknown>'} is missing string field "${field}"`);
      }
    }

    if (ids.has(app.id)) {
      throw new Error(`duplicate registry id "${app.id}"`);
    }
    ids.add(app.id);

    if (!validCategories.has(app.category)) {
      throw new Error(`registry entry "${app.id}" has invalid category "${app.category}"`);
    }
    if (!validStatuses.has(app.status)) {
      throw new Error(`registry entry "${app.id}" has invalid status "${app.status}"`);
    }
    if (app.category !== 'landing' && app.url.length === 0) {
      throw new Error(`registry entry "${app.id}" requires a non-empty url`);
    }
    if (app.url.startsWith('/')) {
      throw new Error(`registry entry "${app.id}" url must be relative to the Pages base`);
    }
  }

  return registry;
}

const registry = validateRegistry(
  JSON.parse(await readFile(registryPath, 'utf8'))
);

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const liveApps = registry.filter((app) => app.status === 'live');

if (liveApps.length === 0) {
  await writeFile(path.join(distDir, '.nojekyll'), '');
  console.log('build-apps: no live apps in apps/registry.json; wrote empty dist/.nojekyll');
  process.exit(0);
}

const { build } = await import('vite');

const landing = liveApps.find((app) => app.category === 'landing');
const contentApps = liveApps.filter((app) => app.category !== 'landing');
const builtRoutes = [];

for (const app of contentApps) {
  const indexPath = path.join(repoRoot, app.path, 'index.html');
  const configFile = path.join(repoRoot, app.path, 'vite.config.js');

  if (!(await exists(indexPath))) {
    throw new Error(`live app "${app.id}" has no ${app.path}/index.html`);
  }
  if (!(await exists(configFile))) {
    throw new Error(`live app "${app.id}" has no ${app.path}/vite.config.js`);
  }

  await build({ configFile, mode: 'production' });

  const outputIndex = path.join(distDir, app.url, 'index.html');
  if (!(await exists(outputIndex))) {
    throw new Error(`build for "${app.id}" produced no dist/${app.url}index.html`);
  }
  builtRoutes.push(app.url);
}

if (landing) {
  const indexPath = path.join(repoRoot, landing.path, 'index.html');
  const configFile = path.join(repoRoot, landing.path, 'vite.config.js');

  if (!(await exists(indexPath))) {
    throw new Error(`live app "${landing.id}" has no ${landing.path}/index.html`);
  }
  if (!(await exists(configFile))) {
    throw new Error(`live app "${landing.id}" has no ${landing.path}/vite.config.js`);
  }

  await build({ configFile, mode: 'production' });

  if (!(await exists(path.join(distDir, 'index.html')))) {
    throw new Error('landing build produced no dist/index.html');
  }
  builtRoutes.unshift('');
}

await writeFile(path.join(distDir, '.nojekyll'), '');

console.log('build-apps: built routes');
for (const route of builtRoutes) {
  console.log(`  /${route}`);
}
