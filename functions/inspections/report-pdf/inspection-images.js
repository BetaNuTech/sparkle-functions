const Jimp = require('jimp');
const base64ItemImage = require('./base-64-item-image');
const { getItemPhotoData } = require('../../utils/inspection');

const { keys, assign } = Object;

module.exports = {
  /**
   * Insert datauri's into an inspections items
   * NOTE: creates side effects on inspection
   * @param  {Object} inspection
   * @return {Promise} - resolves {Object} inspection
   */
  download: async function insertInspectionItemImageUris(inspection) {
    // All items with upload(s) or signature image
    const items = keys(inspection.template.items || {})
      .map(id => assign({ id }, inspection.template.items[id]))
      .filter(item => item.photosData || item.signatureDownloadURL);

    // Flatten image photos into single array
    const imagePhotoUrls = []
      .concat(
        ...items.map(item => {
          // Create signature image configs
          if (item.signatureDownloadURL) {
            return [
              {
                id: item.signatureTimestampKey,
                itemId: item.id,
                url: item.signatureDownloadURL,
              },
            ];
          }

          return getItemPhotoData(item);
        })
      )
      .filter(Boolean)
      .filter(({ url }) => Boolean(url)); // remove empty uploads

    const imageuris = await Promise.all(
      imagePhotoUrls.map(({ url, itemId }) => {
        const itemSrc = inspection.template.items[itemId];
        const isSignatureItem = Boolean(itemSrc.signatureDownloadURL);

        if (isSignatureItem) {
          return base64ItemImage(url, [600, 180], Jimp.PNG_FILTER_AUTO);
        }
        return base64ItemImage(url);
      })
    );

    // Insert base64 image JSON into original
    // items' `photoData` JSON or `signatureDownloadURL`
    imagePhotoUrls.forEach(img => {
      // Find image's base64 JSON
      const [base64img] = imageuris.filter(
        imguri => imguri.downloadURL === img.url
      );
      const itemSrc = inspection.template.items[img.itemId];
      const isSignatureItem = Boolean(itemSrc.signatureDownloadURL);

      // Remove undiscovered image reference
      if (!base64img) {
        if (itemSrc.photosData) delete itemSrc.photosData[img.id];
        if (isSignatureItem) delete itemSrc.signatureDownloadURL;
        return;
      }

      // Merge base64 data into image hash
      if (isSignatureItem) {
        itemSrc.signatureData = assign({}, base64img);
      } else {
        assign(itemSrc.photosData[img.id], base64img);
      }
    });

    return inspection;
  },
};
