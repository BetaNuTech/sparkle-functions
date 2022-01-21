const Jimp = require('jimp');
const assert = require('assert');

/**
 * Request an image from a URL and base64 encode it
 * @param  {String} imgUrl URL to image
 * @param  {Number[]} scale max scale resolution
 * @param  {String} jimpFormat Jimp constant of file format
 * @return {Promise} - resolves {Object} base64img instance
 */
module.exports = function base64Image(
  imgUrl,
  scale = [500, 500],
  jimpFormat = Jimp.MIME_JPEG
) {
  assert(imgUrl && typeof imgUrl === 'string', 'has image url');
  assert(
    Array.isArray(scale) && scale.every(s => typeof s === 'number'),
    'has numeric scale array'
  );

  return new Promise(resolve => {
    Jimp.read(imgUrl, (err, img) => {
      if (err || !img) return resolve(''); // resolve nothing

      img
        .scaleToFit(...scale)
        .quality(100)
        .getBase64(jimpFormat, (base64Err, datauri) => {
          if (base64Err || !datauri) return resolve('');

          resolve({
            datauri,
            downloadURL: imgUrl,
            width: img.bitmap.width,
            height: img.bitmap.height,
          });
        });
    });
  });
};
