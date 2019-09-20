const assert = require('assert');
const systemModel = require('../models/system');
const log = require('../utils/logger');

const PREFIX = 'trello: on-di-progress-note-create:';

/**
 * Factory for creating Trello comments from
 * a new Deficient Item's progress note
 * @param  {firebaseAdmin.database} database - Firebase Admin DB instance
 * @return {Function} - DI progress note onCreate handler
 */
module.exports = function createOnDiProgressNote(db) {
  assert(Boolean(db), 'has firebase admin database reference');

  return async (change, event) => {
    const { propertyId, deficientItemId } = event.params;
    // const progressNote = change.val();

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficientItemId
      );
    } catch (err) {
      throw Error(`${PREFIX} Trello Card lookup failed | ${err}`);
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficient Item has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }
  };
};
