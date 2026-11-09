/**
 * Ordered collection of dice plus the first-class selection (held/kept) model.
 * `selected` is the only held model; there is no separate `held` state.
 */
export class DiceSet {
  /** @type {any[]} */
  #dice = [];

  /**
   * @returns {any[]}
   */
  get dice() {
    return [...this.#dice];
  }

  /**
   * @returns {number}
   */
  get size() {
    return this.#dice.length;
  }

  /**
   * @param {any} die
   * @returns {void}
   */
  add(die) {
    if (!die) return;
    this.#dice.push(die);
  }

  /**
   * Remove dice by id and return the removed dice.
   *
   * @param {string[]} ids
   * @returns {any[]}
   */
  remove(ids) {
    const wanted = new Set(ids);
    /** @type {any[]} */
    const removed = [];
    this.#dice = this.#dice.filter((die) => {
      if (wanted.has(die.id)) {
        removed.push(die);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * Remove and return every die.
   *
   * @returns {any[]}
   */
  clear() {
    const removed = this.#dice;
    this.#dice = [];
    return removed;
  }

  /**
   * @returns {any[]}
   */
  getDice() {
    return [...this.#dice];
  }

  /**
   * @returns {string[]}
   */
  getDiceIds() {
    return this.#dice.map((die) => die.id);
  }

  /**
   * @param {string} id
   * @returns {any|null}
   */
  getById(id) {
    return this.#dice.find((die) => die.id === id) ?? null;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  has(id) {
    return this.#dice.some((die) => die.id === id);
  }

  /**
   * @returns {string[]}
   */
  getSelection() {
    return this.#dice.filter((die) => die.selected).map((die) => die.id);
  }

  /**
   * Replace the selection. Unknown ids are ignored so partial rerolls with
   * stale ids stay safe.
   *
   * @param {string[]} ids
   * @returns {{ selected: string[], changed: string[] }}
   */
  setSelection(ids) {
    const wanted = new Set(ids ?? []);
    /** @type {string[]} */
    const changed = [];

    for (const die of this.#dice) {
      const next = wanted.has(die.id);
      if (die.selected !== next) {
        die.selected = next;
        changed.push(die.id);
      }
    }

    return { selected: this.getSelection(), changed };
  }

  /**
   * @param {string} id
   * @returns {{ selected: boolean, dieId: string }|null}
   */
  toggleSelection(id) {
    const die = this.getById(id);
    if (!die) return null;
    die.selected = !die.selected;
    return { selected: die.selected, dieId: die.id };
  }
}
