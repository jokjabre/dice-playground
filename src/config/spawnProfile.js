/**
 * Shared spawn profile describing which enclosure is active.
 * Enclosure activation (dice/objects/world.js) sets `mode`;
 * throw-vector generators adapt spawn positions so dice
 * start INSIDE the active boundary instead of above a flat tray.
 */
export const spawnProfile = {
    mode: 'box', // 'box' | 'sphere' | 'cylinder'
    radius: 700  // current enclosure radius (used by enclosed spawns)
};

/**
 * Compute a spawn position inside the active enclosure.
 * Box keeps the legacy tray behavior (edges, above the desk);
 * sphere/cylinder spawn near the upper-inner region so dice drop in cleanly.
 * @param {Object} rnd Random source with rnd() and make_random_vector? (only rnd used here)
 * @param {Object} vec Randomized direction vector (used by the box profile)
 * @param {Object} dimensions playingField.dimensions
 * @returns {{x:number, y:number, z:number}}
 */
export function makeSpawnPosition(rnd, vec, dimensions) {
    if (spawnProfile.mode === 'box') {
        const pos = {
            x: dimensions.scene_width * (vec.x > 0 ? -1 : 1) * 0.9,
            y: dimensions.scene_height * (vec.y > 0 ? -1 : 1) * 0.9,
            z: rnd.rnd() * 200 + 200
        };
        const projector = Math.abs(vec.x / vec.y);
        if (projector > 1.0) {
            pos.y /= projector;
        } else {
            pos.x *= projector;
        }
        return pos;
    }

    // Enclosed modes: spawn inside the upper region, away from the walls
    const r = spawnProfile.radius || 700;
    return {
        x: (rnd.rnd() * 2 - 1) * r * 0.28,
        y: (rnd.rnd() * 2 - 1) * r * 0.28,
        z: r * 0.4 + rnd.rnd() * r * 0.25
    };
}
