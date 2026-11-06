import { $t } from "../../teal.js";
import { SettingsRenderer } from "./settingsRenderer.js";
import { options } from "../../src/config/options.js";
import { dimensions, playingField } from "../../src/config/dimensions.js";
import { RenderScene } from "../../src/rendering/RenderScene.js";
import { CameraController } from "../../src/rendering/CameraController.js";
import { LightingRig } from "../../src/rendering/LightingRig.js";
import { MeshBodySync } from "../../src/rendering/MeshBodySync.js";

/**
 * Modular RenderScene wrapper.
 * Backwards compatible with legacy scene references across dice.js, main.js, and diceFactory.js,
 * powered internally by RenderScene, CameraController, LightingRig, and MeshBodySync.
 */
export const renderScene = new RenderScene({
    options: options
});

export const scene = {
    // Underlying THREE.Scene instance
    get instance() {
        return renderScene.instance;
    },

    // Underlying THREE.PerspectiveCamera instance
    get camera() {
        return renderScene.camera;
    },

    // Underlying renderer instance
    get renderer() {
        return renderScene.renderer;
    },

    // Lighting rig references
    get ambientLight() {
        return renderScene.lightingRig.ambientLight;
    },
    get light() {
        return renderScene.lightingRig.spotLight;
    },

    // Desk mesh
    get desk() {
        return renderScene.desk;
    },

    renderScene: renderScene,

    add: function (item) {
        renderScene.add(item);
    },

    remove: function (item) {
        renderScene.remove(item);
    },

    recreate_ambient_light: function () {
        // Handled via lightingRig
    },

    recreate_camera: function () {
        renderScene.cameraController.update(playingField.dimensions, options);
    },

    render_once: function () {
        renderScene.render();
    },

    recreate_light: function () {
        renderScene.lightingRig.update(playingField.dimensions);
    },

    recreate_desk: function () {
        const w2 = playingField.dimensions.scene_width * 2;
        const h2 = playingField.dimensions.scene_height * 2;
        if (w2 > 0 && h2 > 0) {
            if (this.desk.geometry) {
                this.desk.geometry.dispose();
            }
            this.desk.geometry = new THREE.PlaneGeometry(w2, h2, 1, 1);
            this.desk.material.color = new THREE.Color(options.colors.desk);
            this.desk.receiveShadow = options.use_shadows;
        }
    },

    recreate_renderer: function () {
        if (this.renderer) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            this.renderer.setClearColor(0xffffff, 1);
            this.renderer.setSize(
                playingField.dimensions.scene_width * 2,
                playingField.dimensions.scene_height * 2
            );
        }
    },

    rerender: function () {
        renderScene.updateDimensions(playingField.dimensions);
        renderScene.render();

        if (typeof $t === 'undefined' || !$t.writeDebugInfo) return;
        const settingsElem = document.getElementById("settings");
        if (!settingsElem) return;

        let ren = new SettingsRenderer();

        ["position", "rotation"].forEach(prop => {
            ren.addVector(this.camera[prop], `camera_${prop}`, (vector) => {
                this.camera[prop].set(vector.x, vector.y, vector.z);
                this.camera.updateProjectionMatrix();
            });
        });

        ren.addVector(this.camera.quaternion, "camera_quaternion", (vector) => {
            vector.divideScalar(100);
            this.camera.quaternion.set(vector.x, vector.y, vector.z, this.camera.quaternion.w);
            this.camera.updateProjectionMatrix();
        });

        ["far", "fov"].forEach(prop => {
            ren.add(this.camera[prop], `camera_${prop}`, (val) => {
                this.camera[prop] = val;
                this.camera.updateProjectionMatrix();
            });
        });
    }
};

export { CameraController, LightingRig, MeshBodySync, RenderScene };
