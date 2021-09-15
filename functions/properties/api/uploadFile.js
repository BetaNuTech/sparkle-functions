const assert = require('assert');
const fileSystem = require('fs');
const path = require('path');
const Jimp = require('jimp');
const propertiesModel = require('../../models/properties');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const log = require('../../utils/logger');
const PREFIX = 'property: api: image: post:';

/**
 * Factory for uploading an image POST endpoint
 * that creates Firestore inspection
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param {Object} storage
 * @return {Function} - onRequest handler
 */
module.exports = function uploadImage(fs, storage) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle POST request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const uploadFile = req.file;
    const { flag = 'profile' } = req.query;
    const { propertyId } = req.params;
    const send500Error = create500ErrHandler(PREFIX, res);
    try {
      const lenna = await Jimp.read(uploadFile.path);
      await lenna
        .resize(1500, Jimp.AUTO) // resize
        .quality(76) // set JPEG quality
        .write(uploadFile.path); // update current file with updation

      // fetch file and upload to firebase storage
      let fileName = '';
      let updatedData = {};
      if (flag === 'profile') {
        fileName = `${propertyId}${path.extname(uploadFile.originalname)}`;
        updatedData.photoURL = '';
        updatedData.photoName = fileName;
      } else if (flag === 'logo') {
        fileName = `${propertyId}_logo${path.extname(uploadFile.originalname)}`;
        updatedData.logoURL = '';
        updatedData.logoName = fileName;
      } else {
        return send500Error(
          `Invalid flag type for image`,
          `Invalid flag type for image.`,
          'Invalid flag'
        );
      }
      const response = await propertiesModel.Upload(
        storage,
        uploadFile.path,
        fileName
      );
      // remove the image from local
      fileSystem.unlink(uploadFile.path, err => {
        if (err)
          log.error(`${PREFIX} failed to delete local file reference | ${err}`);
        else {
          log.info(`${PREFIX} removed local file reference.`);
        }
      });

      flag === 'profile'
        ? (updatedData.photoURL = response[1].mediaLink)
        : (updatedData.logoURL = response[1].mediaLink);

      // update propertyUpdate
      await propertiesModel.firestoreUpdateRecord(fs, propertyId, updatedData);
      return res.status(201).send({
        message: 'success',
      });
    } catch (err) {
      return send500Error(
        err,
        `failed to fetch image.`,
        'failed to upload Image'
      );
    }
  };
};
