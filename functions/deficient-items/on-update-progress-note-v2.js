const assert = require('assert');
const hbs = require('handlebars');
const systemModel = require('../models/system');
const usersModel = require('../models/users');
const trello = require('../services/trello');
const {
  trelloCardDIProgressNoteTemplate,
} = require('../config/deficient-items');
const findHistory = require('./utils/find-history');
const { diff } = require('../utils/object-differ');
const log = require('../utils/logger');

const PREFIX = 'deficient-items: on-update-progress-note-v2:';

/**
 * Factory for handling a Deficiency's new progress note
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - DI progress note onCreate handler
 */
module.exports = function createOnUpdateDeficiencyProgNote(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  // Template for all Progress Note comments
  const progNoteTemplate = hbs.compile(trelloCardDIProgressNoteTemplate);

  return async (change, event) => {
    const { deficiencyId } = event.params;
    const beforeDeficiency = change.before.data();
    const afterDeficiency = change.after.data();
    const propertyId = afterDeficiency.property;
    const beforeProgressNoteHistory = findHistory(beforeDeficiency)(
      'progressNotes'
    );
    const afterProgressNoteHistory = findHistory(afterDeficiency)(
      'progressNotes'
    );
    const latestBeforeProgressNote = beforeProgressNoteHistory
      ? beforeProgressNoteHistory.current
      : null;
    const progressNote = afterProgressNoteHistory
      ? afterProgressNoteHistory.current
      : null;

    // Ignored non-existent/unchanged progress note
    if (!progressNote || !diff(progressNote, latestBeforeProgressNote)) {
      return;
    }
    assert(
      propertyId && typeof propertyId === 'string',
      'has property ID reference'
    );
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has property ID reference'
    );
    assert(
      progressNote && typeof progressNote === 'object',
      'has progress note object'
    );
    assert(
      progressNote.progressNote &&
        typeof progressNote.progressNote === 'string',
      'Progress Note has "progressNote" string'
    );
    assert(
      progressNote.user && typeof progressNote.user === 'string',
      'Progress Note has "user" id'
    );

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.firestoreFindTrelloCardId(
        fs,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      throw Error(`${PREFIX} Trello Card lookup failed | ${err}`);
    }

    if (!trelloCardId) {
      log.info(
        `${PREFIX} Deficiency: "${deficiencyId}" has no Trello Card, exiting`
      );
      return; // eslint-disable-line no-useless-return
    }

    // Lookup user that created Progress Note
    let progressNoteAuthor = null;
    try {
      const userSnap = await usersModel.firestoreFindRecord(
        fs,
        progressNote.user
      );
      progressNoteAuthor = userSnap.data() || null;
      if (!progressNoteAuthor) {
        throw Error(
          `author of progress note "${progressNote.user}" does not exist`
        );
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

    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.firestoreFindTrello(fs);
      trelloCredentials = trelloCredentialsSnap.data();
      if (!trelloCredentials) {
        throw Error('Organization has not authorized Trello');
      }
    } catch (err) {
      throw Error(`${PREFIX} failed lookup trello credentials | ${err}`); // wrap error
    }

    // Publish comment to Trello Card
    try {
      await trello.publishTrelloCardComment(
        trelloCardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        commentText
      );

      log.info(
        `${PREFIX} successfully added progress note comment to Trello card`
      );
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await systemModel.firestoreCleanupDeletedTrelloCard(
            fs,
            deficiencyId,
            trelloCardId
          );
        } catch (cleanUpErr) {
          throw Error(
            `${PREFIX} failed to cleanup deleted Trello Card | ${cleanUpErr}`
          );
        }
      } else {
        throw Error(`${PREFIX} failed to Publish Trello comment | ${err}`);
      }
    }
  };
};
