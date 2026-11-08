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

describe('@dice/world boundaries', () => {
  const files = listJavaScriptFiles(sourceRoot);

  it('imports only allowed workspace packages', () => {
    const allowed = ['@dice/core', '@dice/physics', '@dice/rendering', '@dice/dice', '@dice/enclosures'];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const specifiers = Array.from(
        source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g),
        (match) => match[1]
      );

      for (const specifier of specifiers) {
        if (specifier.startsWith('@dice/')) {
          expect(allowed, file).toContain(specifier);
        }
        expect(specifier, file).not.toContain('legacy/');
        // Only physics imports cannon-es and only rendering imports Three;
        // the world consumes their public entries instead.
        expect(specifier, file).not.toMatch(/^(three|cannon-es)(\/|$)/);
      }
    }
  });

  it('never imports content, input, determinism, ui, or engine packages', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/@dice\/(content|input|determinism|ui|engine)/);
    }
  });

  it('has no direct DOM access', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:document|window|navigator)\s*[.(]/);
      expect(source, file).not.toMatch(/\b(?:THREE|CANNON)\s*[.(]/);
      // The world never reads layout dimensions itself.
      expect(source, file).not.toMatch(/clientWidth|clientHeight/);
    }
  });

  it('is import-safe in Node without a DOM', async () => {
    const entry = await import('../src/index.js');
    expect(typeof entry.World).toBe('function');
    expect(typeof globalThis.document).toBe('undefined');
  });
});
