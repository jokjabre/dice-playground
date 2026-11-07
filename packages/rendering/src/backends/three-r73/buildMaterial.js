/**
 * @typedef {import('../../materials/TextureFactory.js').DiceMaterialSet} DiceMaterialSet
 * @typedef {import('../../materials/TextureFactory.js').MaterialSpec} MaterialSpec
 */

/**
 * @param {MaterialSpec} spec
 * @returns {MaterialSpec}
 */
function withoutLabel(spec) {
  const { label: _label, ...rest } = spec;
  return rest;
}

/**
 * Build the ordered r73 material list for a die.
 *
 * Slot `0` is the chamfer material. Slots `1..N` follow the `labels` order in
 * the material set, which `@dice/dice` derives from the sorted default labels.
 *
 * @param {{ backend: any, materialSet: DiceMaterialSet, textureFactory: { createLabelTexture: (spec: any) => any } }} options
 * @returns {{ materials: any[], labelSlots: Map<number, number> }}
 */
export function buildDiceMaterials(options) {
  const { backend, materialSet, textureFactory } = options;

  if (!materialSet || !materialSet.chamfer || !Array.isArray(materialSet.labels)) {
    throw new TypeError('buildDiceMaterials requires a DiceMaterialSet.');
  }

  const chamfer = backend.createMaterial(withoutLabel(materialSet.chamfer));
  /** @type {Map<number, number>} */
  const labelSlots = new Map();
  /** @type {any[]} */
  const materials = [chamfer];

  materialSet.labels.forEach((entry, index) => {
    const spec = withoutLabel(entry.material);
    const map = entry.material.label
      ? textureFactory.createLabelTexture(entry.material.label)
      : undefined;

    materials.push(backend.createMaterial({ ...spec, map }));
    labelSlots.set(entry.value, index + 1);
  });

  return { materials, labelSlots };
}

/**
 * Reassign every triangle's material slot from the current face mapping. This
 * mutates the existing geometry in place; no geometry is cloned.
 *
 * `faceMapping[geometricFaceIndex] = displayedLabel`.
 *
 * @param {any} geometry Backend geometry whose faces expose `faceIndex`.
 * @param {number[]} faceMapping
 * @param {Map<number, number>} labelSlots
 * @returns {any} The same geometry.
 */
export function applyFaceMapping(geometry, faceMapping, labelSlots) {
  if (!geometry || !Array.isArray(geometry.faces)) {
    throw new TypeError('applyFaceMapping requires a geometry with faces.');
  }
  if (!Array.isArray(faceMapping)) {
    throw new TypeError('applyFaceMapping requires a face mapping array.');
  }

  for (const face of geometry.faces) {
    if (face.faceIndex < 0) {
      face.materialIndex = 0;
      continue;
    }

    const label = faceMapping[face.faceIndex];
    const slot = labelSlots.get(label);
    if (slot === undefined) {
      throw new Error(
        `Face mapping label ${String(label)} has no material slot for geometric face ${face.faceIndex}.`
      );
    }
    face.materialIndex = slot;
  }

  return geometry;
}
