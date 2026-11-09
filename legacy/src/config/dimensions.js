export class DimensionsManager {
    constructor() {
        this.scene_width = 0;
        this.scene_height = 0;
        this.scale = 1;
        this.aspect = 1;
        this.container_width = 0;
        this.container_height = 0;
        this.wall_height = 0;
    }

    re_init(container, dimensions) {
        this.container_width = container.clientWidth / 2;
        this.container_height = container.clientHeight / 2;

        if (dimensions) {
            this.scene_width = dimensions.w;
            this.scene_height = dimensions.h;
        } else {
            this.scene_width = this.container_width;
            this.scene_height = this.container_height;
        }

        this.aspect = Math.min(
            this.container_width / this.scene_width,
            this.container_height / this.scene_height
        );
        this.scale = Math.sqrt(
            this.scene_width * this.scene_width + this.scene_height * this.scene_height
        ) / 13;

        this.wall_height = this.container_height / this.aspect / Math.tan((10 * Math.PI) / 180);
    }
}

export const dimensions = new DimensionsManager();
export const playingField = {
    dimensions: dimensions
};
export default dimensions;

