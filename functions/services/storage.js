const assert = require('assert');
const { v4: uuidv4 } = require('uuid');

const PROPERTY_BUCKET_NAME = `propertyImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;
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
  async propertyUpload(storage, buffer, fileName, ext) {
    assert(
      storage && typeof storage.bucket === 'function',
      'has storage instance'
    );
    assert(buffer instanceof Buffer, 'has buffer to upload');
    assert(fileName && typeof fileName === 'string', 'has file name string');
    assert(ext && typeof ext === 'string', 'has file extension');

    // Create firebase storage bucket & file
    const bucket = storage.bucket();
    const fileToBeUploaded = bucket.file(`${PROPERTY_BUCKET_NAME}/${fileName}`);

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
      throw Error(`${PREFIX} propertyUpload: failed to upload image: ${err}`);
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
      throw Error(`${PREFIX} propertyUpload: failed to get signed URL: ${err}`);
    }

    if (!signedUrl) {
      throw Error(`${PREFIX} propertyUpload: unexpected signed URL response`);
    }

    return signedUrl;
  },
};
