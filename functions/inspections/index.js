const processWrite = require('./process-write');
const deleteUploads = require('./delete-uploads');
const cron = require('./cron');
const createOnAttributeWriteHandler = require('./on-attribute-write-handler');
const createOnWriteHandler = require('./on-write-handler');
const createOnDeleteHandler = require('./on-delete-handler');
const createOnGetPDFReportHandler = require('./on-get-pdf-report');
const getLatestCompleted = require('./get-latest-completed');

const LOG_PREFIX = 'inspections:';

module.exports = {
  /**
   * Remove all inspections and inspection proxies for a property
   * @param  {firebaseAdmin.database} db
   * @param  {firebaseAdmin.storage} storage
   * @param  {String} propertyId
   * @return {Promise} - resolves {Object} hash of updates
   */
  async removeForProperty(db, storage, propertyId) {
    const updates = Object.create(null);

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
        throw Error(
          `${LOG_PREFIX} removeForProperty: upload delete failed: ${err}`
        );
      }
    }

    // Collect inspections to delete in `updates`
    inspectionsIds.forEach(inspectionId => {
      updates[`/inspections/${inspectionId}`] = null;
    });

    // Remove all `/propertyInspections`
    updates[`/propertyInspections/${propertyId}`] = null;

    // Remove all `/propertyInspectionsList`
    updates[`/propertyInspectionsList/${propertyId}`] = null;

    try {
      await db.ref().update(updates);
    } catch (err) {
      // wrap error
      throw Error(
        `${LOG_PREFIX} removeForProperty: update inspection failed: ${err}`
      );
    }

    return updates;
  },

  cron,
  processWrite,
  getLatestCompleted,
  createOnAttributeWriteHandler,
  createOnWriteHandler,
  createOnDeleteHandler,
  createOnGetPDFReportHandler,
};
