/**
 * Hash arbitrary seed material to a 32-bit unsigned state.
 *
 * @param {string|number} seed
 * @returns {number}
 */
function seedToState(seed) {
  if (typeof seed === 'number') {
    return seed >>> 0;
  }

  const text = String(seed);
  let hash = 1779033703 ^ text.length;

  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/**
 * Mulberry32 generator.
 *
 * @param {number} state
 * @returns {() => number}
 */
function mulberry32(state) {
  let value = state >>> 0;

  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An explicit random stream.
 *
 * There is no module-level singleton. Each engine or world owns its own source
 * and injects it into helpers that need randomness.
 */
export class RandomSource {
  /**
   * @param {() => number} next
   */
  constructor(next) {
    if (typeof next !== 'function') {
      throw new TypeError('RandomSource requires a next() function.');
    }

    /** @type {() => number} */
    this._next = next;
  }

  /**
   * @returns {number} A value in the range [0, 1).
   */
  next() {
    return this._next();
  }

  /**
   * Integer in the inclusive range [min, max].
   *
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new RangeError('RandomSource.int requires integer bounds.');
    }
    if (max < min) {
      throw new RangeError('RandomSource.int requires max >= min.');
    }

    const value = min + Math.floor(this.next() * (max - min + 1));
    return Math.min(max, value);
  }

  /**
   * Pick one item from an array.
   *
   * @template T
   * @param {T[]} array
   * @returns {T}
   */
  pick(array) {
    if (!Array.isArray(array) || array.length === 0) {
      throw new RangeError('RandomSource.pick requires a non-empty array.');
    }
    return array[this.int(0, array.length - 1)];
  }

  /**
   * Create an independent stream. Forking does not advance the parent.
   *
   * @param {string|number} seed
   * @returns {RandomSource}
   */
  fork(seed) {
    if (seed === undefined || seed === null) {
      throw new TypeError('RandomSource.fork requires a seed.');
    }
    return createSeededRandom(seed);
  }
}

/**
 * Create a deterministic mulberry32-backed stream.
 *
 * String seeds are hashed deterministically; numeric seeds are used directly.
 *
 * @param {string|number} seed
 * @returns {RandomSource}
 */
export function createSeededRandom(seed) {
  if (seed === undefined || seed === null) {
    throw new TypeError('createSeededRandom requires a seed.');
  }
  return new RandomSource(mulberry32(seedToState(seed)));
}

/**
 * Create a source backed by Web Crypto when available, with a Math.random
 * fallback for environments without it.
 *
 * @returns {RandomSource}
 */
export function createBrowserRandom() {
  const cryptoObject = globalThis.crypto;

  if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
    return new RandomSource(() => {
      const values = new Uint32Array(1);
      cryptoObject.getRandomValues(values);
      return values[0] / 4294967296;
    });
  }

  return new RandomSource(Math.random);
}
