const deleteUploads = require('./delete-uploads');

const PREFIX = 'inspections: utils: remove-for-property';

/**
 * Remove all inspections and inspection proxies for a property
 * @param  {firebaseAdmin.database} db
 * @param  {firebaseAdmin.storage} storage
 * @param  {String} propertyId
 * @return {Promise} - resolves {Object} hash of updates
 */
module.exports = async function removeForProperty(db, storage, propertyId) {
  const updates = {};

  const inspectionsSnap = await db
    .ref('/inspections')
    .orderByChild('property')
    .equalTo(propertyId)
    .once('value');
  const inspections = inspectionsSnap.val();
  const inspectionsIds = Object.keys(inspections || {});

  // Remove each inspections' items' uploads
  for (let i = 0; i < inspectionsIds.length; i++) {
    const inspId = inspectionsIds[i];

    try {
      await deleteUploads(db, storage, inspId);
    } catch (err) {
      // wrap error
      throw Error(`${PREFIX} upload delete failed | ${err}`);
    }
  }

  // Collect inspections to delete in `updates`
  inspectionsIds.forEach(inspectionId => {
    updates[`/inspections/${inspectionId}`] = null;
  });

  // Remove all `/propertyInspectionsList`
  updates[`/propertyInspectionsList/${propertyId}`] = null;

  try {
    await db.ref().update(updates);
  } catch (err) {
    // wrap error
    throw Error(`${PREFIX} update inspection failed | ${err}`);
  }

  return updates;
};
