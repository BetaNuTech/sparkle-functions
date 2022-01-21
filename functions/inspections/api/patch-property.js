const assert = require('assert');
const moment = require('moment');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch property:';

/**
 * Factory for creating a PATCH endpoint for
 * reassigning an inspection's property
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchProperty(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request for reassigning
   * an Inspection's property
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { inspectionId } = params;
    const { property: propertyId } = body;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    log.info('Inspection reassignment requested');

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    if (!propertyId) {
      return res.status(400).send({ message: 'body missing property' });
    }

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
      if (!property) throw Error('Not found');
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
      return res.status(400).send({ message: 'body contains bad property' });
    }

    // Lookup Inspection
    let inspection = null;
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
      if (!inspection) throw Error('Not found');
    } catch (err) {
      log.error(`${PREFIX} inspection lookup failed | ${err}`);
      return res.status(409).send({
        message: 'requested inspection not found',
      });
    }

    const srcPropertyId = inspection.property;

    // Reassign inspection to new property
    try {
      await inspectionsModel.reassignProperty(
        db,
        inspectionId,
        srcPropertyId,
        propertyId
      );
    } catch (err) {
      return send500Error(
        err,
        'inspection property reassignment failed',
        'unexpected error'
      );
    }

    // Update each property's meta data
    try {
      const batch = db.batch();
      await propertiesModel.updateMetaData(db, srcPropertyId, batch);
      await propertiesModel.updateMetaData(db, propertyId, batch);
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'properties metadata update failed',
        'unexpected error'
      );
    }

    // Send global notification for an inspection completion
    if (!incognitoMode) {
      const propertyName = property.name;
      const templateName = inspection.templateName || 'Unknown';
      const currentDate = moment().format('MMM DD');
      const startDate = moment(inspection.creationDate).format('MM/DD/YY');

      try {
        await notificationsModel.addRecord(db, {
          title: propertyName,
          summary: notifyTemplate('inspection-reassign-summary', {
            currentDate,
            authorName,
          }),
          markdownBody: notifyTemplate('inspection-reassign-markdown-body', {
            startDate,
            propertyName,
            templateName,
            authorName,
            authorEmail,
          }),
          property: propertyId,
          creator: authorId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }

    res.status(201).send({ message: 'successful' });
  };
};
