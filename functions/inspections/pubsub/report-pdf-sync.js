const assert = require('assert');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const errorsService = require('../../services/errors');
const { inspection: inspectionConfig } = require('../../config');

const PREFIX = 'inspections: pubsub: report-pdf-sync:';
const MAX_TIMEOUT = inspectionConfig.reportPdfGenerationMaxTimeout;

/**
 * Move all lingering inspection
 * reports to a failed status and
 * log the failure
 * @param  {admin.firestore} db
 * @param  {functions.pubsub} pubsub
 * @param  {String} topic
 * @return {functions.CloudFunction}
 */
module.exports = function reportPdfSync(db, pubsub, topic = '') {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub reference');
  assert(topic && typeof topic === 'string', 'has pubsub topic');

  return pubsub.topic(topic).onPublish(async () => {
    const inspectionIds = [];
    const statusChangeCutoff = getNow() - MAX_TIMEOUT;

    // Lookup all queued or generating
    // inspection reports that have passed
    // their maximum timeout
    try {
      const pastDueInspectionsSnap = await inspectionsModel.query(db, {
        inspectionReportStatus: ['in', ['queued', 'generating']], // pre-complete statuses
        inspectionReportStatusChanged: ['<', statusChangeCutoff], // older than timeout cutoff
      });

      pastDueInspectionsSnap.docs.forEach(doc => inspectionIds.push(doc.id));
    } catch (err) {
      throw Error(`${PREFIX} inspections query failed: ${err}`);
    }

    // Send error report if any stalled
    // report PDF's were discovered
    if (inspectionIds.length) {
      try {
        const message = `found ${inspectionIds.length} stalled inspection report PDF (system)`;
        await errorsService.report(message);
      } catch (err) {
        log.error(`${PREFIX} error report failure: ${err}`);
        // Continue with failure
      }
    }

    // Mark as many stalled inspection
    // report PDF's as failed as possible
    for (let i = 0; i < inspectionIds.length; i++) {
      const inspectionId = inspectionIds[i];

      try {
        await inspectionsModel.updateRecord(db, inspectionId, {
          inspectionReportStatus: 'completed_failure',
          inspectionReportStatusChanged: getNow(),
        });
        log.info(
          `${PREFIX} transitioned stalled inspection report for "${inspectionId}" to "completed_failure"`
        );
      } catch (err) {
        log.error(`${PREFIX} failed to transition inspection report: ${err}`);
      }
    }
  });
};

/**
 * Create UNIX timestamp
 * @return {Number}
 */
function getNow() {
  return Math.round(Date.now() / 1000);
}
