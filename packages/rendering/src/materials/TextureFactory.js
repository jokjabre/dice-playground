/**
 * @typedef {Object} DiceMaterialSpec
 * @property {number} shininess
 * @property {number} specular
 */

/**
 * @typedef {Object} DiceStyleLike
 * @property {string} bodyColor
 * @property {string} labelColor
 * @property {string} fontFamily
 * @property {DiceMaterialSpec} material
 * @property {number} textureSize
 */

/**
 * @typedef {Object} LabelTextureSpec
 * @property {string} text
 * @property {string} color
 * @property {string} backgroundColor
 * @property {string} fontFamily
 * @property {number} textureSize
 * @property {number} [margin]
 */

/**
 * @typedef {Object} MaterialSpec
 * @property {number|string} color
 * @property {number} shininess
 * @property {number} specular
 * @property {LabelTextureSpec} [label]
 * @property {any} [map] Backend texture handle, never serialized.
 */

/**
 * @typedef {Object} DiceMaterialSet
 * @property {MaterialSpec} chamfer
 * @property {Array<{ value: number, material: MaterialSpec }>} labels
 */

const DEFAULT_MARGIN = 1;

/**
 * Compute the legacy power-of-two texture size for an approximate pixel size.
 *
 * @param {number} approx
 * @returns {number}
 */
export function calcTextureSize(approx) {
  if (!(approx > 0)) {
    throw new RangeError('Texture size approximation must be greater than zero.');
  }
  return Math.pow(2, Math.floor(Math.log(approx) / Math.log(2)));
}

/**
 * Turn a dice style descriptor into serializable material specs. The r73
 * backend later converts these specs into real Three materials and textures.
 *
 * @param {{ style: DiceStyleLike, labels: number[] }} input
 * @returns {DiceMaterialSet}
 */
export function createDiceMaterialSet({ style, labels }) {
  if (!style) {
    throw new TypeError('createDiceMaterialSet requires a dice style.');
  }
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new RangeError('createDiceMaterialSet requires at least one label.');
  }

  /** @type {MaterialSpec} */
  const base = {
    color: style.bodyColor,
    shininess: style.material?.shininess ?? 30,
    specular: style.material?.specular ?? 0x172022
  };

  return {
    chamfer: { ...base },
    labels: labels.map((value) => ({
      value,
      material: {
        ...base,
        label: {
          text: String(value),
          color: style.labelColor,
          backgroundColor: style.bodyColor,
          fontFamily: style.fontFamily,
          textureSize: style.textureSize,
          margin: DEFAULT_MARGIN
        }
      }
    }))
  };
}

/**
 * Draws label textures on an offscreen canvas and hands them to the render
 * backend. Creating the class is safe in Node; the DOM is touched only when a
 * texture is requested.
 */
export class TextureFactory {
  /** @type {any} */
  #backend;

  /** @type {Document|null} */
  #document;

  /**
   * @param {{ backend: any, document?: Document|null }} options
   */
  constructor({ backend, document: documentRef } = /** @type {any} */ ({})) {
    if (!backend || typeof backend.createTexture !== 'function') {
      throw new TypeError('TextureFactory requires a render backend with createTexture.');
    }

    this.#backend = backend;
    this.#document =
      documentRef ?? (typeof document === 'undefined' ? null : document);
  }

  /**
   * @param {LabelTextureSpec} spec
   * @returns {any} Backend texture handle.
   */
  createLabelTexture(spec) {
    if (!spec || typeof spec.text !== 'string') {
      throw new TypeError('createLabelTexture requires a label spec with text.');
    }
    if (!this.#document) {
      throw new Error(
        'Label textures require a browser document. Importing @dice/rendering in Node does not create textures.'
      );
    }

    const canvas = this.#document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available for dice label textures.');
    }

    const size = Math.max(2, Math.round(spec.textureSize || 256));
    const margin = spec.margin ?? DEFAULT_MARGIN;
    canvas.width = size;
    canvas.height = size;

    context.font = `${size / (1 + 2 * margin)}pt ${spec.fontFamily || 'Arial'}`;
    context.fillStyle = spec.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = spec.color;
    context.fillText(spec.text, canvas.width / 2, canvas.height / 2);

    if (spec.text === '6' || spec.text === '9') {
      context.fillText('  .', canvas.width / 2, canvas.height / 2);
    }

    return this.#backend.createTexture(canvas);
  }

  /**
   * @param {Array<{ value: number, material: MaterialSpec }>} labels
   * @returns {Map<number, any>}
   */
  createLabelTextures(labels) {
    /** @type {Map<number, any>} */
    const textures = new Map();

    for (const entry of labels) {
      if (entry.material.label) {
        textures.set(entry.value, this.createLabelTexture(entry.material.label));
      }
    }

    return textures;
  }
}
