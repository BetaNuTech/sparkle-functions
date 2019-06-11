const co = require('co');
const log = require('../utils/logger');
const adminUtils = require('../utils/firebase-admin');
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
  removeForProperty(db, storage, propertyId) {
    const updates = Object.create(null);

    return co(function*() {
      const inspectionsSnap = yield db
        .ref('/inspections')
        .orderByChild('property')
        .equalTo(propertyId)
        .once('value');
      const inspections = inspectionsSnap.val();
      const inspectionsIds = Object.keys(inspections);

      // Remove each inspections' items' uploads
      for (let i = 0; i < inspectionsIds.length; i++) {
        const inspId = inspectionsIds[i];

        try {
          const uploadUpdates = yield deleteUploads(db, storage, inspId);
          Object.assign(updates, uploadUpdates);
        } catch (e) {}
      }

      // Collect inspections to delete in `updates`
      inspectionsIds.forEach(inspectionId => {
        updates[`/inspections/${inspectionId}`] = null;
      });

      // Remove all `/propertyInspections`
      updates[`/propertyInspections/${propertyId}`] = null;

      // Remove all `/propertyInspectionsList`
      updates[`/propertyInspectionsList/${propertyId}`] = null;

      yield db.ref().update(updates);
      return updates;
    }).catch(
      e => new Error(`${LOG_PREFIX} removeForProperty: ${e}`) // wrap error
    );
  },

  cron,
  processWrite,
  getLatestCompleted,
  createOnAttributeWriteHandler,
  createOnWriteHandler,
  createOnDeleteHandler,
  createOnGetPDFReportHandler,
};
