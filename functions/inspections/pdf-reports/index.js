const co = require('co');
const Jimp = require('jimp');
const moment = require('moment');
const base64ItemImage = require('./base-64-item-image');
const createAndUploadInspection = require('./create-and-upload-inspection');
const sendToUsers = require('../../push-messages/send-to-users');
const log = require('../../utils/logger');

const {keys, assign} = Object;
const HTTPS_URL = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/; // eslint-disable-line max-len
const LOG_PREFIX = 'inspections: pdf-reports:';

/**
 * Factory for inspection PDF generator endpoint
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.messaging} messaging - Firebase Admin messaging service instance
 * @return {Function} - onRequest handler
 */
module.exports = function createPDFReportHandler(db, messaging) {
  /**
   * Generate an inspection report PDF from an inspection
   * - Convert all inspection item Photos to base64 encoded
   * - Convert inspection & property to PDF steps
   * - Apply steps to a jsPDF instance
   * - Send result: base 64 PDF document
   * @param  {Object}   req Express req
   * @param  {Object}   res Express res
   * @return {Promise}  response
   */
  return function getInspectionPDF(req, res) {
    return co(function* () {
      // Lookup & adjust property / inspection records
      const propertyReq = yield db.ref(req.params.property).once('value');
      const property = propertyReq.val();
      property.id = req.params.property;
      const inspectionReq = yield db.ref(req.params.inspection).once('value');
      const inspection = insertInspectionItemImageUris(inspectionReq.val());
      inspection.id = req.params.inspection;
      const adminEditor = req.query.adminEditor || '';

      // Generate inspection PDF and get it's download link
      let inspectionReportURL = yield createAndUploadInspection(property, inspection);
      [inspectionReportURL] = inspectionReportURL
        .split(/\n/)
        .map(s => s.trim())
        .filter(s => s.search(HTTPS_URL) > -1);

      // Create firebase `sendMessages` records about
      // inspection PDF for each relevant user
      const creationDate = moment(
        parseInt(inspection.creationDate * 1000, 10)
      ).format('MMMM D');

      const author = capitalize(adminEditor || inspection.inspectorName);
      const actionType = adminEditor ? 'updated' : 'created';

      try {
       // Notify recipients of new inspection report
        yield sendToUsers({
          db,
          messaging,
          title: property.name,
          message: `${creationDate} Inspection Report ${actionType} by ${author}`,
          excludes: [req.user.id], // remove sender from message recipients
          allowCorp: true,
          property: property.id
        });
      } catch(e) {
        log.error(`${LOG_PREFIX} ${e}`); // proceed with error
      }

      // Resolve URL to download inspection report PDF
      res.send({inspectionReportURL});
    }).catch(e => {
      log.error(`${LOG_PREFIX} ${e}`);
      res.status(500).send({
        statusCode: 500,
        message: 'PDF generation failed'
      });
    });
  }
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
 * @return {Object} inspection
 */
function insertInspectionItemImageUris(inspection) {
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
}
