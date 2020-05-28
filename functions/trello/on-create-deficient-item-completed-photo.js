const assert = require('assert');
const systemModel = require('../models/system');
const defItemModel = require('../models/deficient-items');
const log = require('../utils/logger');

const PREFIX = 'trello: on-create-di-completed-photo:';

/**
 * Factory for creating Trello image comments from
 * a Deficient Item's completed photos
 * @param  {admin.database} database - Firebase Admin DB instance
 * @param  {admin.firestore} firestore - Firebase Admin DB instance
 * @return {Function} - DI completed photo onCreate handler
 */
module.exports = function createOnDiCompletedPhotoCreate(db, fs) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { propertyId, deficientItemId, completedPhotoId } = event.params;
    const completedPhoto = change.val();
    assert(
      propertyId && typeof propertyId === 'string',
      'has property ID reference'
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has property ID reference'
    );
    assert(
      completedPhotoId && typeof completedPhotoId === 'string',
      'has completed photo ID reference'
    );
    assert(
      completedPhoto && typeof completedPhoto === 'object',
      'has completed photo object'
    );

    // Sanity check
    if (completedPhoto.trelloCardAttachement) {
      log.info(`${PREFIX} completed photo already uploaded`);
      return;
    }

    if (!completedPhoto.downloadURL) {
      log.warn(
        `${PREFIX} invalid completed photo entry at: "${change.ref.path.toString()}"`
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
      throw Error(`${PREFIX} Trello Card ID lookup failed | ${err}`);
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficient Item has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    try {
      // Perform post attachment requests
      const trelloResponse = await systemModel.postTrelloCardAttachment(
        db,
        fs,
        propertyId,
        deficientItemId,
        trelloCardId,
        completedPhoto.downloadURL
      );

      // Lookup attachment identifier
      let attachmentId = '';
      if (trelloResponse && trelloResponse.body && trelloResponse.body.id) {
        attachmentId = trelloResponse.body.id;
      }
      if (!attachmentId) {
        const err = Error('unexpected Trello response body');
        err.status = trelloResponse.status;
        throw err;
      }

      // Persist DI completed photo's Trello attachement reference
      await defItemModel.updateCompletedPhotoTrelloCardAttachment(
        db,
        fs,
        propertyId,
        deficientItemId,
        completedPhotoId,
        attachmentId
      );

      log.info(
        `${PREFIX} successfully uploaded Trello card attachment for Property ${propertyId} DI "${deficientItemId}" completed photo "${completedPhotoId}"`
      );
    } catch (err) {
      throw Error(
        `${PREFIX} Failed to upload DI completed photo attachment to Trello API: "${err.status ||
          'N/A'}" | message: "${err.body ? err.body.message : err}"`
      );
    }
  };
};
