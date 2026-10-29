const assert = require('assert');

module.exports = {
  /**
   * Collect any photo data for an inspection item
   * @param  {Object} item
   * @return {Object[]}
   */
  getItemPhotoData(item = {}) {
    assert(item && typeof item === 'object', 'has item object');
    const hasPhotosData =
      item.photosData && Object.keys(item.photosData).length > 0;

    if (!hasPhotosData) {
      return [];
    }

    // Create list of item's upload(s) configs
    return Object.keys(item.photosData).map(id => ({
      id,
      itemId: item.id,
      url: item.photosData[id].downloadURL,
    }));
  },

  /**
   * Count an inspection's item photos and signatures
   * that have not finished uploading from the inspector's
   * device: the client writes a placeholder entry with an
   * empty `downloadURL` (or `signatureDownloadURL`) until
   * the upload completes and the real URL is synced
   * @param  {Object} inspection
   * @return {Number} - pending photo/signature upload count
   */
  countPendingItemUploads(inspection = {}) {
    assert(
      inspection && typeof inspection === 'object',
      'has inspection object'
    );
    const items = (inspection.template || {}).items || {};

    return Object.keys(items).reduce((count, itemId) => {
      const item = items[itemId];
      if (!item || typeof item !== 'object') return count;

      const photosData = item.photosData || {};
      const pendingPhotos = Object.keys(photosData).filter(id => {
        const photo = photosData[id];
        return (
          photo &&
          typeof photo === 'object' &&
          Object.keys(photo).length > 0 && // ignore field value deletes
          !photo.downloadURL
        );
      }).length;

      const hasPendingSignature = Boolean(
        item.signatureTimestampKey && !item.signatureDownloadURL
      );

      return count + pendingPhotos + (hasPendingSignature ? 1 : 0);
    }, 0);
  },

  /**
   * Checks if value is a firestore field value
   * NOTE: not perfect, basically a check for an
   *       empty object at this point
   * @param  {Any} value
   * @return {Boolean}
   */
  isFieldValueDelete(value) {
    return (
      value && typeof value === 'object' && Object.keys(value).length === 0
    );
  },

  /**
   * Lookup all an item's uploaded
   * image download url's
   * @param  {Object} item
   * @return {String[]}
   */
  getInspectionItemUploadUrls(item) {
    assert(item && typeof item === 'object', 'has item object');
    return Object.keys(item.photosData || {})
      .map(id => item.photosData[id].downloadURL)
      .filter(Boolean);
  },
};
