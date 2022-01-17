const assert = require('assert');
const { getFullName } = require('../../utils/user');
const log = require('../../utils/logger');
const reportPdf = require('../report-pdf');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'inspections: api: patch-report-pdf:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPatchReportPdfHandler(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Generate an inspection PDF report for an inspection
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspectionId } = req.params;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    let inspection = null;
    const warnings = [];
    try {
      const result = await reportPdf.regenerate(
        db,
        inspectionId,
        incognitoMode,
        authorId,
        authorName,
        authorEmail
      );
      warnings.push(...result.warnings);
      inspection = result.inspection; // contains updates
    } catch (err) {
      inspection = err.inspection || null;

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
        return res.status(400).send({
          errors: [
            {
              detail: `Bad Request: inspection "${inspectionId}" could not be found`,
            },
          ],
        });
      }

      // Inspection has not property reference
      if (err instanceof reportPdf.BadInspectionError) {
        log.error(`${PREFIX} bad inspection record: ${err}`);
        return res.status(400).send({
          errors: [
            {
              detail: `Bad Request: inspection "${inspectionId}" not associated with a property`,
            },
          ],
        });
      }

      // Cannot create report for incomplete inspection
      if (err instanceof reportPdf.IncompleteInspectionError) {
        log.error(
          `${PREFIX} requested to generate report for incomplete inspection: ${err}`
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
      if (err instanceof reportPdf.GeneratingReportError) {
        log.error(
          `${PREFIX} requested report for inspection already generating report: ${err}`
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
      if (err instanceof reportPdf.ReportUpToDateError) {
        log.error(
          `${PREFIX} requested report for up to date inspection: ${err}`
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
      if (err instanceof reportPdf.UnfoundPropertyError) {
        log.error(`${PREFIX} property lookup failed: ${err}`);
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

      // Failed to add/replace inspections PDF report
      if (err instanceof reportPdf.GenerationFailError) {
        log.error(`${PREFIX} PDF generation failed: ${err}`);
        return res.status(500).send({
          errors: [{ detail: 'Inspection PDF generation failed' }],
        });
      }

      // Could not load PDF report URL
      if (err instanceof reportPdf.ReportUrlLookupError) {
        log.error(`${PREFIX} S3 report upload failed: ${err}`);
        return res.status(500).send({
          errors: [{ detail: 'Inspection Report PDF did not save' }],
        });
      }

      // Unexpected error
      return send500Error(err, 'system error', 'unexpected error');
    }

    // Log acceptable errors
    warnings.forEach(err => {
      log.error(`${PREFIX} warning: ${err}`);
    });

    // Send updated inspection
    res.status(201).send({
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
  };
};
