export class RndGen {
    constructor(config = {}) {
        this.random_storage = [];
        this.use_true_random = config.use_true_random || false;
    }

    rnd() {
        if (this.use_true_random && this.random_storage.length > 0) {
            return this.random_storage.pop();
        }
        return Math.random();
    }

    make_random_vector(vector) {
        const random_angle = (this.rnd() * Math.PI) / 5 - Math.PI / 5 / 2;
        const vec = {
            x: vector.x * Math.cos(random_angle) - vector.y * Math.sin(random_angle),
            y: vector.x * Math.sin(random_angle) + vector.y * Math.cos(random_angle)
        };
        if (vec.x === 0) vec.x = 0.01;
        if (vec.y === 0) vec.y = 0.01;
        return vec;
    }
}

export const rndGen = new RndGen();
export default rndGen;
