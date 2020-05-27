const assert = require('assert');
const model = require('../models/deficient-items');
const log = require('../utils/logger');

const PREFIX = 'deficient-items: on-di-toggle-archive-update:';

/**
 * Factory for client requested Deficient
 * Items archiving on DI state updates
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiToggleArchiveUpdateHandler(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(
    fs && typeof fs.collection === 'function',
    'has firestore DB instance'
  );

  return async (change, event) => {
    const { propertyId, deficientItemId } = event.params;

    assert(Boolean(propertyId), 'has property ID');
    assert(Boolean(deficientItemId), 'has deficient item ID');

    const afterSnap = change.after.ref.parent;
    const isArchived = afterSnap.path.toString().search(/^\/archive/) > -1;
    const isArchiving = change.after.val();
    const archiveType = isArchiving ? 'archived' : 'unarchived';

    // Sanity check
    if (typeof isArchiving !== 'boolean') return;

    let diSnap = null;
    try {
      diSnap = await afterSnap.once('value');
    } catch (err) {
      log.error(`${PREFIX} parent DI lookup failed | ${err}`);
      throw err;
    }

    let archiveUpdates = null;
    const archiveChanged = isArchiving !== isArchived;

    if (archiveChanged) {
      try {
        archiveUpdates = await model.toggleArchive(db, fs, diSnap, isArchiving);
      } catch (err) {
        if (err.code === 'ERR_TRELLO_CARD_DELETED') {
          log.info(
            `${PREFIX} Trello API card not found, removed card refrences from DB`
          );
        } else {
          log.error(`${PREFIX} toggling DI to ${archiveType} failed | ${err}`);
          throw err;
        }
      }

      // Log archived Trello card
      if (archiveUpdates.trelloCardChanged) {
        log.info(
          `${PREFIX} ${archiveType} Trello card ${archiveUpdates.trelloCardChanged}`
        );
      }
    }
  };
};
