const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const inspUtils = require('../utils/inspection');

const PROPERTY_BUCKET_NAME = `propertyImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;
const INSP_BUCKET_NAME = `inspectionItemImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;
const DEF_BUCKET_NAME = 'deficientItemImages';
const PREFIX = 'services: storage:';

module.exports = {
  /**
   * Uploading image to property storage
   * @param  {admin.storage} storage instance
   * @param  {Buffer} buffer to be uploaded to storage
   * @param  {String} file name to include in storage url path
   * @param  {String} ext, file type extension included in storage path
   * @return {Promise} - resolves {string} property download URL
   */
  propertyUpload(storage, buffer, fileName, ext) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(buffer instanceof Buffer, 'has buffer to upload');
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(ext && typeof ext === 'string', 'has file extension');

    const dest = `${PROPERTY_BUCKET_NAME}/${fileName}`;

    // Initiate upload
    return this._upload(storage, buffer, dest, ext).catch(err =>
      Promise.reject(Error(`${PREFIX}: propertyUpload: ${err}`))
    );
  },

  /**
   * Calculate the byte size of all files in
   * an inspection's media folder
   * @param  {admin.storage} storage
   * @param  {String} inspectionId
   * @return {Promise<Number>} - total size in bytes
   */
  async calculateInspectionFolderByteSize(storage, inspectionId) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );

    // Get inspection's photo bucket
    let bucket = null;
    try {
      [bucket] = await storage
        .bucket()
        .get(`${INSP_BUCKET_NAME}/${inspectionId}`);
    } catch (err) {
      throw Error(
        `${PREFIX} calculateInspectionFolderByteSize: get bucket: ${err}`
      );
    }

    // Get all files in bucket
    let files = [];
    try {
      [files] = await bucket.getFiles();
    } catch (err) {
      throw Error(
        `${PREFIX} calculateInspectionFolderByteSize: failed to get bucket files: ${err}`
      );
    }

    let folderByteSize = 0;

    // Lookup each files metadata
    // and add it to the total byte size
    for (let i = 0; i < files.length; i++) {
      try {
        const [fileMetadata] = await files[i].getMetadata();
        const fileByteSize = fileMetadata.size
          ? parseInt(fileMetadata.size, 10) || 0
          : 0;
        folderByteSize += fileByteSize;
      } catch (err) {} // eslint-disable-line no-empty
    }

    return folderByteSize;
  },

  /**
   * Create inspection item upload dir path
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @return {String}
   */
  getInspectionItemUploadDir(inspectionId, itemId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );
    assert(itemId && typeof itemId === 'string', 'has item id string');
    return `${INSP_BUCKET_NAME}/${inspectionId}/${itemId}`;
  },

  /**
   * Create deficient item upload dir path
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @return {String}
   */
  getDeficientItemUploadDir(propertyId, deficiencyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      'has property id string'
    );
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item id string'
    );
    return `${DEF_BUCKET_NAME}/${propertyId}/${deficiencyId}`;
  },

  /**
   * Get URL from firebase storage address
   * @param  {String} url
   * @return {String} - fileName
   */
  getUrlFileName(url) {
    assert(url && typeof url === 'string', 'has url string');
    const urlSegments = decodeURIComponent(url)
      .split('?')[0]
      .split('/');
    return urlSegments.pop();
  },

  /**
   * Uploading image to inspection item storage
   * @param  {admin.storage} storage instance
   * @param  {Buffer} buffer to be uploaded to storage
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @param  {String} fileName to include in storage url path
   * @param  {String} ext, file type extension included in storage path
   * @return {Promise<String>} - resolves property download URL
   */
  inspectionItemUpload(storage, buffer, inspectionId, itemId, fileName, ext) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(buffer instanceof Buffer, 'has buffer to upload');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );
    assert(itemId && typeof itemId === 'string', 'has item id string');
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(ext && typeof ext === 'string', 'has file extension');

    // <item-dir>/<inspection-id>/<item-id>/<file-name>
    const dir = this.getInspectionItemUploadDir(inspectionId, itemId);
    const dest = `${dir}/${fileName}.${ext}`;

    // Initiate upload
    return this._upload(storage, buffer, dest, ext).catch(err =>
      Promise.reject(Error(`${PREFIX}: inspectionItemUpload: ${err}`))
    );
  },

  /**
   * Uploading image to deficient item storage
   * @param  {admin.storage} storage instance
   * @param  {Buffer} buffer to be uploaded to storage
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @param  {String} fileName to include in storage url path
   * @param  {String} ext, file type extension included in storage path
   * @return {Promise<String>} - resolves property download URL
   */
  deficientItemUpload(
    storage,
    buffer,
    propertyId,
    deficiencyId,
    fileName,
    ext
  ) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(buffer instanceof Buffer, 'has buffer to upload');
    assert(
      propertyId && typeof propertyId === 'string',
      'has property id string'
    );
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item id string'
    );
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(ext && typeof ext === 'string', 'has file extension');

    // <def-dir>/<property-id>/<deficiency-id>/<file-name>.<file-type>
    const dir = this.getDeficientItemUploadDir(propertyId, deficiencyId);
    const dest = `${dir}/${fileName}.${ext}`;

    // Initiate upload
    return this._upload(storage, buffer, dest, ext).catch(err =>
      Promise.reject(Error(`${PREFIX}: deficientItemUpload: ${err}`))
    );
  },

  /**
   * Remove all uploads for an inspection's item
   * @param  {admin.storage} storage
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @param  {Object} item
   * @return {Promise} - All remove requests grouped together
   */
  deleteInspectionItemUploads(storage, inspectionId, itemId, item) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );
    assert(itemId && typeof itemId === 'string', 'has item id string');
    assert(item && typeof item === 'object', 'has item object');

    const requests = [];
    const urls = inspUtils.getInspectionItemUploadUrls(item);

    for (let i = 0; i < urls.length; i++) {
      const fileName = this.getUrlFileName(urls[i]);
      requests.push(
        this.deleteInspectionItemPhotoEntry(
          storage,
          inspectionId,
          itemId,
          fileName
        )
      );
    }

    return Promise.all(requests);
  },

  /**
   * Remove a specific inspection item photo entry
   * @param  {admin.storage} storage
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @param  {String} url
   * @return {Promise}
   */
  deleteInspectionItemPhotoEntry(storage, inspectionId, itemId, fileName) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );
    assert(itemId && typeof itemId === 'string', 'has item id string');
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(
      fileName.search(/\./) > 0,
      'file name must contain an file extension'
    );

    const dir = this.getInspectionItemUploadDir(inspectionId, itemId);

    return storage
      .bucket()
      .file(`${dir}/${fileName}`)
      .delete()
      .catch(err => {
        throw Error(
          `${PREFIX} deleteInspectionItemPhotoEntry: file delete failed: ${err}`
        );
      });
  },

  /**
   * Remove a specific deficient item photo entry
   * @param  {admin.storage} storage
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @param  {String} url
   * @return {Promise}
   */
  deleteDeficientItemPhoto(storage, propertyId, deficiencyId, fileName) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(
      propertyId && typeof propertyId === 'string',
      'has property id string'
    );
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficient item id string'
    );
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(
      fileName.search(/\./) > 0,
      'file name must contain an file extension'
    );

    const dir = this.getDeficientItemUploadDir(propertyId, deficiencyId);

    return storage
      .bucket()
      .file(`${dir}/${fileName}`)
      .delete()
      .catch(err => {
        throw Error(
          `${PREFIX} deleteDeficientItemPhoto: file delete failed: ${err}`
        );
      });
  },

  /**
   * Find an inspection item's photo upload file names
   * @param  {firebaseAdmin.storage} bucket
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @return {Promise} - resolves {String[]} filenames
   */
  async findAllInspectionItemPhotoFileNames(storage, inspectionId, itemId) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id string'
    );
    assert(itemId && typeof itemId === 'string', 'has item id string');

    const bucket = storage.bucket();
    const prefix = `${INSP_BUCKET_NAME}/${inspectionId}/${itemId}`;

    let files = [];
    try {
      [files] = await bucket.getFiles({ prefix });
    } catch (err) {
      throw Error(
        `${PREFIX} findAllInspectionItemPhotoFileNames: failed to get files: ${err}`
      );
    }

    return files
      .map(file => file.name)
      .map(filePath => filePath.split('/').pop());
  },

  /**
   * Generic Firebase storage Buffer upload
   * @param  {admin.storage} storage instance
   * @param  {Buffer} buffer to be uploaded to storage
   * @param  {String} file name to include in storage url path
   * @param  {String} ext, file type extension included in storage path
   * @return {Promise} - resolves {string} download URL
   */
  async _upload(storage, buffer, dest, ext) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(buffer instanceof Buffer, 'has buffer to upload');
    assert(dest && typeof dest === 'string', 'has upload destination string');
    assert(ext && typeof ext === 'string', 'has file extension');

    // Create firebase storage bucket & file
    const bucket = storage.bucket();
    const fileToBeUploaded = bucket.file(dest);

    // Create writable stream
    const stream = fileToBeUploaded.createWriteStream({
      metadata: {
        contentType: `image/${ext}`,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
        },
      },
    });

    try {
      await new Promise((resolve, reject) => {
        stream.on('error', err => {
          reject(Error(`write stream error: ${err}`));
        });
        stream.on('finish', resolve);
        stream.end(buffer);
      });
    } catch (err) {
      throw Error(`${PREFIX} _upload: failed to upload image: ${err}`);
    }

    let signedUrl = '';
    try {
      // Google signed URL Response
      // https://googleapis.dev/nodejs/storage/latest/global.html#GetSignedUrlResponse
      const getSignedUrlResponse = await fileToBeUploaded.getSignedUrl({
        action: 'read',
        expires: '03-09-2491',
      });
      signedUrl = getSignedUrlResponse[0];
    } catch (err) {
      throw Error(`${PREFIX} _upload: failed to get signed URL: ${err}`);
    }

    if (!signedUrl) {
      throw Error(`${PREFIX} _upload: unexpected signed URL response`);
    }

    return signedUrl;
  },
};
