const fs = require('fs');
const path = require('path');
const uuid = require('./uuid');
const { findStorageFile } = require('./firebase');

const SRC_PROFILE_IMG = 'test-image.jpg';
const PROFILE_IMG_PATH = path.join(
  __dirname,
  `../test/end-to-end/${SRC_PROFILE_IMG}`
);
const PROP_UPLOAD_DIR = 'propertyImagesTest';
const INSP_UPLOAD_DIR = 'inspectionItemImagesTest';
const DEFICENT_UPLOAD_DIR = 'deficientItemImages';

module.exports = {
  profileImagePath: PROFILE_IMG_PATH,
  propertyUploadDir: PROP_UPLOAD_DIR,
  inspectionUploadDir: INSP_UPLOAD_DIR,

  /**
   * Convert a local file to an in memory buffer
   * @param  {String} filePath
   * @return {Promise<Buffer>}
   */
  createFileBuffer(filePath = PROFILE_IMG_PATH) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          return reject(err);
        }

        resolve(data);
      });
    });
  },

  async uploadPropertyImage(bucket, propertyId) {
    const destination = `${PROP_UPLOAD_DIR}/${propertyId}-${Date.now()}${uuid().replace(
      '-',
      ''
    )}-${SRC_PROFILE_IMG}`;
    await bucket.upload(PROFILE_IMG_PATH, {
      gzip: true,
      destination,
    }); // upload file
    const uploadedFile = await findStorageFile(
      bucket,
      PROP_UPLOAD_DIR,
      destination
    ); // find the file
    const [url] = await uploadedFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2491',
    }); // get download URL
    return { url, directory: PROP_UPLOAD_DIR, destination };
  },

  async uploadDeficiencyImage(bucket, propertyId, deficiencyId) {
    const destination = `${DEFICENT_UPLOAD_DIR}/${propertyId}/${deficiencyId}/${SRC_PROFILE_IMG}`;
    await bucket.upload(PROFILE_IMG_PATH, {
      gzip: true,
      destination,
    }); // upload file
    const uploadedFile = await findStorageFile(
      bucket,
      DEFICENT_UPLOAD_DIR,
      destination
    ); // find the file
    const [url] = await uploadedFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2491',
    }); // get download URL
    return { url, directory: DEFICENT_UPLOAD_DIR, destination };
  },
};
