const assert = require('assert');
const hbs = require('handlebars');
const systemModel = require('../models/system');
const usersModel = require('../models/users');
const {
  trelloCardDIProgressNoteTemplate,
} = require('../config/deficient-items');
const log = require('../utils/logger');

const PREFIX = 'trello: on-di-progress-note-create:';

/**
 * Factory for creating Trello comments from
 * a new Deficient Item's progress note
 * @param  {admin.database} db - Firebase Admin DB instance
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - DI progress note onCreate handler
 */
module.exports = function createOnDiProgressNote(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  // Template for all Progress Note comments
  const progNoteTemplate = hbs.compile(trelloCardDIProgressNoteTemplate);

  return async (change, event) => {
    const { propertyId, deficientItemId } = event.params;
    const progressNote = change.val();
    assert(
      propertyId && typeof propertyId === 'string',
      'has property ID reference'
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has property ID reference'
    );
    assert(
      progressNote && typeof progressNote === 'object',
      'has progress note object'
    );

    if (
      !progressNote.progressNote ||
      typeof progressNote.progressNote !== 'string'
    ) {
      log.warn(
        `${PREFIX} Progress Note for "${propertyId}/${deficientItemId}" is missing progressNote attribute`
      );
      return;
    }

    if (!progressNote.user || typeof progressNote.user !== 'string') {
      log.warn(
        `${PREFIX} Progress Note for "${propertyId}/${deficientItemId}" is missing user attribute`
      );
      return;
    }

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

    // Lookup user that created Progress Note
    let progressNoteAuthor = null;
    try {
      const userSnap = await usersModel.getUser(db, progressNote.user);
      progressNoteAuthor = userSnap.val();
      if (!progressNoteAuthor) {
        log.warn(
          `${PREFIX} author of progress note "${progressNote.user}" does not exist, exiting`
        );
        return;
      }
    } catch (err) {
      throw Error(
        `${PREFIX} failed to find user "${progressNote.user}" | ${err}`
      ); // wrap error
    }

    // Compile Trello comment
    const commentText = progNoteTemplate({
      firstName: progressNoteAuthor.firstName,
      lastName: progressNoteAuthor.lastName,
      email: progressNoteAuthor.email,
      progressNote: progressNote.progressNote,
    });

    // Publish comment to Trello Card
    try {
      await systemModel.postTrelloCardComment(
        db,
        fs,
        propertyId,
        deficientItemId,
        trelloCardId,
        commentText
      );

      log.info(
        `${PREFIX} successfully added progress note comment to Trello card`
      );
    } catch (err) {
      // Wrap error
      throw Error(`${PREFIX} failed to Publish Trello comment | ${err}`);
    }
  };
};
