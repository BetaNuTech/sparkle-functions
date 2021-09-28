const Jimp = require('jimp');
const assert = require('assert');

const PREFIX = 'properties: utils: images';
const MIME_TYPES = [Jimp.MIME_PNG, Jimp.MIME_JPEG];

module.exports = {
  /**
   * Discover the valid/support mime type
   * @param  {String} mimeType
   * @return {Sting}
   */
  getMimeType(mimeType) {
    assert(mimeType && typeof mimeType === 'string', 'has mime type');

    const src = mimeType.toLowerCase();
    const isJpg = src.search(/jpg|jpeg/g) > -1;
    const isPng = src.search(/png/g) > -1;

    if (isJpg) {
      return Jimp.MIME_JPEG;
    }

    if (isPng) {
      return Jimp.MIME_PNG;
    }

    return '';
  },

  /**
   * Create a JIMP image instance from a file buffer
   * @param  {Buffer} fileBuffer
   * @return {Promise} - resolves {JimpImage}
   */
  createImage(fileBuffer) {
    assert(fileBuffer instanceof Buffer, 'has file buffer');

    return new Promise((resolve, reject) => {
      Jimp.read(fileBuffer, (err, image) => {
        if (err) {
          return reject(
            Error(`${PREFIX}: createImage: error reading file: ${err}`)
          );
        }
        resolve(image);
      });
    });
  },

  /**
   * Optimize a JIMP image with
   * pre-configured settings and return
   * the updated buffer of the image
   * @param  {JimpImage} image
   * @param  {String} mimeType
   * @return {Promise} - resolves {Buffer}
   */
  optimizeImage(image, mimeType) {
    assert(
      image && typeof image.resize === 'function',
      'has JIMP image instance'
    );
    assert(MIME_TYPES.includes(mimeType), 'has supported mime type');

    return new Promise((resolve, reject) => {
      image
        .resize(1500, Jimp.AUTO) // resize
        .quality(76) // set JPEG quality
        .getBuffer(mimeType, (err, data) => {
          if (err) {
            return reject(
              Error(`${PREFIX}: optimizeImage: error optimizing file: ${err}`)
            );
          }

          resolve(data);
        });
    });
  },
};
