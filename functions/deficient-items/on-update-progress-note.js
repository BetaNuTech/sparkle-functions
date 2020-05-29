const assert = require('assert');
const diModel = require('../models/deficient-items');
const log = require('../utils/logger');

const PREFIX = 'deficient-items: on-update-progress-notes:';

/**
 * Factory for syncing a deficiency's
 * progress notes to Firestore
 *
 * NOTE: Should be removed after deficient items
 * have been fully  migrated to Firestore
 * @param  {admin.firestore} fs
 * @return {Function}
 */
module.exports = function createOnUpdateProgressNotesHandler(fs) {
  assert(
    fs && typeof fs.collection === 'function',
    'has firestore DB instance'
  );

  return async (change, event) => {
    const { deficiencyId, progressNoteId } = event.params;
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(
      progressNoteId && typeof progressNoteId === 'string',
      'has progress note id'
    );
    const afterSnap = await change.after.ref.parent.once('value');
    const data = afterSnap.val();

    if (data) {
      try {
        await diModel.firestoreUpdateRecord(fs, deficiencyId, {
          [`progressNotes.${progressNoteId}`]: data.progressNotes[
            progressNoteId
          ],
        });
      } catch (err) {
        log.error(
          `${PREFIX} failed to append new firestore DI: "${deficiencyId}" progress note: "${progressNoteId}" | ${err}`
        );
        throw err;
      }
    }
  };
};
