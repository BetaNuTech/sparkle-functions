const assert = require('assert');
const moment = require('moment');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-attr');
const setItemDefaults = require('../utils/set-item-defaults');
const validate = require('../utils/validate-update');
const updateInspection = require('../utils/update');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const storageService = require('../../services/storage');
const findDeletedItemsPhotoUrls = require('../utils/find-deleted-items-photo-urls');

const PREFIX = 'inspection: api: patch-template:';

/**
 * Factory for updating inspection put request
 * that updates an inspection's template
 * @param  {admin.firestore} db
 * @param  {admin.storage} storage
 * @param  {admin.functions.pubsub.Publisher} completePublisher - publisher for complete inspection update event
 * @return {Function} - request handler
 */
module.exports = function patchTemplate(db, storage, completePublisher) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(storage && typeof storage.bucket === 'function', 'has storage');
  assert(
    completePublisher && typeof completePublisher.publish === 'function',
    'has publisher'
  );

  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {} } = req;
    const { inspectionId } = req.params;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);
    const updates = JSON.parse(JSON.stringify(body || {}));
    const hasUpdates = Boolean(Object.keys(updates).length);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `${PREFIX} Update inspection requested for inspection: "${inspectionId}"`
    );

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Optional prevent generating report
    const createReport = req.query.report
      ? req.query.report.search(/true/i) > -1
      : true;

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing body`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: inspection template update body required',
          },
        ],
      });
    }

    // Check payload contains non-updatable attributes
    if (doesContainInvalidAttr(updates)) {
      log.error(`${PREFIX} request contains invalid attributes`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Payload contains non updatable attributes',
            detail: 'Can not update non-updatable attributes',
          },
        ],
      });
    }

    // Validate inspection atrributes
    const inspectionValidationErrors = validate({ ...updates });
    const isValidUpdate = inspectionValidationErrors.length === 0;

    // Reject on invalid inspection update attributes
    if (!isValidUpdate) {
      log.error(`${PREFIX} bad request`);
      return res.status(400).send({
        errors: inspectionValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Lookup Inspection
    let inspection = null;
    let propertyId = '';
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
      propertyId = inspection ? inspection.property : '';
    } catch (err) {
      return send500Error(err, 'inspection lookup failed', 'unexpected error');
    }

    // Invalid inspection
    if (!inspection) {
      log.error(
        `${PREFIX} requested inspection: "${inspectionId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'inspection' },
            title: 'Inspection not found',
          },
        ],
      });
    }

    log.info(`${PREFIX} recovered inspection: "${inspectionId}" successfully`);

    // Avoid conflicts updating an inspection that
    // has a PDF report currently being generated
    if (inspection.inspectionReportStatus === 'generating') {
      log.error(
        `${PREFIX} requested inspection: "${inspectionId}" is currently generating report and cannot be updated`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'inspection' },
            title: 'Inspection Locked for Report',
            detail:
              "Inspection cannot be updated while its' PDF report is being generated",
          },
        ],
      });
    }

    // Add missing item defaults
    Object.keys((inspection.template || {}).items || {}).forEach(itemId => {
      const item = inspection.template.items[itemId];
      const itemDefaults = setItemDefaults(item);
      const hasItemDefaultUpdates = Object.keys(itemDefaults).length > 0;

      if (hasItemDefaultUpdates) {
        updates.items = updates.items || {};
        updates.items[itemId] = updates.items[itemId] || {};
        Object.assign(updates.items[itemId], itemDefaults); // merge defaults into item
      }
    });

    // Calculate new inspection result
    const inspectionUpdates = updateInspection(inspection, updates);
    const hasInspectionUpdates = Boolean(Object.keys(inspectionUpdates).length);

    // Exit eairly if user updates
    // had no impact on inspection
    if (!hasInspectionUpdates) {
      log.info(
        `${PREFIX} update to inspection: "${inspectionId}" had no effect`
      );
      return res.status(204).send();
    }

    // Merge updates into old inspection state
    const isCompleted =
      typeof inspectionUpdates.inspectionCompleted === 'boolean'
        ? inspectionUpdates.inspectionCompleted
        : Boolean(inspection.inspectionCompleted);

    const needsNewReport = isCompleted && createReport;

    // Pre-emptively set report to queued
    if (needsNewReport) {
      inspectionUpdates.inspectionReportStatus = 'queued';
      inspectionUpdates.inspectionReportStatusChanged = Math.round(
        Date.now() / 1000
      );
    }

    // Start batch update
    const batch = db.batch();

    // Persist inspection updates
    try {
      await inspectionsModel.setRecord(
        db,
        inspectionId,
        inspectionUpdates,
        batch,
        true
      );
    } catch (err) {
      return send500Error(err, 'inspection write failed', 'unexpected error');
    }

    log.info(
      `${PREFIX} successfully added update to inspection: "${inspectionId}" to batched update`
    );

    // Cleanup any deleted item photos from storage
    const deletedItemsPhotoUrls = findDeletedItemsPhotoUrls(
      inspection,
      inspectionUpdates
    );

    if (deletedItemsPhotoUrls.length) {
      try {
        await Promise.all(
          deletedItemsPhotoUrls.map(({ item, url }) => {
            const fileName = storageService.getUrlFileName(url);
            return storageService.deleteInspectionItemPhotoEntry(
              storage,
              inspectionId,
              item,
              fileName
            );
          })
        );
        log.info(
          `${PREFIX} successfully removed delete items storage for inspection: "${inspectionId}"`
        );
      } catch (err) {
        // Continue without error
        log.error(`${PREFIX} item delete storage fail: ${err}`);
      }
    }

    // Checking for property meta data updates
    const { updatedLastDate } = inspectionUpdates;
    const hasUpdatedLastDate = Boolean(
      updatedLastDate && updatedLastDate !== inspection.updatedLastDate
    );

    // Update property meta data on inspection update
    if (hasUpdatedLastDate) {
      try {
        await propertiesModel.updateMetaData(db, propertyId, batch);
        log.info(
          `${PREFIX} successfully added property: "${propertyId}" updates to batch`
        );
      } catch (err) {
        log.error(`${PREFIX} property meta data update failed: ${err}`);
      }
    }

    // Atomically commit inspection/property writes
    try {
      await batch.commit();
      log.info(
        `${PREFIX} batched updated to inspection "${inspectionId}" successful`
      );
    } catch (err) {
      return send500Error(
        err,
        'inspection/property batch commit failed',
        'unexpected error'
      );
    }

    // Send global notification for an inspection completion
    if (!incognitoMode && inspectionUpdates.inspectionCompleted) {
      const templateName = inspection.templateName || 'Unknown';
      const completionDateUnix =
        inspectionUpdates.completionDate || Math.round(Date.now() / 1000);
      const completionDate = moment(completionDateUnix).format('MMM DD');
      const startDate = moment(inspection.creationDate).format('MM/DD/YY');
      const { score } = inspection;
      const deficientItemCount = inspection.deficientItemCount;

      // Lookup Property
      let propertyName = 'Unknown';
      try {
        const propertySnap = await propertiesModel.findRecord(db, propertyId);
        const property = propertySnap.data() || {};
        propertyName = property.name;
      } catch (err) {
        log.error(`${PREFIX} property lookup failed: ${err}`);
      }

      try {
        await notificationsModel.addRecord(db, {
          title: propertyName,
          summary: notifyTemplate('inspection-completion-summary', {
            completionDate,
            templateName,
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate('inspection-completion-markdown-body', {
            templateName,
            startDate,
            score,
            url: inspection.url,
            deficientItemCount,
            authorName,
            authorEmail,
          }),
          property: propertyId,
          creator: authorId,
        });
        log.info(
          `${PREFIX} inspection completion global notification for inspection: "${inspectionId}" successfully created`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }

    // Successful
    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: inspectionUpdates,
      },
    });

    // Return before updating inspection report PDF
    if (!needsNewReport) {
      return;
    }

    log.info(`${PREFIX} requesting new PDF Report for "${inspectionId}"`);

    try {
      await completePublisher.publish(
        Buffer.from(
          [inspectionId, incognitoMode ? '' : authorId]
            .filter(Boolean)
            .join('/')
        )
      );
      log.info(
        `${PREFIX} published completed inspection report request for: "${inspectionId}" successfully`
      );
    } catch (err) {
      log.error(`${PREFIX} publish event failed: ${err}`);
    }
  };
};
