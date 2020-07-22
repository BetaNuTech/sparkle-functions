const assert = require('assert');

const PREFIX = 'inspections: utils: delete-item-upload:';
const INSP_BUCKET_NAME = `inspectionItemImages${
  process.env.NODE_ENV === 'test' ? 'Test' : ''
}`;

module.exports = {
  /**
   * Lookup all an item's uploaded
   * image download url's
   * @param  {Object} item
   * @return {String[]}
   */
  getUploadUrls(item) {
    assert(item && typeof item === 'object', 'has item object');
    return Object.keys(item.photosData || {})
      .map(id => item.photosData[id].downloadURL)
      .filter(Boolean);
  },

  /**
   * Remove an inspection item's uploaded
   * file in firebase storage
   * @param  {admin.storage} storage
   * @param  {String} url
   * @return {Promise}
   */
  delete(storage, url) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(url && typeof url === 'string', 'has url string');

    const fileName = (decodeURIComponent(url).split('?')[0] || '')
      .split('/')
      .pop();

    return storage
      .bucket()
      .file(`${INSP_BUCKET_NAME}/${fileName}`)
      .delete()
      .catch(err => {
        throw Error(`${PREFIX} file delete failed: ${err}`);
      });
  },
};
