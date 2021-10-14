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
};
