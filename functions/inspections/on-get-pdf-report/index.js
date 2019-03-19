const co = require('co');
const Jimp = require('jimp');
const assert = require('assert');
const moment = require('moment');
const express = require('express');
const cors = require('cors');
const base64ItemImage = require('./base-64-item-image');
const createAndUploadInspection = require('./create-and-upload-inspection-pdf');
const sendToUsers = require('../../push-messages/send-to-users');
const authUser = require('../../utils/auth-firebase-user');
const log = require('../../utils/logger');

const {keys, assign} = Object;
const HTTPS_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/; // eslint-disable-line max-len
const LOG_PREFIX = 'inspections: pdf-reports:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} messaging - Firebase Admin messaging service instance
 * @param  {firebaseAdmin.auth?} auth - Firebase Admin auth service instance (optional for testing)
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetPDFReportHandler(db, messaging, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(messaging), 'has firebase messaging instance');
  if (process.env.NODE_ENV !== 'test') assert(Boolean(auth), 'has firebase auth instance');

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
  const getInspectionPDFHandler = (req, res) => {
    return co(function* () {
      // Lookup & adjust property / inspection records
      const propertyReq = yield db.ref(`/properties/${req.params.property}`).once('value');
      const property = propertyReq.val();
      property.id = req.params.property;
      const inspectionReq = yield db.ref(`/inspections/${req.params.inspection}`).once('value');
      const inspection = yield insertInspectionItemImageUris(inspectionReq.val());
      inspection.id = req.params.inspection;
      const adminEditor = req.query.adminEditor || '';

      // Optional incognito mode query
      // defaults to false
      const incognitoMode = req.query.incognitoMode ? (req.query.incognitoMode.search(/true/i) > -1 ? true : false) : false;

      log.info(`${LOG_PREFIX} generating property: ${property.id} inspection report PDF for: ${inspection.id}`);

      if (inspection.inspectionReportStatus === 'generating') {
        return res.status(200).send({
          status: inspection.inspectionReportStatus,
          message: 'report is being generated'
        });
      } else if (inspectionReportUpToDate(inspection)) {
        return res.status(200).send({
          status: inspection.inspectionReportStatus,
          message: 'report already up to date',
          inspectionReportURL: inspection.inspectionReportURL
        });
      }

      // Set report generation status
      yield db.ref(`/inspections/${inspection.id}/inspectionReportStatus`).set('generating');
      log.info(`${LOG_PREFIX} updated ${inspection.id} report status to generating`);

      // Generate inspection PDF and get it's download link
      let inspectionReportURL = yield createAndUploadInspection(property, inspection);
      [inspectionReportURL] = inspectionReportURL
      .split(/\n/)
      .map(s => s.trim())
      .filter(s => s.search(HTTPS_URL) > -1);

      log.info(`${LOG_PREFIX} inspection ${inspection.id} PDF report successfully generated`);

      // Set the report's last updated data
      yield db.ref(`/inspections/${inspection.id}/inspectionReportURL`).set(inspectionReportURL);
      log.info(`${LOG_PREFIX} updated ${inspection.id} report url`);
      yield db.ref(`/inspections/${inspection.id}/inspectionReportUpdateLastDate`).set(Date.now() / 1000);
      log.info(`${LOG_PREFIX} updated ${inspection.id} report last update date`);
      yield db.ref(`/inspections/${inspection.id}/inspectionReportStatus`).set('completed_success');
      log.info(`${LOG_PREFIX} updated ${inspection.id} report status to successful`);

      if (!incognitoMode) {
        // Create firebase `sendMessages` records about
        // inspection PDF for each relevant user
        const creationDate = moment(
          parseInt(inspection.creationDate * 1000, 10)
        ).format('MMMM D');

        const author = capitalize(decodeURIComponent(adminEditor || inspection.inspectorName));
        const actionType = adminEditor ? 'updated' : 'created';

        try {
          // Notify recipients of new inspection report
          yield sendToUsers({
            db,
            messaging,
            title: property.name,
            message: `${creationDate} Sparkle Report ${actionType} by ${author}`,
            excludes: req.user ? [req.user.id] : [],
            allowCorp: true,
            property: property.id
          });
        } catch(e) {
          log.error(`${LOG_PREFIX} send-to-users: ${e}`); // proceed with error
        }
      }

      // Resolve URL to download inspection report PDF
      res.status(200).send({inspectionReportURL});
    }).catch(e => {
      log.error(`${LOG_PREFIX} ${e}`);

      // Update report status for failure
      db.ref(`/inspections/${req.params.inspection}/inspectionReportStatus`).set('completed_failure');

      // Send failed response
      res.status(500).send({message: 'PDF generation failed'});
    });
  }

  // Create express app with single endpoint
  // that configures required url params
  const app = express();
  app.use(cors());
  const middleware = [auth ? authUser(db, auth) : null, getInspectionPDFHandler].filter(Boolean);
  app.get('/:property/:inspection', ...middleware);
  return app;
}

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
function insertInspectionItemImageUris(inspection) {
  return co(function *() {
    // All items with upload(s) or signature image
    const items = keys(inspection.template.items || {})
      .map(id => assign({id}, inspection.template.items[id]))
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
              url: item.photosData[id].downloadURL
            }));
          } else {
            // Create signature image configs
            return [{
              id: item.signatureTimestampKey,
              itemId: item.id,
              url: item.signatureDownloadURL
            }];
          }
        })
      )
      .filter(({url}) => Boolean(url)); // remove empty uploads

    const imageuris = yield Promise.all(
      imagePhotoUrls.map(({url, itemId}) => {
        const itemSrc = inspection.template.items[itemId];
        const isSignatureItem = Boolean(itemSrc.signatureDownloadURL);

        if (isSignatureItem) {
          return base64ItemImage(url, [600, 180], Jimp.PNG_FILTER_AUTO);
        } else {
          return base64ItemImage(url);
        }
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
        assign(
          itemSrc.photosData[img.id],
          base64img
        );
      }
    });

    return inspection;
  });
}

/**
 * Inspections' PDF report is up to
 * date with its' last update date
 * @param  {Number} inspectionReportUpdateLastDate
 * @param  {Number} updatedLastDate
 * @return {Boolean}
 */
function inspectionReportUpToDate({ inspectionReportUpdateLastDate, updatedLastDate }) {
  return (
    updatedLastDate && typeof updatedLastDate === 'number' &&
    inspectionReportUpdateLastDate && typeof inspectionReportUpdateLastDate === 'number' &&
    inspectionReportUpdateLastDate > updatedLastDate
  );
}
