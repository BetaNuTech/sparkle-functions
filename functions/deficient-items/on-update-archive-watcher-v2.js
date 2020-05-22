const assert = require('assert');
const model = require('../models/deficient-items');
const log = require('../utils/logger');
const config = require('../config');

const PREFIX = 'deficient-items: on-di-toggle-archive-update:';
const DEFICIENT_COLLECTION = config.deficientItems.collection;

/**
 * Factory for client requested Deficiency
 * archiving on DI state updates
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiToggleArchiveUpdateHandler(fs) {
  assert(
    fs && typeof fs.collection === 'function',
    'has firestore DB instance'
  );

  return async (change, event) => {
    const { deficiencyId } = event.params;
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    const beforeData = change.after.data();
    const afterData = change.after.data();

    if (
      typeof afterData.archive !== 'boolean' ||
      beforeData.archive === afterData.archive ||
      (afterData._collection && afterData._collection !== DEFICIENT_COLLECTION)
    ) {
      return; // non-archive update
    }

    const isArchived = Boolean(afterData._collection);
    const archiveType = afterData.archive ? 'archived' : 'unarchived';

    let archiveUpdates = null;
    try {
      // archiveUpdates = await model.toggleArchive(db, fs, diSnap, isArchiving);

      if (isArchived) {
        archiveUpdates = await model.unarchiveDeficiency(fs, deficiencyId); // TODO write
      } else {
        archiveUpdates = await model.archiveDeficiency(fs, deficiencyId); // TODO write
      }
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
  };
};
