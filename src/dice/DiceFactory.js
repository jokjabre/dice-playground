/**
 * DiceFactory
 * Spawns, initializes, and recycles DiceEntity instances.
 * Manages material caching and creates D6 dice meshes and physics bodies.
 */

import { GeometryBuilder } from "./GeometryBuilder.js";
import { TextureGenerator } from "./TextureGenerator.js";
import { DiceEntity } from "./DiceEntity.js";

export class DiceFactory {
    /**
     * @param {Object} [config={}]
     * @param {Object} [config.options] - Global or custom engine options
     * @param {Object} [config.dimensions] - Dimensions manager
     * @param {Object} [config.physics] - Physics parameters (die_mass, etc.)
     * @param {Object} [config.physicsWorld] - PhysicsWorld instance
     * @param {Object} [config.renderScene] - RenderScene instance
     */
    constructor(config = {}) {
        this.options = config.options || {};
        this.dimensions = config.dimensions || null;
        this.physicsConfig = config.physics || { die_mass: 300 };
        this.physicsWorld = config.physicsWorld || null;
        this.renderScene = config.renderScene || null;

        this.diceEntities = [];
        this.cachedMaterials = new Map();
        this.cachedGeometries = new Map();
    }

    /**
     * Get active dice meshes (backwards compatibility for scene.raycaster, etc.)
     */
    get dices() {
        return this.diceEntities.map(d => d.mesh);
    }

    /**
     * Retrieves or builds the shared face materials.
     * @param {Object} [styleOverrides={}]
     * @returns {THREE.MeshFaceMaterial}
     */
    getFaceMaterial(styleOverrides = {}) {
        const colors = (this.options && this.options.colors) || {};
        const labelColor = styleOverrides.diceLabelColor || colors.dice_label || '#250000';
        const bodyColor = styleOverrides.diceBodyColor || colors.dice_body || '#aaaaaa';
        const materialOptions = Object.assign({}, (this.options && this.options.material_options) || {}, styleOverrides.materialOptions || {});

        const scale = (this.dimensions && this.dimensions.dimensions && this.dimensions.dimensions.scale) || 100;
        const cacheKey = `${labelColor}_${bodyColor}_${scale}`;

        if (!this.cachedMaterials.has(cacheKey)) {
            const faceLabels = [" ", "0", "1", "2", "3", "4", "5", "6"];
            const materials = TextureGenerator.createFaceMaterials(faceLabels, {
                size: scale / 2,
                margin: 1.0,
                diceLabelColor: labelColor,
                diceBodyColor: bodyColor,
                materialOptions: materialOptions
            });
            this.cachedMaterials.set(cacheKey, new THREE.MeshFaceMaterial(materials));
        }

        return this.cachedMaterials.get(cacheKey);
    }

    /**
     * Retrieves or builds the D6 chamfered geometry for the current scale.
     * @param {number} [radius]
     * @returns {THREE.Geometry}
     */
    getD6Geometry(radius) {
        if (!radius) {
            const scale = (this.dimensions && this.dimensions.dimensions && this.dimensions.dimensions.scale) || 100;
            radius = scale * 0.9;
        }

        const cacheKey = `d6_${radius}`;
        if (!this.cachedGeometries.has(cacheKey)) {
            const geom = GeometryBuilder.createD6Geometry(radius);
            this.cachedGeometries.set(cacheKey, geom);
        }

        return this.cachedGeometries.get(cacheKey);
    }

    /**
     * Creates a new DiceEntity, instantiating Three.js Mesh and Cannon.js RigidBody.
     * @param {Object} [params={}]
     * @param {Object} [params.pos={x:0, y:0, z:0}]
     * @param {Object} [params.velocity={x:0, y:0, z:0}]
     * @param {Object} [params.angle={x:0, y:0, z:0}]
     * @param {Object} [params.axis={x:0, y:0, z:1, a:0}]
     * @param {THREE.MeshFaceMaterial} [params.material]
     * @param {CANNON.Material} [params.bodyMaterial]
     * @returns {DiceEntity}
     */
    createDice(params = {}) {
        const pos = params.pos || { x: 0, y: 0, z: 0 };
        const velocity = params.velocity || { x: 0, y: 0, z: 0 };
        const angle = params.angle || { x: 0, y: 0, z: 0 };
        const axis = params.axis || { x: 0, y: 0, z: 1, a: 0 };

        const geometry = this.getD6Geometry();
        const material = params.material || this.getFaceMaterial();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;

        const bodyMass = (this.physicsConfig && this.physicsConfig.die_mass !== undefined)
            ? this.physicsConfig.die_mass
            : 300;

        const bodyMaterial = params.bodyMaterial || (
            this.physicsWorld && this.physicsWorld.objects
                ? this.physicsWorld.objects.dice_body_material
                : undefined
        );

        const body = new CANNON.RigidBody(bodyMass, geometry.cannon_shape, bodyMaterial);
        body.position.set(pos.x, pos.y, pos.z);
        body.quaternion.setFromAxisAngle(
            new CANNON.Vec3(axis.x, axis.y, axis.z),
            (axis.a !== undefined ? axis.a : 0) * Math.PI * 2
        );
        body.angularVelocity.set(angle.x, angle.y, angle.z);
        body.velocity.set(velocity.x, velocity.y, velocity.z);
        body.linearDamping = 0.1;
        body.angularDamping = 0.1;

        const entity = new DiceEntity(mesh, body);
        this.diceEntities.push(entity);

        // Add to render scene and physics world if present
        if (this.renderScene) {
            if (this.renderScene.add) {
                this.renderScene.add(mesh);
            } else if (this.renderScene.instance) {
                this.renderScene.instance.add(mesh);
            }
        }
        if (this.physicsWorld) {
            if (this.physicsWorld.add) {
                this.physicsWorld.add(body);
            } else if (this.physicsWorld.instance) {
                this.physicsWorld.instance.add(body);
            }
        }

        return entity;
    }

    /**
     * Clears all active dice from world and scene.
     */
    clear() {
        while (this.diceEntities.length > 0) {
            const entity = this.diceEntities.pop();
            if (this.renderScene) {
                if (this.renderScene.remove) {
                    this.renderScene.remove(entity.mesh);
                } else if (this.renderScene.instance) {
                    this.renderScene.instance.remove(entity.mesh);
                }
            }
            if (this.physicsWorld) {
                if (this.physicsWorld.remove) {
                    this.physicsWorld.remove(entity.body);
                } else if (this.physicsWorld.instance) {
                    this.physicsWorld.instance.remove(entity.body);
                }
            }
        }
    }
}

