const assert = require('assert');
const moment = require('moment');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const storageService = require('../../services/storage');
const log = require('../../utils/logger');
const createReportPdf = require('./create');
const inspImages = require('./inspection-images');
const uploader = require('./uploader');
const { clientApps, inspection: inspectionConfig } = require('../../config');

const PREFIX = 'inspections: reportPdf:';
const HTTPS_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/; // eslint-disable-line max-len
const MAX_TIMEOUT = inspectionConfig.reportPdfGenerationMaxTimeout;
const MAX_BYTE_SIZE = inspectionConfig.reportPdfMemoryInBytes;

module.exports = {
  UnexpectedError,
  UnfoundInspectionError,
  BadInspectionError,
  IncompleteInspectionError,
  GeneratingReportError,
  ReportUpToDateError,
  UnfoundPropertyError,
  GenerationFailError,
  ReportUrlLookupError,
  OversizedStorageError,

  /**
   * Regenerate an inspection's PDF Report
   * @param  {admin.firestore} db
   * @pram   {admin.storage} storage
   * @param  {String} inspectionId
   * @param  {Booleaen?} incognitoMode
   * @param  {String?} authorId
   * @param  {String?} authorName
   * @param  {String?} authorEmail
   * @param  {Boolean?} dryRun
   * @return {Promise<Object>} - resolves result payload
   */
  async regenerate(
    db,
    storage,
    inspectionId,
    incognitoMode = false,
    authorId = '',
    authorName = '',
    authorEmail = '',
    dryRun = false
  ) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection ID'
    );
    assert(typeof authorId === 'string', 'author ID is a string');
    assert(typeof authorName === 'string', 'author name is a string');
    assert(typeof authorEmail === 'string', 'author email is a string');
    assert(typeof dryRun === 'boolean', 'has optional dry run boolean');

    let propertyId = '';
    let inspection = null;
    let hasPreviousPDFReport = false;
    const result = { inspection: null, warnings: [] };

    // Lookup Inspection
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
      log.info(
        `${PREFIX} inspection "${inspectionId}" record recovered successfully`
      );
    } catch (err) {
      throw new UnexpectedError(
        `${PREFIX} inspection "${inspectionId}" lookup failed: ${err}`
      );
    }

    // Reject request for invalid inspection
    if (!inspection) {
      throw new UnfoundInspectionError(
        `${PREFIX} inspection "${inspectionId}" does not exist`
      );
    }

    if (!inspection.property) {
      throw new BadInspectionError(
        `${PREFIX} inspection "${inspectionId}" missing property reference`,
        inspection
      );
    }

    // Inspection report PDF cannot be created
    // for an incomplete inspection
    if (!inspection.inspectionCompleted) {
      throw new IncompleteInspectionError(
        `${PREFIX} inspection "${inspectionId}" has not been completed yet`,
        inspection
      );
    }

    // Inspection generation in progress
    if (
      inspection.inspectionReportStatus === 'generating' &&
      isUnderStatusChangeMaxTimeout(inspection)
    ) {
      throw new GeneratingReportError(
        `${PREFIX} inspection "${inspectionId}" PDF report already requested`,
        inspection
      );
    }

    // Inspection report PDF already up to date
    if (inspectionReportUpToDate(inspection)) {
      throw new ReportUpToDateError(
        `${PREFIX} inspection "${inspectionId}" PDF report already up to date`,
        inspection
      );
    }

    // Setup variables for processing request
    propertyId = inspection.property;
    hasPreviousPDFReport = Boolean(inspection.inspectionReportUpdateLastDate);

    // Lookup property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
      log.info(
        `${PREFIX} property "${propertyId}" record recovered successfully`
      );
    } catch (err) {
      throw new UnexpectedError(
        `${PREFIX} failed to lookup inspection "${inspectionId}" property "${propertyId}": ${err}`
      );
    }

    if (!property) {
      throw new UnfoundPropertyError(
        `${PREFIX} inspection "${inspectionId}" property "${propertyId}" not found`,
        inspection
      );
    }

    property.id = propertyId;

    // Lookup byte size of all
    // an inspections uploads
    let folderByteSize = 0;
    try {
      log.info(`${PREFIX} inspection storage calculation started`);
      folderByteSize = await storageService.calculateInspectionFolderByteSize(
        storage,
        inspectionId
      );
      log.info(
        `${PREFIX} inspection storage calculation completed: found ${folderByteSize} bytes`
      );
    } catch (err) {} // eslint-disable-line no-empty

    // Reject creating report we know
    // is too large before downloading
    // item images into memory
    if (folderByteSize >= MAX_BYTE_SIZE) {
      if (!dryRun) await failInspectionReport(db, inspectionId);
      throw new OversizedStorageError(
        `${PREFIX} inspection "${inspectionId}" media ${folderByteSize} bytes is larger than allowcated memory ${MAX_BYTE_SIZE} bytes`,
        inspection
      );
    }

    // Avoid updates if in dry run mode
    if (dryRun) {
      return { inspection, warnings: [] };
    }

    // Set generating report generation status
    try {
      await inspectionsModel.upsertRecord(db, inspectionId, {
        inspectionReportStatus: 'generating',
        inspectionReportStatusChanged: Math.round(Date.now() / 1000),
      });
      log.info(
        `${PREFIX} inspection "${inspectionId}" set to generating successfully`
      );
    } catch (err) {
      throw new UnexpectedError(
        `${PREFIX} setting inspection "${inspectionId}" report status "generating" failed: ${err}`
      );
    }

    // Create item photo data hash
    let inspPhotoData = null;
    try {
      const inspClone = JSON.parse(JSON.stringify(inspection));
      const inspectionUris = await inspImages.download(inspClone);
      inspPhotoData = inspectionUris.template.items;
    } catch (err) {
      await failInspectionReport(db, inspectionId);
      throw new UnexpectedError(
        `${PREFIX} inspection "${inspectionId}" item photo lookup failed: ${err}`
      );
    }

    const reportPdf = createReportPdf(inspection, property, inspPhotoData);

    let pdfBuffer = null;
    try {
      pdfBuffer = await reportPdf.generatePdf();
      log.info(
        `${PREFIX} inspection "${inspectionId}" PDF report generated successfully`
      );
    } catch (err) {
      const failInspupdate = await failInspectionReport(db, inspectionId);
      Object.assign(inspection, failInspupdate);
      throw new GenerationFailError(
        `${PREFIX} inspection "${inspectionId}" PDF generation failed: ${err}`,
        inspection
      );
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
      log.info(
        `${PREFIX} inspection "${inspectionId}" S3 report URL downloaded successfully`
      );
    } catch (err) {
      const failInspupdate = await failInspectionReport(db, inspectionId);
      Object.assign(inspection, failInspupdate);
      throw new ReportUrlLookupError(
        `${PREFIX} inspection "${inspectionId}" S3 report upload failed: ${err}`,
        inspection
      );
    }

    // Set the report's URL
    // and last report update date
    const inspectionUpdates = {
      inspectionReportURL,
      inspectionReportStatus: 'completed_success',
      inspectionReportStatusChanged: Math.round(Date.now() / 1000),
      // Dates must match for clients to
      // check if report is outdated
      inspectionReportUpdateLastDate: inspection.updatedAt,
    };
    try {
      await inspectionsModel.upsertRecord(db, inspectionId, inspectionUpdates);
      log.info(
        `${PREFIX} inspection "${inspectionId}" set to completed successfully`
      );
    } catch (err) {
      await failInspectionReport(db, inspectionId);
      throw new UnexpectedError(
        `${PREFIX} failed to update inspection "${inspectionId}" with report changes: ${err}`
      );
    }

    // Add successful updates to results
    result.inspection = {};
    Object.assign(result.inspection, inspection, inspectionUpdates);

    // Create global notification to
    // notify of new inspection PDF report
    if (!incognitoMode) {
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
          creator: authorId,
          property: property.id,
        });
      } catch (err) {
        result.warnings.push(
          Error(
            `${PREFIX} failed to create inspection "${inspectionId}" PDF creation source notification: ${err}`
          )
        );
      }
    }

    return result;
  },
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
  updatedAt,
}) {
  return (
    updatedAt &&
    typeof updatedAt === 'number' &&
    inspectionReportUpdateLastDate &&
    typeof inspectionReportUpdateLastDate === 'number' &&
    inspectionReportUpdateLastDate >= updatedAt
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
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(inspectionId && typeof inspectionId === 'string', 'has inspection ID');

  const update = {
    inspectionReportStatus: 'completed_failure',
    inspectionReportStatusChanged: Math.round(Date.now() / 1000),
  };

  return inspectionsModel
    .upsertRecord(db, inspectionId, update)
    .then(() => update)
    .catch(err =>
      Promise.reject(
        Error(
          `${PREFIX} setting inspection "${inspectionId}" report status "completed_failure" failed: ${err}`
        )
      )
    );
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

/**
 * Report has not passed function timeout
 * @param  {Object} inspection
 * @return {Boolean} - under timeout
 */
function isUnderStatusChangeMaxTimeout(inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  const inspectionReportStatusChanged =
    inspection.inspectionReportStatusChanged || 0;
  const cutoff = Math.round(Date.now() / 1000) - MAX_TIMEOUT;
  return inspectionReportStatusChanged > cutoff;
}

/**
 * Miscellanious errors
 * @param {String?} message
 */
function UnexpectedError(message = '') {
  this.name = 'UnexpectedError';
  this.message = message;
}
UnexpectedError.prototype = new Error();

/**
 * Inspection unrecoverable error
 * @param {String?} message
 */
function UnfoundInspectionError(message = '') {
  this.name = 'UnfoundInspectionError';
  this.message = message;
}
UnfoundInspectionError.prototype = new Error();

/**
 * Mal-formed Inspection error
 * @param {String?} message
 * @param {Object} inspection
 */
function BadInspectionError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'BadInspectionError';
  this.message = message;
  this.inspection = inspection;
}
BadInspectionError.prototype = new Error();

/**
 * Inspection not completed error
 * @param {String?} message
 * @param {Object} inspection
 */
function IncompleteInspectionError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'IncompleteInspectionError';
  this.message = message;
  this.inspection = inspection;
}
IncompleteInspectionError.prototype = new Error();

/**
 * Inspection report generation is
 * currently in progress
 * @param {String?} message
 * @param {Object} inspection
 */
function GeneratingReportError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'GeneratingReportError';
  this.message = message;
  this.inspection = inspection;
}
GeneratingReportError.prototype = new Error();

/**
 * Inspection report does not
 * need to be updated error
 * @param {String?} message
 * @param {Object} inspection
 */
function ReportUpToDateError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'ReportUpToDateError';
  this.message = message;
  this.inspection = inspection;
}
ReportUpToDateError.prototype = new Error();

/**
 * Inspection's property does not exist
 * @param {String?} message
 * @param {Object} inspection
 */
function UnfoundPropertyError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'UnfoundPropertyError';
  this.message = message;
  this.inspection = inspection;
}
UnfoundPropertyError.prototype = new Error();

/**
 * Inspection's report failed during creation
 * @param {String?} message
 * @param {Object} inspection
 */
function GenerationFailError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'GenerationFailError';
  this.message = message;
  this.inspection = inspection;
}
GenerationFailError.prototype = new Error();

/**
 * Inspection's report URL lookup failed
 * @param {String?} message
 * @param {Object} inspection
 */
function ReportUrlLookupError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'ReportUrlLookupError';
  this.message = message;
  this.inspection = inspection;
}
ReportUrlLookupError.prototype = new Error();

/**
 * Inspection's storage data is too large
 * @param {String?} message
 * @param {Object} inspection
 */
function OversizedStorageError(message = '', inspection) {
  assert(inspection && typeof inspection === 'object', 'has inspection');
  this.name = 'OversizedStorageError';
  this.message = message;
  this.inspection = inspection;
}
OversizedStorageError.prototype = new Error();
