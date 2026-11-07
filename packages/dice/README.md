# `@dice/dice`

Pure dice domain package: stable die definitions, chamfered mesh data,
collision descriptors, face mapping, face reading, `DiceEntity`, and style
descriptors.

The package depends only on `@dice/core`. It never imports Three.js, Cannon,
the DOM, or a rendering/physics backend.

## Public entry

```js
import {
  D6,
  DiceRegistry,
  createDiceRegistry,
  createDiceMeshData,
  createDiceCollisionData,
  FaceReader,
  DiceEntity,
  getDiceStyle
} from '@dice/dice';

const mesh = createDiceMeshData(D6, { radius: 90 });
const collision = createDiceCollisionData(D6, { radius: 90 });
const value = FaceReader.getValue(D6, quaternion, D6.createFaceMapping());
```

## Definitions

`D6` is the built-in definition. It declares eight base vertices, six geometric
faces with outward normals and default labels `1..6`, a chamfer factor, and a
label range. Opposite faces sum to seven, matching the legacy cube ordering.

`DiceRegistry` is an explicit registry with no module-level singleton:

```js
const registry = createDiceRegistry(); // contains d6
registry.get('d6');
registry.register(customDefinition);
```

Unknown ids and duplicate registrations throw a `DiceError`.

## Mesh and collision data

`createDiceMeshData(definition, { radius })` returns plain data:

```js
{
  vertices: [{ x, y, z }],
  faces: [{
    faceIndex: 0,          // -1 for chamfer triangles
    indices: [0, 1, 2],
    materialSlot: 1,       // 0 for chamfer, 1..N for labels
    normal: { x, y, z },
    uvs: [{ x, y }, { x, y }, { x, y }]
  }],
  boundingRadius: radius
}
```

A D6 produces 24 chamfered vertices and 44 triangles: two triangles per base
face plus 32 chamfer triangles. Every triangle has an outward normal.

`createDiceCollisionData(definition, { radius })` returns a convex descriptor
using the un-chamfered base polyhedron, ready for the physics package:

```js
{
  type: 'convex',
  vertices: [{ x, y, z }],
  faces: [[0, 3, 2, 1]],
  faceIndices: [0],
  boundingRadius: radius
}
```

## Face mapping

`faceMapping[geometricFaceIndex] = displayedLabel` is a complete permutation of
the definition labels. The default D6 mapping is `[1, 2, 3, 4, 5, 6]`.

- `createFaceMapping(definition)` returns a validated default mapping.
- `assertFaceMapping(definition, mapping)` rejects incomplete permutations.
- `shiftFaceMapping(definition, mapping, offset)` rotates labels within the
  label range.
- `createShiftedFaceMapping(definition, mapping, natural, target)` makes a face
  that naturally showed `natural` display `target`.

Material slots are separate: slot `0` is the chamfer material, and slots `1..N`
correspond to the sorted definition labels. Renderers combine `faceIndex` with
the mapping, so a mapping change never clones geometry.

## FaceReader

`FaceReader` reads the top face from a body quaternion and the definition
normals; it does not traverse mesh triangles.

```js
FaceReader.getTopFace(definition, quaternion, up);
FaceReader.getValue(definition, quaternion, faceMapping, up);
FaceReader.getValues(dice, up);
```

The default up vector is world Z.

## DiceEntity

`DiceEntity` stores an id assigned by the world, its definition, a physics body
handle, a visual handle, the current face mapping, selection state, and lifecycle
state. It delegates transforms and mappings through the handles and exposes a
read-only `value`.

## Styles

`DICE_STYLES` contains serializable `classic` and `dark` descriptors.
`getDiceStyle(id)` resolves one by id. Texture and material creation belong to
`@dice/rendering`.

## Tests

```bash
npm test --workspace @dice/dice
```
