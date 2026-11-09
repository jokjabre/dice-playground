/**
 * Plain-data descriptor types shared by the render scene and backends.
 *
 * @typedef {Object} Vec3Like
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} TableDescriptor
 * @property {'plane'} type
 * @property {number} width
 * @property {number} height
 * @property {number|string} [color]
 * @property {boolean} [receiveShadow]
 */

/**
 * @typedef {Object} BoxOutlineDescriptor
 * @property {'box-outline'} type
 * @property {number} width
 * @property {number} height
 * @property {number} depth
 * @property {number|string} [color]
 * @property {number} [opacity]
 */

/**
 * @typedef {Object} SphereShellDescriptor
 * @property {'sphere-shell'} type
 * @property {number} radius
 * @property {number|string} [color]
 * @property {number} [opacity]
 */

/**
 * @typedef {Object} CylinderShellDescriptor
 * @property {'cylinder-shell'} type
 * @property {number} radius
 * @property {number} height
 * @property {number|string} [color]
 * @property {number} [opacity]
 */

/**
 * @typedef {BoxOutlineDescriptor|SphereShellDescriptor|CylinderShellDescriptor} EnclosureVisualDescriptor
 */

/**
 * @typedef {Object} AmbientLightDescriptor
 * @property {'ambient'} type
 * @property {number|string} [color]
 * @property {number} [intensity]
 */

/**
 * @typedef {Object} SpotLightDescriptor
 * @property {'spot'} type
 * @property {number|string} [color]
 * @property {number} [intensity]
 * @property {Vec3Like} [position]
 * @property {Vec3Like} [target]
 * @property {boolean} [castShadow]
 */

/**
 * @typedef {AmbientLightDescriptor|SpotLightDescriptor} LightDescriptor
 */

/**
 * @typedef {Object} VisualHandle
 * @property {string} id
 * @property {(transform: { position: Vec3Like, quaternion: { x: number, y: number, z: number, w: number } }) => void} setTransform
 * @property {(mapping: number[]) => void} setFaceMapping
 * @property {(visible: boolean) => void} setVisible
 * @property {() => void} dispose
 */

export {};
