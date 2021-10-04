const assert = require('assert');
const moment = require('moment');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const notificationsModel = require('../../models/notifications');
const createReportPdf = require('./utils/report-pdf');
const inspImages = require('./utils/inspection-images');
const uploader = require('./utils/uploader');
const notifyTemplate = require('../../utils/src-notification-templates');
const { capitalize } = require('../../utils/strings');
const { clientApps } = require('../../config');
const log = require('../../utils/logger');

const PREFIX = 'inspections: api: patch-report-pdf:';
const HTTPS_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/; // eslint-disable-line max-len

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetReportPdfHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Generate an inspection PDF report for an inspection
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspectionId } = req.params;

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Lookup Firebase Inspection
    let propertyId = '';
    let inspection = null;
    let hasPreviousPDFReport = false;

    // Prioritize firestore record
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} inspection lookup failed | ${err}`);
    }

    // Reject request for invalid inspection
    if (!inspection) {
      log.error(`${PREFIX} inspection "${inspectionId}" does not exist`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" could not be found`,
          },
        ],
      });
    }

    if (!inspection.property) {
      log.error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" not associated with a property`,
          },
        ],
      });
    }

    // Inspection report PDF cannot be created
    // for an incomplete inspection
    if (!inspection.inspectionCompleted) {
      log.info(`${PREFIX} inspection PDF is not completed`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" not completed`,
          },
        ],
      });
    }

    // Inspection generation in progress
    if (inspection.inspectionReportStatus === 'generating') {
      log.info(`${PREFIX} inspection PDF report already requested`);
      return res.status(202).send({
        data: {
          id: inspectionId,
          type: 'inspection',
          attributes: { inspectionReportStatus: 'generating' },
        },
      });
    }

    // Inspection report PDF already up to date
    if (inspectionReportUpToDate(inspection)) {
      log.info(`${PREFIX} inspection PDF report already up to date`);
      return res.status(200).send({
        data: {
          id: inspectionId,
          type: 'inspection',
          attributes: {
            inspectionReportURL: inspection.inspectionReportURL,
            inspectionReportStatus: inspection.inspectionReportStatus,
            inspectionReportUpdateLastDate:
              inspection.inspectionReportUpdateLastDate,
          },
        },
      });
    }

    // Setup variables for processing request
    propertyId = inspection.property;
    hasPreviousPDFReport = Boolean(inspection.inspectionReportUpdateLastDate);

    // Lookup property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed | ${err}`);
    }

    if (!property) {
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: associated property "${propertyId}" could not be recovered`,
          },
        ],
      });
    }

    property.id = propertyId;

    // Set generating report generation status
    try {
      await inspectionsModel.upsertRecord(db, inspectionId, {
        inspectionReportStatus: 'generating',
      });
    } catch (err) {
      log.error(`${PREFIX} setting report status "generating" failed | ${err}`);
      return res.status(500).send({
        errors: [{ detail: 'System Failure' }],
      });
    }

    // Create item photo data hash
    let inspPhotoData = null;
    try {
      const inspClone = JSON.parse(JSON.stringify(inspection));
      const inspectionUris = await inspImages.download(inspClone);
      inspPhotoData = inspectionUris.template.items;
    } catch (err) {
      log.error(`${PREFIX} inspection item photo lookup failed | ${err}`);
      await failInspectionReport(db, inspectionId);
      return res.status(500).send({
        errors: [{ detail: 'Inspection Attachment data Error' }],
      });
    }

    const reportPdf = createReportPdf(inspection, property, inspPhotoData);

    let pdfBuffer = null;
    try {
      pdfBuffer = await reportPdf.generatePdf();
    } catch (err) {
      log.error(`${PREFIX} PDF generation failed | ${err}`);
      await failInspectionReport(db, inspectionId);
      return res.status(500).send({
        errors: [{ detail: 'Inspection PDF generation failed' }],
      });
    }

    // Upload Report PDF file to S3
    let inspectionReportURL = '';
    try {
      inspectionReportURL = await uploader.s3(
        pdfBuffer,
        `reports/${inspectionId}/${reportPdf.filename}`
      );
      [inspectionReportURL] = inspectionReportURL
        .split(/\n/)
        .map(s => s.trim())
        .filter(s => s.search(HTTPS_URL) > -1);
    } catch (err) {
      log.error(`${PREFIX} S3 report upload failed | ${err}`);
      await failInspectionReport(db, inspectionId);
      return res.status(500).send({
        errors: [{ detail: 'Inspection Report PDF did not save' }],
      });
    }

    // Set the report's URL
    // and last report update date
    const inspectionUpdates = {
      inspectionReportURL,
      inspectionReportStatus: 'completed_success',
      inspectionReportUpdateLastDate: Math.round(Date.now() / 1000),
    };
    try {
      await inspectionsModel.upsertRecord(db, inspectionId, inspectionUpdates);
    } catch (err) {
      log.error(`${PREFIX} setting PDF report url failed`);
      await failInspectionReport(db, inspectionId);
      return res.status(500).send({
        errors: [{ detail: 'Inspection update failed' }],
      });
    }

    if (!incognitoMode) {
      // Create global notification for
      // inspection PDF report
      const authorName = req.user
        ? capitalize(`${req.user.firstName} ${req.user.lastName}`.trim())
        : '';
      const authorEmail = req.user ? req.user.email : '';

      try {
        const summaryTemplate = hasPreviousPDFReport
          ? 'inspection-pdf-update-summary'
          : 'inspection-pdf-creation-summary';
        const markdownTemplate = hasPreviousPDFReport
          ? 'inspection-pdf-update-markdown-body'
          : 'inspection-pdf-creation-markdown-body';
        const createdAt = formatTimestamp(inspection.creationDate);
        const updatedAt = formatTimestamp(inspection.updatedLastDate);
        const startDate = formatTimestamp(inspection.creationDate);
        const completeDate = formatTimestamp(inspection.completionDate);
        const templateName = inspection.templateName;
        const compiledInspectionUrl = `${clientApps.web.inspectionURL}`
          .replace('{{propertyId}}', property.id)
          .replace('{{inspectionId}}', inspectionId);

        // Notify of new inspection report
        await notificationsModel.addRecord(db, {
          title: property.name,
          summary: notifyTemplate(summaryTemplate, {
            createdAt,
            updatedAt,
            authorName,
            authorEmail,
          }),
          markdownBody: notifyTemplate(markdownTemplate, {
            templateName,
            startDate,
            completeDate,
            reportUrl: inspectionReportURL,
            inspectionUrl: compiledInspectionUrl,
            authorName,
            authorEmail,
          }),
          creator: req.user ? req.user.id || '' : '',
          property: property.id,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification | ${err}`); // proceed with error
      }
    }

    // Send updated inspection
    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: inspectionUpdates,
      },
    });
  };
};

/**
 * Inspections' PDF report is up to
 * date with its' last update date
 * @param  {Number} inspectionReportUpdateLastDate
 * @param  {Number} updatedLastDate
 * @return {Boolean}
 */
function inspectionReportUpToDate({
  inspectionReportUpdateLastDate,
  updatedLastDate,
}) {
  return (
    updatedLastDate &&
    typeof updatedLastDate === 'number' &&
    inspectionReportUpdateLastDate &&
    typeof inspectionReportUpdateLastDate === 'number' &&
    inspectionReportUpdateLastDate > updatedLastDate
  );
}

/**
 * Move Inspection report PDF
 * to completed failure state
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {String} inspectionId
 * @return {Promise}
 */
function failInspectionReport(db, inspectionId) {
  return inspectionsModel
    .upsertRecord(db, inspectionId, {
      inspectionReportStatus: 'completed_failure',
    })
    .then(() => {
      log.info(
        `${PREFIX} updated inspection "${inspectionId}" report status to failed`
      );
    })
    .catch(err => {
      log.error(
        `${PREFIX} setting report status "completed_failure" failed | ${err}`
      );
    });
}

/**
 * Format a UNIX timestamp with moment
 * @param  {Number} timestamp
 * @param  {String?} format
 * @return {String}
 */
function formatTimestamp(timestamp, format = 'MMM DD') {
  if (timestamp && typeof timestamp === 'number') {
    return moment(parseInt(timestamp * 1000, 10)).format(format);
  }
  return '';
}
