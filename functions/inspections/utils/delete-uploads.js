const assert = require('assert');
const log = require('../../utils/logger');
const itemUploads = require('./item-uploads');

const PREFIX = 'inspections: utils: delete-uploads:';

/**
 * Remove all an inspection's uploads
 * TODO: Deprecate once firebase DB support dropped
 * @param  {admin.database} db - Firebase Admin DB instance
 * @param  {admin.storage} storage - Firebase Admin Storage instance
 * @param  {String} inspectionId
 * @return {Promise} - resolve {Object} updates
 */
module.exports = async function deleteInspectionUploads(
  db,
  storage,
  inspectionId
) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(
    storage && typeof storage.bucket === 'function',
    'has storage instance'
  );
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection id');
  const itemsSnaps = await db
    .ref(`/inspections/${inspectionId}/template/items`)
    .once('value');
  const updates = {};
  const itemUploadUrls = [];

  // Collect each items list of uploads
  // into a flat array of upload url's
  itemsSnaps.forEach(itemSnap => {
    const item = itemSnap.val() || {};
    itemUploadUrls.push(...itemUploads.getUploadUrls(item));
  });

  // Itteratively destroy each upload
  if (itemUploadUrls.length) {
    for (let i = 0; i < itemUploadUrls.length; i++) {
      const url = itemUploadUrls[i];
      try {
        await itemUploads.delete(storage, url);
        updates[url] = 'removed';
        log.info(
          `${PREFIX} inspection: ${inspectionId} ${url} removal succeeded`
        );
      } catch (err) {
        log.error(
          `${PREFIX} inspection: ${inspectionId} removal at ${url} failed | ${err}`
        );
      }
    }
  }

  return updates;
};
