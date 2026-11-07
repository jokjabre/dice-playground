import { describe, expect, it } from 'vitest';

import {
  applyFaceMapping,
  buildDiceMaterials
} from '../src/backends/three-r73/buildMaterial.js';
import {
  TextureFactory,
  createDiceMaterialSet
} from '../src/materials/TextureFactory.js';

const style = {
  bodyColor: '#202020',
  labelColor: '#aaaaaa',
  fontFamily: 'Arial',
  material: { shininess: 30, specular: 0x172022 },
  textureSize: 64
};

describe('createDiceMaterialSet', () => {
  it('creates one chamfer spec and six label specs', () => {
    const materialSet = createDiceMaterialSet({
      style,
      labels: [1, 2, 3, 4, 5, 6]
    });

    expect(materialSet.chamfer.label).toBeUndefined();
    expect(materialSet.chamfer.color).toBe('#202020');
    expect(materialSet.labels).toHaveLength(6);
    expect(materialSet.labels.map((entry) => entry.value)).toEqual([
      1, 2, 3, 4, 5, 6
    ]);
    expect(materialSet.labels[0]?.material.label?.text).toBe('1');
    expect(materialSet.labels[5]?.material.label?.text).toBe('6');
  });

  it('rejects an empty label list', () => {
    expect(() => createDiceMaterialSet({ style, labels: [] })).toThrow(
      /at least one label/i
    );
  });
});

describe('buildDiceMaterials', () => {
  it('builds one chamfer material plus one material per label', () => {
    const materialSet = createDiceMaterialSet({
      style,
      labels: [1, 2, 3, 4, 5, 6]
    });
    /** @type {any[]} */
    const calls = [];

    const backend = {
      /** @param {any} spec */
      createMaterial(spec) {
        calls.push(spec);
        return { spec };
      }
    };
    const textureFactory = {
      /** @param {any} spec */
      createLabelTexture(spec) {
        return { textureFor: spec.text };
      }
    };

    const result = buildDiceMaterials({ backend, materialSet, textureFactory });

    expect(result.materials).toHaveLength(7);
    expect(calls).toHaveLength(7);
    expect(calls[0].map).toBeUndefined();
    expect(calls[1].map).toEqual({ textureFor: '1' });
    expect(result.labelSlots.get(6)).toBe(6);
  });
});

describe('applyFaceMapping', () => {
  it('rewrites material slots in place without cloning geometry', () => {
    const geometry = {
      faces: [
        { faceIndex: 0, materialIndex: 1 },
        { faceIndex: 1, materialIndex: 2 },
        { faceIndex: -1, materialIndex: 0 }
      ]
    };
    const labelSlots = new Map([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
      [6, 6]
    ]);

    const result = applyFaceMapping(geometry, [6, 5, 4, 3, 2, 1], labelSlots);

    expect(result).toBe(geometry);
    expect(geometry.faces[0].materialIndex).toBe(6);
    expect(geometry.faces[1].materialIndex).toBe(5);
    expect(geometry.faces[2].materialIndex).toBe(0);
  });
});

describe('TextureFactory', () => {
  it('draws a label canvas and hands it to the backend', () => {
    /** @type {Array<{ text: string, x: number, y: number }>} */
    const drawCalls = [];
    const context = {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect() {},
      /**
       * @param {string} text
       * @param {number} x
       * @param {number} y
       */
      fillText(text, x, y) {
        drawCalls.push({ text, x, y });
      }
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        return context;
      }
    };
    const documentRef = /** @type {any} */ ({
      /** @param {string} tag */
      createElement(tag) {
        expect(tag).toBe('canvas');
        return canvas;
      }
    });
    const backend = {
      /** @param {any} received */
      createTexture(received) {
        return { canvas: received };
      }
    };

    const factory = new TextureFactory({ backend, document: documentRef });
    const texture = factory.createLabelTexture({
      text: '6',
      color: '#aaaaaa',
      backgroundColor: '#202020',
      fontFamily: 'Arial',
      textureSize: 64
    });

    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    expect(drawCalls[0].text).toBe('6');
    expect(drawCalls[1].text).toBe('  .');
    expect(texture.canvas).toBe(canvas);
  });

  it('fails with a readable error without a document', () => {
    const factory = new TextureFactory({
      backend: { createTexture: () => ({}) },
      document: null
    });

    expect(() =>
      factory.createLabelTexture({
        text: '1',
        color: '#fff',
        backgroundColor: '#000',
        fontFamily: 'Arial',
        textureSize: 32
      })
    ).toThrow(/require a browser document/i);
  });
});
