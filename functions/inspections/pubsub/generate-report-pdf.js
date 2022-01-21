const assert = require('assert');
const log = require('../../utils/logger');
const usersModel = require('../../models/users');
const reportPdf = require('../report-pdf');
const { getFullName } = require('../../utils/user');

const PREFIX = 'inspections: pubsub: generate-report-pdf:';

/**
 * Generate a new inspection PDF report
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {admin.storage} storage
 * @param  {String} topic
 * @return {functions.CloudFunction}
 */
module.exports = function generateReportPdf(db, pubsub, storage, topic = '') {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(storage && typeof storage.bucket === 'function', 'has storage');
  assert(topic && typeof topic === 'string', 'has pubsub topic');

  return pubsub.topic(topic).onPublish(async message => {
    let authorId = '';
    let inspectionId = '';

    // Parse event message data
    try {
      [inspectionId, authorId] = parseEventMsg(message);
    } catch (err) {
      throw Error(`${PREFIX} parse pubsub message failed: ${err}`);
    }

    log.info(`${PREFIX} generating a new PDF Report for "${inspectionId}"`);

    let user = null;
    if (authorId) {
      try {
        const userSnap = await usersModel.findRecord(db, authorId);
        user = userSnap.data() || null;
      } catch (err) {
        log.error(`${PREFIX} user "${authorId}" lookup failed: ${err}`);
        // Continute without generating notification
      }
    }

    let incognitoMode = true;
    let authorName = '';
    let authorEmail = '';
    if (user) {
      try {
        authorName = getFullName(user);
        authorEmail = user.email || '';
        incognitoMode = !authorName; // Deactivated when author discoverd
        log.info(
          `${PREFIX} author "${authorId}" information recovered successfully`
        );
      } catch (err) {
        log.error(`${PREFIX} user "${authorId}" destructuring failed: ${err}`);

        // Sanity check
        incognitoMode = true;
        authorName = '';
        authorEmail = '';
      }
    }

    const warnings = [];
    try {
      const result = await reportPdf.regenerate(
        db,
        storage,
        inspectionId,
        incognitoMode,
        authorId,
        authorName,
        authorEmail
      );
      warnings.push(...result.warnings);
    } catch (err) {
      // Replace old inspection state
      const inspection = err.inspection || null;

      // Log report status failure
      if (
        inspection &&
        inspection.inspectionReportStatus === 'completed_failure'
      ) {
        log.info(
          `${PREFIX} updated inspection "${inspectionId}" report status set to failed`
        );
      }

      // Could not find inspection
      if (err instanceof reportPdf.UnfoundInspectionError) {
        log.error(`${PREFIX} missing requested inspection: ${err}`);
      }

      // Inspection has not property reference
      if (err instanceof reportPdf.BadInspectionError) {
        log.error(`${PREFIX} bad inspection record: ${err}`);
      }

      // Cannot create report for incomplete inspection
      if (err instanceof reportPdf.IncompleteInspectionError) {
        log.error(
          `${PREFIX} requested to generate report for incomplete inspection: ${err}`
        );
      }

      if (err instanceof reportPdf.OversizedStorageError) {
        log.error(
          `${PREFIX} requested to generate report for oversized inspection: ${err}`
        );
      }

      // Report PDF generation is currently in progress
      if (err instanceof reportPdf.GeneratingReportError) {
        log.error(
          `${PREFIX} requested report for inspection already generating report: ${err}`
        );
      }

      // Inspection does not need a new report
      if (err instanceof reportPdf.ReportUpToDateError) {
        log.error(
          `${PREFIX} requested report for up to date inspection: ${err}`
        );
      }

      // Inspection's property doesn't exist
      if (err instanceof reportPdf.UnfoundPropertyError) {
        log.error(
          `${PREFIX} requested report for inspection without property: ${err}`
        );
      }

      // Failed to add/replace inspections PDF report
      if (err instanceof reportPdf.GenerationFailError) {
        log.error(`${PREFIX} PDF generation failed: ${err}`);
      }

      // Could not load PDF report URL
      if (err instanceof reportPdf.ReportUrlLookupError) {
        log.error(`${PREFIX} S3 report upload failed: ${err}`);
      }

      // Unexpected error
      log.error(`${PREFIX} unexpected PDF report error: ${err}`);
    }

    // Log any warnings
    warnings.forEach(err => {
      log.error(`${PREFIX} warning: ${err}`);
    });
  });
};

/**
 * Extracts data from topic: `complete-inspection-update` message
 * @param  {Object} message
 * @return {String[]} - property ID and an optional user ID
 */
function parseEventMsg(message) {
  const err = Error('Badly formed message');
  const path =
    message && message.data
      ? Buffer.from(message.data, 'base64').toString()
      : '';

  if (!path) {
    throw err;
  }

  const [inspectionId, userId = ''] = path.split('/');

  if (!inspectionId) {
    throw err;
  }

  return [inspectionId, userId];
}
