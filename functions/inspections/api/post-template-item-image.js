const path = require('path');
const assert = require('assert');
const log = require('../../utils/logger');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const imageUtil = require('../../utils/images');
const inspectionsModel = require('../../models/inspections');
const storageService = require('../../services/storage');
const createPhotoDataId = require('../utils/create-item-photo-data-id');

const PREFIX = 'inspection: api: post-template-item-photo:';

/**
 * Factory for creating an inspection item
 * photo in firebase storate without modifying
 * the inspection record itself
 * @param  {firebaseAdmin.firestore} db - Firestore Admin DB instance
 * @param  {admin.storage} stg instance
 * @return {Function} - request handler
 */
module.exports = function postTemplateItemPhoto(db, stg) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(
    stg && typeof stg.bucket === 'function',
    'has firebase storage instance'
  );

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { inspectionId, itemId } = req.params;
    const uploadFile = (req.files || [])[0] || null;
    const mimeType = imageUtil.getMimeType(
      uploadFile ? uploadFile.mimetype : 'n/a'
    );
    const send500Error = create500ErrHandler(PREFIX, res);

    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Uploading inpsection "${inspectionId}" item: "${itemId}" image: ${
        mimeType ? ' | mime: "' + mimeType + '"' : '' // eslint-disable-line
      }`
    );

    // Reject missing file payload
    if (!uploadFile) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'missing "file" payload' },
            title: 'missing file',
          },
        ],
      });
    }

    // Reject unsupported file types
    if (!mimeType) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'mime type' },
            title: 'File Type Not Supported',
            detail: `"${uploadFile.mimetype}" files are not supported`,
          },
        ],
      });
    }

    // Lookup Inspection
    let inspection = null;
    try {
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
        inspectionId
      );
      inspection = inspectionSnap.data() || null;
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

    const items = (inspection.template || {}).items || {};
    const inspectionItem = items[itemId];
    const hasInspectionItem = Boolean(inspectionItem);

    if (!hasInspectionItem) {
      log.error(
        `${PREFIX} requested inspection item: "${itemId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'item' },
            title: 'Inspection item not found',
          },
        ],
      });
    }

    // Create base64 image to manipulate
    let image = null;
    try {
      image = await imageUtil.createImage(uploadFile.buffer);
    } catch (err) {
      return send500Error(err, 'Image read failed', 'unexpected error');
    }

    // Process & compress image
    try {
      image = await imageUtil.optimizeImage(image, mimeType);
    } catch (err) {
      return send500Error(err, 'Image manipulation error', 'unexpected error');
    }

    // Lookup all published inspection
    // item photo entry file names
    // and merge with inspection item's photos
    //
    // NOTE: inspection item photo ID's are a UNIX
    //       timestamp that must be unique, so previous
    //       upload names are necessary
    const publishedPhotos = JSON.parse(
      JSON.stringify(inspectionItem.photosData || {})
    );
    try {
      const publishedFileNames = await storageService.findAllInspectionItemPhotoFileNames(
        stg,
        inspectionId,
        itemId
      );

      publishedFileNames.forEach(fileName => {
        const photoId = fileName.split('.')[0]; // remove file extension
        publishedPhotos[photoId] = true; // add to published photos hash
      });
    } catch (err) {
      // Allow failure
      log.error(`${PREFIX} previous item photo lookup failed: ${err}`);
    }

    // Fetch file and upload to firebase storage
    let storageUrl = '';
    const photoDataId = createPhotoDataId(publishedPhotos);
    try {
      storageUrl = await storageService.inspectionItemUpload(
        stg,
        image,
        inspectionId,
        itemId,
        photoDataId,
        path.extname(uploadFile.originalname).split('.')[1]
      );
    } catch (err) {
      return send500Error(
        err,
        `Failed to upload image to firebase.`,
        'Firebase storage upload failed'
      );
    }

    // Successful upload
    return res.status(201).send({
      data: {
        id: photoDataId,
        type: 'inspection-item-photo-data',
        attributes: {
          downloadURL: storageUrl,
        },
      },
    });
  };
};
