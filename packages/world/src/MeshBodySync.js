/**
 * Copies each die's physics transform onto its visual handle.
 *
 * Dice entities already implement `sync()`, so this module is the explicit
 * composition point shared by the world's `sync()`/`step()` and by tests that
 * want to assert visual updates without a renderer.
 */
export class MeshBodySync {
  /**
   * @param {any} die DiceEntity-like object.
   * @returns {void}
   */
  static syncOne(die) {
    if (!die) return;
    if (typeof die.sync === 'function') {
      die.sync();
      return;
    }
    if (die.body && die.visual) {
      die.visual.setTransform({
        position: die.body.getPosition(),
        quaternion: die.body.getQuaternion()
      });
    }
  }

  /**
   * @param {any[]|null|undefined} dice
   * @returns {void}
   */
  static syncList(dice) {
    if (!dice) return;
    for (const die of dice) {
      MeshBodySync.syncOne(die);
    }
  }

  /**
   * Backwards-compatible alias for world code that thinks in scenes.
   *
   * @param {any[]|null|undefined} dice
   * @returns {void}
   */
  static syncScene(dice) {
    MeshBodySync.syncList(dice);
  }
}
