const path = require('path');
const assert = require('assert');
const log = require('../../utils/logger');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const imageUtil = require('../../utils/images');
const uuid = require('../../utils/short-uuid');
const deficiencyModel = require('../../models/deficient-items');
const storageService = require('../../services/storage');
// const createPhotoDataId = require('../utils/create-item-photo-data-id');

const PREFIX = 'deficient-items: api: post-image:';

/**
 * Factory for creating a deficient item
 * photo in firebase storate without modifying
 * the deficient record itself
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {admin.storage} stg instance
 * @return {Function} - request handler
 */
module.exports = function postDeficientItemPhoto(db, stg) {
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
    const { deficiencyId } = req.params;
    const uploadFile = (req.files || [])[0] || null;
    const mimeType = imageUtil.getMimeType(
      uploadFile ? uploadFile.mimetype : 'n/a'
    );
    const send500Error = create500ErrHandler(PREFIX, res);

    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Uploading deficient item "${deficiencyId}" image: ${
        mimeType ? ' | mime: "' + mimeType + '"' : '' // eslint-disable-line
      }`
    );

    // Reject missing file payload
    if (!uploadFile) {
      log.error(
        `${PREFIX} deficient item "${deficiencyId}" missing file attachment`
      );
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
      log.error(
        `${PREFIX} deficient item "${deficiencyId}" file attachment has unacceptable mime type`
      );
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

    // Lookup deficiency
    let deficiency = null;
    try {
      const inspectionSnap = await deficiencyModel.findRecord(db, deficiencyId);
      deficiency = inspectionSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'inspection lookup failed', 'unexpected error');
    }

    // Invalid deficiency
    if (!deficiency) {
      log.error(
        `${PREFIX} requested deficient item "${deficiencyId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'deficient-item' },
            title: 'Deficient item not found',
          },
        ],
      });
    }

    log.info(
      `${PREFIX} recovered deficient item "${deficiencyId}" successfully`
    );

    // Create base64 image to manipulate
    let image = null;
    try {
      image = await imageUtil.createImage(uploadFile.buffer);
      log.info(
        `${PREFIX} processed deficient item "${deficiencyId}" image successfully`
      );
    } catch (err) {
      return send500Error(err, 'Image read failed', 'unexpected error');
    }

    // Process & compress image
    try {
      image = await imageUtil.optimizeImage(image, mimeType);
      log.info(
        `${PREFIX} optimized deficient item "${deficiencyId}" image successfully`
      );
    } catch (err) {
      return send500Error(err, 'Image manipulation error', 'unexpected error');
    }

    // Fetch file and upload to firebase storage
    let storageUrl = '';
    const photoId = uuid();
    try {
      storageUrl = await storageService.deficientItemUpload(
        stg,
        image,
        deficiency.property,
        deficiencyId,
        photoId,
        path.extname(uploadFile.originalname).split('.')[1]
      );
      log.info(
        `${PREFIX} deficient item "${deficiencyId}" image uploaded successfully to: "${storageUrl}"`
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
        id: photoId,
        type: 'deficient-item-photo-data',
        attributes: {
          downloadURL: storageUrl,
        },
      },
    });
  };
};
