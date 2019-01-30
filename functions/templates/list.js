const assert = require('assert');
const log = require('../utils/logger');

const LOG_PREFIX = 'templates: list:';

module.exports = {
  /**
   * Handle adds, deletes, & updates to /templatesList/*
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} templateId
   * @param  {Object} before - record POJO
   * @param  {Object} after - record POJO
   * @return {Promise} - resolves {Object} write result (template or null)
   */
  write(db, templateId, before, after) {
    assert(templateId && typeof templateId === 'string', 'has template ID');
    assert(typeof before === 'object', 'has before object');
    assert(typeof after === 'object', 'has after object');
    const self = this;
    const target = `/templatesList/${templateId}`;

    // Template removed
    if (!after) {
      log.info(`${LOG_PREFIX} removing ${target}`);

      return db.ref(target).remove()
        .catch((e) => Promise.reject(
          new Error(`${LOG_PREFIX} failed to remove at ${target} ${e}`) // wrap error
        ))
        .then(() => null);
    }

    // TODO: Template added or updated
    return Promise.resolve({});
  }
}
