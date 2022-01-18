const assert = require('assert');
const reportPdf = require('../report-pdf');
const log = require('../../utils/logger');
const inspectionsModel = require('../../models/inspections');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch-report-pdf:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} db
 * @param  {admin.storage} storage
 * @param  {admin.functions.pubsub.Publisher} completePublisher - publisher for complete inspection update event
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchReportPdfHandler(
  db,
  storage,
  completePublisher
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(storage && typeof storage.bucket === 'function', 'has storage');
  assert(
    completePublisher && typeof completePublisher.publish === 'function',
    'has publisher'
  );

  /**
   * Generate an inspection PDF report for an inspection
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspectionId } = req.params;
    const authorId = req.user ? req.user.id || '' : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    // Determine if any errors would
    // result from generating PDF report
    // and send an informative response to
    // the user so they know why it failed
    let dryRunErr = null;
    let inspection = null;
    try {
      await reportPdf.regenerate(
        db,
        storage,
        inspectionId,
        true, // incognito
        '',
        '',
        '',
        true // dry run request
      );
    } catch (err) {
      dryRunErr = err;
      inspection = err.inspection || null;
    }

    // Could not find inspection
    if (dryRunErr instanceof reportPdf.UnfoundInspectionError) {
      log.error(`${PREFIX} missing requested inspection: ${dryRunErr}`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" could not be found`,
          },
        ],
      });
    }

    // Inspection has no property reference
    if (dryRunErr instanceof reportPdf.BadInspectionError) {
      log.error(`${PREFIX} bad inspection record: ${dryRunErr}`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" not associated with a property`,
          },
        ],
      });
    }

    // Cannot create report for incomplete inspection
    if (dryRunErr instanceof reportPdf.IncompleteInspectionError) {
      log.error(
        `${PREFIX} requested to generate report for incomplete inspection: ${dryRunErr}`
      );
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: inspection "${inspectionId}" not completed`,
          },
        ],
      });
    }

    // Report PDF generation is currently in progress
    if (dryRunErr instanceof reportPdf.GeneratingReportError) {
      log.error(
        `${PREFIX} requested report for inspection already generating report: ${dryRunErr}`
      );
      return res.status(202).send({
        data: {
          id: inspectionId,
          type: 'inspection',
          attributes: { inspectionReportStatus: 'generating' },
        },
      });
    }

    // Inspection does not need a new report
    if (dryRunErr instanceof reportPdf.ReportUpToDateError) {
      log.error(
        `${PREFIX} requested report for up to date inspection: ${dryRunErr}`
      );
      return res.status(200).send({
        data: {
          id: inspectionId,
          type: 'inspection',
          attributes: {
            inspectionReportURL: inspection
              ? inspection.inspectionReportURL
              : '',
            inspectionReportStatus: inspection
              ? inspection.inspectionReportStatus
              : '',
            inspectionReportUpdateLastDate: inspection
              ? inspection.inspectionReportUpdateLastDate
              : '',
          },
        },
      });
    }

    // Inspection's property doesn't exist
    if (dryRunErr instanceof reportPdf.UnfoundPropertyError) {
      log.error(`${PREFIX} property lookup failed: ${dryRunErr}`);
      return res.status(400).send({
        errors: [
          {
            detail: `Bad Request: associated property "${
              inspection ? inspection.property : ''
            }" could not be recovered`,
          },
        ],
      });
    }

    // Inspection is too large for allocated memory
    if (dryRunErr instanceof reportPdf.OversizedStorageError) {
      log.error(`${PREFIX} inspection storage oversized failure: ${dryRunErr}`);
      return res.status(400).send({
        errors: [
          {
            title: 'Oversized inspection',
            detail: `inspection "${inspectionId}" is oversized, please contact an admin`,
          },
        ],
      });
    }

    const updates = {
      inspectionReportStatus: 'queued',
      inspectionReportStatusChanged: Math.round(Date.now() / 1000),
    };

    try {
      await inspectionsModel.updateRecord(db, inspectionId, updates);
    } catch (err) {
      return send500Error(err, 'Inspection update failed', 'unexpected error');
    }

    // Send updated inspection
    res.status(201).send({
      data: {
        id: inspectionId,
        type: 'inspection',
        attributes: updates,
      },
    });

    try {
      await completePublisher.publish(
        Buffer.from(
          [inspectionId, incognitoMode ? '' : authorId]
            .filter(Boolean)
            .join('/')
        )
      );
    } catch (err) {
      log.error(`${PREFIX} publish event failed: ${err}`);
    }
  };
};
