const Jimp = require('jimp');
const assert = require('assert');
const moment = require('moment');
const base64ItemImage = require('./base-64-item-image');
const createAndUploadInspection = require('./create-and-upload-inspection-pdf');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const log = require('../../utils/logger');

const { keys, assign } = Object;
const HTTPS_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/; // eslint-disable-line max-len
const PREFIX = 'inspections: pdf-reports:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {String} inspectionUrl - template for an inspection's URL
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGETPDFReportHandler(fs, inspectionUrl) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(
    inspectionUrl && typeof inspectionUrl === 'string',
    'has inspection URL template'
  );

  /**
   * Generate an inspection report PDF from an inspection
   * - Convert all inspection item Photos to base64 encoded
   * - Convert inspection & property to PDF steps
   * - Apply steps to a jsPDF instance
   * - Send result: base 64 PDF document
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspection: inspectionId } = req.params;
    log.info(`${PREFIX} inspection PDF requested for: ${inspectionId}`);

    // Lookup Firebase Inspection
    let propertyId = '';
    let inspectionData = null;
    let hasPreviousPDFReport = false;

    // Prioritize firestore record
    try {
      const inspectionDoc = await inspectionsModel.firestoreFindRecord(
        fs,
        inspectionId
      );
      inspectionData = inspectionDoc.data() || null;
    } catch (err) {
      log.error(`${PREFIX} inspection lookup failed | ${err}`);
    }

    if (!inspectionData) {
      log.error(`${PREFIX} inspection "${inspectionId}" does not exist`);
      return res.status(400).send({ message: 'Bad Inspection' });
    }

    if (!inspectionData.property) {
      log.error(
        `${PREFIX} inspection "${inspectionId}" missing property reference`
      );
      return res.status(400).send({ message: 'Bad Inspection' });
    }

    // Setup variables for processing request
    propertyId = inspectionData.property;
    hasPreviousPDFReport = Boolean(
      inspectionData.inspectionReportUpdateLastDate
    );

    // Prioritize Firestore property record
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      property = propertySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} firestore property lookup failed | ${err}`);
      return res.status(400).send({ message: 'Bad Property' });
    }

    property.id = propertyId;

    // Append item photo data
    // to inspection record
    let inspection = null;
    try {
      inspection = await insertInspectionItemImageUris(inspectionData);
      inspection.id = inspectionId;
    } catch (err) {
      log.error(`${PREFIX} inspection item photo lookup failed | ${err}`);
      return res.status(500).send({ message: 'Inspection Photo Error' });
    }

    // const adminEditor = req.query.adminEditor || '';

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    if (inspection.inspectionReportStatus === 'generating') {
      log.info(`${PREFIX} inspection PDF report already requested`);
      return res.status(200).send({
        status: inspection.inspectionReportStatus,
        message: 'report is being generated',
      });
    }
    if (inspectionReportUpToDate(inspection)) {
      log.info(`${PREFIX} inspection PDF report already up to date`);
      return res.status(304).send();
    }
    if (!inspection.inspectionCompleted) {
      log.info(`${PREFIX} inspection PDF is not completed`);
      return res.status(400).send({ message: 'inspection not complete' });
    }

    // Set generating report generation status
    try {
      await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, {
        inspectionReportStatus: 'generating',
      });
      log.info(`${PREFIX} updated report status to "generating"`);
    } catch (err) {
      log.error(`${PREFIX} setting report status "generating" failed | ${err}`);
      return res.status(500).send({ message: 'System Failure' });
    }

    // Payload
    let inspectionReportURL;

    try {
      // Generate inspection PDF and get it's download link
      inspectionReportURL = await createAndUploadInspection(
        property,
        inspection
      );
      [inspectionReportURL] = inspectionReportURL
        .split(/\n/)
        .map(s => s.trim())
        .filter(s => s.search(HTTPS_URL) > -1);

      log.info(`${PREFIX} PDF report successfully generated`);

      // Set the report's URL
      try {
        await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, {
          inspectionReportURL,
        });
        log.info(`${PREFIX} updated inspection report url`);
      } catch (err) {
        log.error(`${PREFIX} setting PDF report url failed`);
        throw err;
      }

      // Set inspetion reports last update date
      try {
        await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, {
          inspectionReportUpdateLastDate: Math.round(Date.now() / 1000),
        });
        log.info(`${PREFIX} updated PDF report last update date`);
      } catch (err) {
        log.error(`${PREFIX} setting PDF report update date failed`);
        throw err;
      }

      // Set PDF status to successful
      try {
        await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, {
          inspectionReportStatus: 'completed_success',
        });
        log.info(`${PREFIX} updated report status to successful`);
      } catch (err) {
        log.error(`${PREFIX} setting report status "completed_success" failed`);
        throw err;
      }
    } catch (err) {
      log.error(`${PREFIX} ${err}`);

      // Update report status to failed
      try {
        await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, {
          inspectionReportStatus: 'completed_failure',
        });
        log.info(`${PREFIX} updated report status to failure`);
      } catch (errStatus) {
        log.error(
          `${PREFIX} setting report status "completed_failure" failed | ${errStatus}`
        );
      }

      // Send failed response
      res.status(500).send({ message: 'PDF generation failed' });
      return;
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
        const compiledInspectionUrl = `${inspectionUrl}`
          .replace('{{propertyId}}', property.id)
          .replace('{{inspectionId}}', inspectionId);

        // Notify of new inspection report
        await notificationsModel.firestoreAddRecord(fs, {
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

    // Resolve URL to download inspection report PDF
    res.status(200).send({ inspectionReportURL });
  };
};

/**
 * Convert a string: Into A Title
 * @param  {String} str input
 * @return {String} - str transformed
 */
function capitalize(str) {
  return `${str}`
    .toLowerCase()
    .split(' ')
    .map(s => `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`)
    .join(' ');
}

/**
 * Insert datauri's into an inspections items
 * NOTE: creates side effects on inspection
 * @param  {Object} inspection
 * @return {Promise} - resolves {Object} inspection
 */
async function insertInspectionItemImageUris(inspection) {
  // All items with upload(s) or signature image
  const items = keys(inspection.template.items || {})
    .map(id => assign({ id }, inspection.template.items[id]))
    .filter(item => item.photosData || item.signatureDownloadURL);

  // Flatten image photos into single array
  const imagePhotoUrls = []
    .concat(
      ...items.map(item => {
        if (item.photosData) {
          // Create list of item's upload(s) configs
          return keys(item.photosData).map(id => ({
            id,
            itemId: item.id,
            url: item.photosData[id].downloadURL,
          }));
        }
        // Create signature image configs
        return [
          {
            id: item.signatureTimestampKey,
            itemId: item.id,
            url: item.signatureDownloadURL,
          },
        ];
      })
    )
    .filter(({ url }) => Boolean(url)); // remove empty uploads

  const imageuris = await Promise.all(
    imagePhotoUrls.map(({ url, itemId }) => {
      const itemSrc = inspection.template.items[itemId];
      const isSignatureItem = Boolean(itemSrc.signatureDownloadURL);

      if (isSignatureItem) {
        return base64ItemImage(url, [600, 180], Jimp.PNG_FILTER_AUTO);
      }
      return base64ItemImage(url);
    })
  );

  // Insert base64 image JSON into original
  // items' `photoData` JSON or `signatureDownloadURL`
  imagePhotoUrls.forEach(img => {
    // Find image's base64 JSON
    const [base64img] = imageuris.filter(
      imguri => imguri.downloadURL === img.url
    );
    const itemSrc = inspection.template.items[img.itemId];
    const isSignatureItem = Boolean(itemSrc.signatureDownloadURL);

    // Remove undiscovered image reference
    if (!base64img) {
      if (itemSrc.photosData) delete itemSrc.photosData[img.id];
      if (isSignatureItem) delete itemSrc.signatureDownloadURL;
      return;
    }

    // Merge base64 data into image hash
    if (isSignatureItem) {
      itemSrc.signatureData = assign({}, base64img);
    } else {
      assign(itemSrc.photosData[img.id], base64img);
    }
  });

  return inspection;
}

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
