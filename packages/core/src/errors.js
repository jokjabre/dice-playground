/**
 * Base error for all dice-engine failures.
 */
export class DiceError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: unknown }} [options]
   */
  constructor(message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'DiceError';
    this.code = options.code ?? 'DICE_ERROR';
  }
}

/**
 * Raised when a roll option requires a plugin that is not installed.
 */
export class UnsupportedRollOptionError extends DiceError {
  /**
   * @param {string} option
   */
  constructor(option) {
    super(`Roll option "${option}" requires an installed plugin.`, {
      code: 'UNSUPPORTED_ROLL_OPTION'
    });
    this.name = 'UnsupportedRollOptionError';
    this.option = option;
  }
}

/**
 * Raised when a requested die value is outside the die's label range.
 */
export class InvalidRollTargetError extends DiceError {
  /**
   * @param {number} value
   * @param {[number, number]} range
   */
  constructor(value, range) {
    super(`Requested value ${value} is outside the die label range ${range[0]}..${range[1]}.`, {
      code: 'INVALID_ROLL_TARGET'
    });
    this.name = 'InvalidRollTargetError';
    this.value = value;
    this.range = range;
  }
}

/**
 * Raised when a roll starts while another roll is still active.
 */
export class RollInProgressError extends DiceError {
  constructor() {
    super('A roll is already in progress. Pass { cancelActive: true } to replace it.', {
      code: 'ROLL_IN_PROGRESS'
    });
    this.name = 'RollInProgressError';
  }
}

/**
 * Raised when configuration is structurally invalid.
 */
export class ConfigurationError extends DiceError {
  /**
   * @param {string} message
   * @param {{ path?: string }} [options]
   */
  constructor(message, options = {}) {
    super(message, { code: 'CONFIGURATION_ERROR' });
    this.name = 'ConfigurationError';
    if (options.path) this.path = options.path;
  }
}
