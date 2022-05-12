const assert = require('assert');
const model = require('../models/deficient-items');
const log = require('../utils/logger');
const config = require('../config');

const PREFIX = 'deficient-items: on-di-toggle-archive-update:';
const DEFICIENT_COLLECTION = config.deficientItems.collection;

/**
 * Factory for client requested Deficiency
 * archiving on DI state updates
 * @param  {admin.firestore} db
 * @return {Function} - property onWrite handler
 */
module.exports = function createOnDiToggleArchiveUpdateHandler(db) {
  assert(
    db && typeof db.collection === 'function',
    'has firestore DB instance'
  );

  return async (change, event) => {
    const { deficiencyId } = event.params;
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (
      typeof afterData.archive !== 'boolean' ||
      Boolean(beforeData.archive) === afterData.archive ||
      (afterData._collection && afterData._collection !== DEFICIENT_COLLECTION)
    ) {
      return; // non-archive update to deficiency
    }

    const isArchived = Boolean(afterData._collection);
    const archivePastTense = afterData.archive ? 'archived' : 'unarchived';
    let archiveUpdates = null;

    try {
      if (isArchived) {
        archiveUpdates = await model.activateRecord(db, deficiencyId);
      } else {
        archiveUpdates = await model.deactivateRecord(db, deficiencyId);
      }
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        log.info(
          `${PREFIX} Trello API card not found, removed card refrences from DB`
        );
      } else {
        log.error(
          `${PREFIX} toggling DI to ${archivePastTense} failed | ${err}`
        );
        throw err;
      }
    }

    // Log archived Trello card
    if (archiveUpdates && archiveUpdates.trelloCardChanged) {
      log.info(
        `${PREFIX} ${archivePastTense} Trello card ${archiveUpdates.trelloCardChanged}`
      );
    }
  };
};
