/**
 * Schema migration hook point.
 */

/** @type {Map<number, (payload: any) => any>} */
const MIGRATIONS = new Map();

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * @param {number} fromVersion
 * @param {(payload: any) => any} migrateFn
 */
export function registerMigration(fromVersion, migrateFn) {
  if (!Number.isInteger(fromVersion)) throw new TypeError('fromVersion must be an integer');
  if (typeof migrateFn !== 'function') throw new TypeError('migrateFn must be a function');
  MIGRATIONS.set(fromVersion, migrateFn);
}

/**
 * @param {any} payload
 * @param {number} fromVersion
 * @param {number} [toVersion]
 */
export function migrateSettingsPayload(payload, fromVersion, toVersion = CURRENT_SCHEMA_VERSION) {
  let current = payload;
  let version = fromVersion;
  if (version === toVersion) return { payload: current, version };
  if (!Number.isInteger(version) || version < 1) {
    const err = /** @type {any} */ (new Error(`Unsupported schemaVersion ${String(fromVersion)}.`));
    err.code = 'SETTINGS_UNSUPPORTED_VERSION';
    throw err;
  }
  while (version < toVersion) {
    const step = MIGRATIONS.get(version);
    if (!step) {
      const err = /** @type {any} */ (new Error(`No migration path from schemaVersion ${version} to ${toVersion}.`));
      err.code = 'SETTINGS_MIGRATION_MISSING';
      throw err;
    }
    current = step(current);
    version += 1;
  }
  return { payload: current, version };
}
