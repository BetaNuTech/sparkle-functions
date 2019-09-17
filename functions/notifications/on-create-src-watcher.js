const assert = require('assert');
const log = require('../utils/logger');

const PREFIX = 'notifications: on-create-src-watcher:';

/**
 * Factory for watcher on creation of a
 * new source notification in the database
 * @param  {firebaseAdmin.database} database - Firebase Admin DB instance
 * @return {Function} - notifications source onCreate handler
 */
module.exports = function createOnDiToggleArchiveUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const { notificationId } = event.params;

    assert(Boolean(notificationId), 'has deficient item ID');
    log.info(`${PREFIX} source notification "${notificationId}" generated`);
  };
};
