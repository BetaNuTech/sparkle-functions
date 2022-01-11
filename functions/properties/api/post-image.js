const assert = require('assert');
const path = require('path');
const propertiesModel = require('../../models/properties');
const storage = require('../../services/storage');
const imageUtil = require('../../utils/images');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const log = require('../../utils/logger');

const PREFIX = 'property: api: image: post:';

/**
 * Factory for uploading an image POST endpoint
 * that creates Firestore inspection
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {admin.storage} stg instance
 * @return {Function} - onRequest handler
 */
module.exports = function uploadImage(fs, stg) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
    const { propertyId } = req.params;
    const uploadFile = (req.files || [])[0] || null;
    const target = `${req.query.target || 'profile'}`.toLowerCase();
    const mimeType = imageUtil.getMimeType(
      uploadFile ? uploadFile.mimetype : 'n/a'
    );
    const send500Error = create500ErrHandler(PREFIX, res);

    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Uploading property image to: "${target}"${
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

    // Reject bad query param request
    if (['profile', 'logo'].includes(target) === false) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: '"target" query param' },
            title: 'invalid image target identifier',
            detail: `property image target "${target}" not supported`,
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

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(fs, propertyId);
      property = propertySnap.data() || null;
    } catch (err) {
      return send500Error(err, 'property lookup failed', 'unexpected error');
    }

    // Non-existent property
    if (!property) {
      log.error(`${PREFIX} requested property: "${propertyId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'property' },
            title: 'Property not found',
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

    // Process/compress image
    try {
      image = await imageUtil.optimizeImage(image, mimeType);
    } catch (err) {
      return send500Error(err, 'Image manipulation error', 'unexpected error');
    }

    // fetch file and upload to firebase storage
    let fileName = '';
    const updatedData = {};
    if (target === 'profile') {
      fileName = `${propertyId}${path.extname(uploadFile.originalname)}`;
      updatedData.photoURL = '';
      updatedData.photoName = fileName;
    } else if (target === 'logo') {
      fileName = `${propertyId}_logo${path.extname(uploadFile.originalname)}`;
      updatedData.logoURL = '';
      updatedData.logoName = fileName;
      updatedData.bannerPhotoName = fileName;
      updatedData.bannerPhotoURL = '';
    }

    let storageUrl = '';
    try {
      storageUrl = await storage.propertyUpload(
        stg,
        image,
        fileName,
        path.extname(uploadFile.originalname).split('.')[1]
      );
    } catch (err) {
      return send500Error(
        err,
        `Failed to upload image to firebase.`,
        'Firebase storage upload failed'
      );
    }

    // Set new image URL
    if (target === 'profile') {
      updatedData.photoURL = storageUrl;
    } else {
      updatedData.logoURL = storageUrl;
      updatedData.bannerPhotoURL = storageUrl;
    }

    // Update property
    try {
      await propertiesModel.updateRecord(fs, propertyId, updatedData);
    } catch (err) {
      return send500Error(
        err,
        `failed to update property "${propertyId}"`,
        'failed to persist updates'
      );
    }

    // Successful upload
    return res.status(201).send({
      data: {
        id: propertyId,
        type: 'property',
        attributes: { ...updatedData },
      },
    });
  };
};
