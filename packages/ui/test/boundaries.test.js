// @ts-nocheck
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, '..', 'src');
const packageRoot = join(here, '..');

/**
 * @param {string} directory
 * @returns {string[]}
 */
function listJavaScriptFiles(directory) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      files.push(...listJavaScriptFiles(path));
    } else if (entry.endsWith('.js')) {
      files.push(path);
    }
  }
  return files;
}

describe('@dice/ui boundaries', () => {
  const files = listJavaScriptFiles(sourceRoot);

  it('imports only @dice/core from the workspace', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = Array.from(
        source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g),
        (match) => match[1]
      );
      for (const specifier of specifiers) {
        if (specifier.startsWith('@dice/')) {
          expect(specifier, file).toBe('@dice/core');
        }
        expect(specifier, file).not.toMatch(/^(three|cannon-es)(\/|$)/);
        expect(specifier, file).not.toContain('legacy/');
      }
    }
  });

  it('never imports engine/runtime packages and never uses innerHTML', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /@dice\/(world|engine|physics|rendering|input|determinism)/
      );
      expect(source, file).not.toContain('innerHTML');
    }
  });

  it('exposes styles through the documented @dice/ui/styles/* subpath', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
    expect(manifest.exports['./styles/*']).toBe('./src/styles/*');

    for (const file of ['base.css', 'controls.css', 'banner.css', 'theme.css']) {
      const css = readFileSync(join(sourceRoot, 'styles', file), 'utf8');
      expect(css.length, file).toBeGreaterThan(0);
    }
    const banner = readFileSync(join(sourceRoot, 'styles', 'banner.css'), 'utf8');
    expect(banner).toContain('.dice-banner');
    const controls = readFileSync(join(sourceRoot, 'styles', 'controls.css'), 'utf8');
    expect(controls).toContain('.dice-control-panel');
  });

  it('is import-safe in Node without a DOM', async () => {
    const entry = await import('../src/index.js');
    expect(typeof entry.ResultBanner).toBe('function');
    expect(typeof entry.ControlPanel).toBe('function');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
