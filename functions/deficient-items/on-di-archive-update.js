const assert = require('assert');
const model = require('../models/deficient-items');
const log = require('../utils/logger');

const LOG_PREFIX = 'deficient-items: on-di-archive-update:';

/**
 * Factory for client requested Deficient
 * Items archiving on DI state updates
 * @param  {firebaseAdmin.database} - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiArchiveUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, itemId: deficientItemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(deficientItemId), 'has deficient item ID');

    log.info(`${LOG_PREFIX} property: ${propertyId} | deficient item: ${deficientItemId}`);

    // Is archive activated
    if (change.after.val() === true) {
      const diSnap = await change.after.ref.parent.once('value');
      const archiveUpdates = await model.archive(db, diSnap);
      Object.assign(updates, archiveUpdates);
      log.info(`${LOG_PREFIX} archived requested deficient item ${deficientItemId}`);
    }

    return updates;
  }
}
