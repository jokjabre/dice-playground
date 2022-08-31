export const physics = {

    world_gravity: {
        x: 0,
        y: 0, // -9.8 * 200,
        z: -9.8 * 300, // -9.8 * 120
    },
    die_mass: 300,
    die_inertia: 13,

    //friction between a die and other materials
    die_friction: {
        die: 0,
        desk: 0.01,
        barrier_left: 0,
        barrier_right: 0,
        barrier_top: 0,
        barrier_bottom: 0,
        screen: 0
    },

    //restitution between a die and other materials
    die_restitution: {
        die: 0.5,
        desk: 0.5,
        barrier_left : 1.0,
        barrier_right : 1.0,
        barrier_top : 1.0,
        barrier_bottom : 1.0,
        screen: 0.5
    }

}
