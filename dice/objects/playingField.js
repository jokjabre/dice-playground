const playingField = {
    dimensions: {
        scene_width: undefined,
        scene_height: undefined,
        scale: undefined,
        aspect: undefined,
        container_width: undefined,
        container_height: undefined,
        wall_height: undefined,

        re_init: function(container, dimensions) {
            this.container_width = container.clientWidth / 2;
            this.container_height = container.clientHeight / 2;

            if (dimensions) {
                this.scene_width = dimensions.w;
                this.scene_height = dimensions.h;
            }
            else {
                this.scene_width = this.container_width;
                this.scene_height = this.container_height;
            }

            this.aspect = Math.min(this.container_width / this.scene_width, this.container_height / this.scene_height);
            this.scale = Math.sqrt(this.scene_width * this.scene_width + this.scene_height * this.scene_height) / 13;

            this.wall_height = this.container_height / this.aspect / Math.tan(10 * Math.PI / 180);
        },

    },

}