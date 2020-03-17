const log = require('../utils/logger');
const inspections = require('../inspections');
const teams = require('../teams');
const propertyTemplates = require('../property-templates');

const PREFIX = 'properties: on-delete:';
const PROPERTY_BUCKET_NAME = `propertyImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;

/**
 * Factory for property on delete handler
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @param  {@google-cloud/pubsub} pubsubClient - PubSub instance
 * @param  {String} userTeamsTopic
 * @return {Function} - property onDelete handler
 */
module.exports = function createOnDeleteHandler(
  db,
  storage,
  pubsubClient,
  userTeamsTopic
) {
  return async (propertySnap, event) => {
    const updates = {};
    const { propertyId } = event.params;

    log.info(`${PREFIX} property ${propertyId} deleted`);

    try {
      const inspUpdates = await inspections.removeForProperty(
        db,
        storage,
        propertyId
      );
      Object.assign(updates, inspUpdates);
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
    }

    try {
      const teamUpdates = await teams.removeForProperty(
        db,
        propertyId,
        pubsubClient,
        userTeamsTopic
      );
      Object.assign(updates, teamUpdates);
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
    }

    try {
      await propertyTemplates.removeForProperty(db, propertyId);
      updates[`/propertyTemplatesList/${propertyId}`] = 'removed';
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
    }

    // Cleanup deleted property's images
    const property = propertySnap.val() || {};
    const imgUrls = [property.photoURL, property.bannerPhotoURL].filter(
      Boolean
    );

    if (imgUrls.length) {
      for (let i = 0; i < imgUrls.length; i++) {
        const url = imgUrls[i];
        const imgType = ['profile', 'banner'][i];

        try {
          const fileName = (decodeURIComponent(url).split('?')[0] || '')
            .split('/')
            .pop();
          await storage
            .bucket()
            .file(`${PROPERTY_BUCKET_NAME}/${fileName}`)
            .delete();
          log.info(
            `${PREFIX} property: ${propertyId} ${imgType} removal succeeded`
          );
        } catch (e) {
          log.error(
            `${PREFIX} property: ${propertyId} ${imgType} removal at ${url} failed ${e}`
          );
        }
      }
    }

    // TODO remove Firestore record

    return updates;
  };
};
