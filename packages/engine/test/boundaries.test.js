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

describe('@dice/engine boundaries', () => {
  const files = listJavaScriptFiles(sourceRoot);

  it('never imports ui, input, or determinism packages', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/@dice\/(ui|input|determinism)/);
      expect(source, file).not.toMatch(/@dice\/(physics|rendering|dice|enclosures)/);
    }
  });

  it('imports only core, world, and content from the workspace', () => {
    const allowed = ['@dice/core', '@dice/world', '@dice/content'];
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
        expect(specifier, file).not.toMatch(/^(three|cannon-es)(\/|$)/);
        expect(specifier, file).not.toContain('legacy/');
      }
    }
  });

  it('never touches backend globals and is import-safe in Node', async () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\b(?:THREE|CANNON)\s*[.(]/);
    }
    const entry = await import('../src/index.js');
    expect(typeof entry.createDiceEngine).toBe('function');
    expect(typeof entry.DiceEngine).toBe('function');
    expect(typeof globalThis.document).toBe('undefined');
    expect(typeof globalThis.window).toBe('undefined');
  });
});
