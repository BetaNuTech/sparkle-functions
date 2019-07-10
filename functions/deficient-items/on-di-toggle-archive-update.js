const assert = require('assert');
const model = require('../models/deficient-items');
const log = require('../utils/logger');

const PREFIX = 'deficient-items: on-di-toggle-archive-update:';

/**
 * Factory for client requested Deficient
 * Items archiving on DI state updates
 * @param  {firebaseAdmin.database} database - Firebase Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiToggleArchiveUpdateHandler(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const updates = Object.create(null);
    const { propertyId, deficientItemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(deficientItemId), 'has deficient item ID');

    const isArchiving = change.after.val();
    const archiveType = isArchiving ? 'archived' : 'unarchived';

    // Sanity check
    if (typeof isArchiving !== 'boolean') return;

    log.info(
      `${PREFIX} property: ${propertyId} | deficient item: ${deficientItemId}`
    );

    let diSnap = null;
    try {
      diSnap = await change.after.ref.parent.once('value');
    } catch (err) {
      log.error(`${PREFIX} parent DI lookup failed`);
      throw err;
    }

    let archiveUpdates = null;
    try {
      archiveUpdates = await model.toggleArchive(db, diSnap, isArchiving);
    } catch (err) {
      log.error(`${PREFIX} toggling DI to ${archiveType} failed`);
      throw err;
    }

    Object.assign(updates, archiveUpdates);

    // Log archived Trello card
    if (archiveUpdates.trelloCardChanged) {
      log.info(
        `${PREFIX} ${archiveType} Trello card ${archiveUpdates.trelloCardChanged}`
      );
    }

    log.info(
      `${PREFIX} ${archiveType} requested deficient item ${deficientItemId}`
    );

    return updates;
  };
};