const assert = require('assert');
const trello = require('../services/trello');
const systemModel = require('../models/system');
const deficiencyModel = require('../models/deficient-items');
const { diff } = require('../utils/object-differ');
const log = require('../utils/logger');
const findHistory = require('./utils/find-history');

const PREFIX = 'trello: on-update-completed-photo-v2:';

/**
 * Factory for creating Trello image comments from
 * a Deficient Item's completed photos
 * @param  {admin.firestore} db - Firebase Admin DB instance
 * @return {Function} - DI completed photo onCreate handler
 */
module.exports = function createOnUpdateCompletedPhoto(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  return async (change, event) => {
    const { deficiencyId } = event.params;
    const beforeDeficiency = change.before.data() || {};
    const afterDeficiency = change.after.data() || {};
    const propertyId = afterDeficiency.property;
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency ID'
    );
    assert(propertyId && typeof propertyId === 'string', 'has property ID');

    const beforeCompletedPhotoHistory = findHistory(beforeDeficiency)(
      'completedPhotos'
    );
    const afterCompletedPhotoHistory = findHistory(afterDeficiency)(
      'completedPhotos'
    );
    const beforeCompletePhoto = beforeCompletedPhotoHistory
      ? beforeCompletedPhotoHistory.current
      : null;
    const completedPhoto = afterCompletedPhotoHistory
      ? afterCompletedPhotoHistory.current
      : null;

    // Ignored non-existent/unchanged completed photo
    if (!completedPhoto || !diff(completedPhoto, beforeCompletePhoto)) {
      return;
    }

    const completedPhotoId = afterCompletedPhotoHistory.getItemId(
      completedPhoto
    );
    assert(
      completedPhotoId && typeof completedPhotoId === 'string',
      'has completed photo ID reference'
    );
    assert(
      completedPhoto &&
        typeof completedPhoto === 'object' &&
        typeof completedPhoto.downloadURL === 'string',
      'has valid completed photo'
    );

    // Sanity check
    if (completedPhoto.trelloCardAttachement) {
      log.info(`${PREFIX} completed photo already published to Trello card`);
      return;
    }

    // Find previously created Trello
    // Card identifier
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      throw Error(`Trello Card ID lookup failed | ${err}`);
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficiency has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.findTrello(db);
      trelloCredentials = trelloCredentialsSnap.data() || null;
    } catch (err) {
      throw Error(`${PREFIX} failed lookup trello credentials | ${err}`); // wrap error
    }

    // Exit when Trello not authorized for Organization
    if (!trelloCredentials) {
      log.info(`${PREFIX} Organization has not authorized Trello`);
      return;
    }

    // POST attachment to Deficiency's Trello Card
    let attachmentId = '';
    try {
      const response = await trello.publishCardAttachment(
        trelloCardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        completedPhoto.downloadURL
      );
      const responseBody = response.body;

      // Set attachment identifier
      if (
        responseBody &&
        responseBody.id &&
        typeof responseBody.id === 'string'
      ) {
        attachmentId = responseBody.id;
      }

      if (!attachmentId) {
        throw Error(
          `Unexpected response from Trello API status: "${response.status ||
            'N/A'}`
        );
      }
    } catch (err) {
      // Cleanup deleted Trello card from database
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await systemModel.cleanupDeletedTrelloCard(
            db,
            deficiencyId,
            trelloCardId
          );
          return;
        } catch (cleanUpErr) {
          throw Error(
            `${PREFIX} failed to cleanup deleted Trello Card | ${cleanUpErr}`
          );
        }
      } else {
        throw Error(
          `${PREFIX} Failed to publish Deficiency's completed photo attachment to its' Trello Card | ${err}`
        );
      }
    }

    // Persist completed photo's
    // Trello attachement reference
    try {
      await deficiencyModel.updateCompletedPhotoTrelloCardAttachment(
        db,
        deficiencyId,
        completedPhotoId,
        attachmentId
      );
    } catch (err) {
      throw Error(
        `${PREFIX} Failed to update deficiency: "${deficiencyId}" completed photo: "${completedPhotoId}" with trello attachment data`
      );
    }

    log.info(
      `${PREFIX} successfully published Trello card attachment for deficiency: "${deficiencyId}" completed photo: "${completedPhotoId}"`
    );
  };
};
