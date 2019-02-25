const co = require('co');
const log = require('../utils/logger');

const LOG_PREFIX = 'inspections: delete-uploads:';
const INSP_BUCKET_NAME = `inspectionItemImages${process.env.NODE_ENV === 'test' ? 'Test' : ''}`;

/**
 * Remove all an inspection's uploads
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.storage} storage - Firebase Admin Storage instance
 * @param  {String} inspectionId
 * @return {Promise} - resolve {Object} updates
 */
module.exports = function deleteInspectionUploads(db, storage, inspectionId) {
  return co(function *() {
    const itemsSnaps = yield db.ref(`/inspections/${inspectionId}/template/items`).once('value');
    const updates = Object.create(null);
    const itemUploadUrls = []

    // Collect each items list of uploads
    // into a flat array of upload url's
    itemsSnaps.forEach(itemSnap => {
      const item = itemSnap.val() || {};
      Object.keys(item.photosData || {}).forEach((id) => {
        itemUploadUrls.push(item.photosData[id].downloadURL);
      });
    });

    // Itteratively destroy each upload
    if (itemUploadUrls.length) {
      for (let i = 0; i < itemUploadUrls.length; i++) {
        const url = itemUploadUrls[i];

        try {
          const fileName = (decodeURIComponent(url).split('?')[0] || '').split('/').pop();
          yield storage.bucket().file(`${INSP_BUCKET_NAME}/${fileName}`).delete();
          log.info(`${LOG_PREFIX} inspection: ${inspectionId} ${fileName} removal succeeded`);
          updates[fileName] = 'removed';
        } catch (e) {
          log.error(`${LOG_PREFIX} inspection: ${inspectionId} ${fileName} removal at ${url} failed ${e}`);
        }
      }
    }

    return updates;
  });
}
