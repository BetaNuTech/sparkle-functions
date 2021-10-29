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
