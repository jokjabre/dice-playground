// @ts-nocheck
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, '..', 'src');

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

describe('@dice/content boundaries', () => {
  const files = listJavaScriptFiles(sourceRoot);

  it('imports only @dice/core and @dice/dice from the workspace', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = Array.from(
        source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g),
        (match) => match[1]
      );
      for (const specifier of specifiers) {
        if (specifier.startsWith('@dice/')) {
          expect(['@dice/core', '@dice/dice'], file).toContain(specifier);
        }
        expect(specifier, file).not.toMatch(/^(three|cannon-es)(\/|$)/);
        expect(specifier, file).not.toContain('legacy/');
      }
    }
  });

  it('never imports physics, rendering, world, engine, input, determinism, or ui', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(
        /@dice\/(physics|rendering|world|engine|input|determinism|ui)/
      );
    }
  });

  it('has no DOM or backend access and is import-safe in Node', async () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:document|window|navigator)\s*[.(]/);
      expect(source, file).not.toMatch(/\b(?:THREE|CANNON)\s*[.(]/);
    }
    const entry = await import('../src/index.js');
    expect(typeof entry.defineContentPack).toBe('function');
    expect(typeof entry.classicTray).toBe('object');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
