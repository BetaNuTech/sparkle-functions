const assert = require('assert');

/**
 * Collect all deleted inspection item photo
 * urls into a single flattened array
 * @param  {Object} inspection
 * @return {Object[]} - deleted inspection item photo urls (downloadURL)
 */
module.exports = (currentInspection, updatedInspection) => {
  assert(
    currentInspection && typeof currentInspection === 'object',
    'has current inspection object'
  );
  assert(
    updatedInspection && typeof updatedInspection === 'object',
    'has updated inspection object'
  );

  const updatedItems = (updatedInspection.template || {}).items || {};
  const currentItems = (currentInspection.template || {}).items || {};

  return Object.keys(updatedItems)
    .filter(id => updatedItems[id] === null) // find removed items
    .filter(id => Boolean(currentItems[id])) // check current item exists
    .filter(id => currentItems[id].photosData) // has photo data
    .map(id => ({
      id,
      photosData: JSON.parse(JSON.stringify(currentItems[id].photosData)),
    })) // Clone item's photo data (with ID)
    .map(
      ({ id, photosData }) =>
        Object.keys(photosData).map(photoDataId => ({
          item: id,
          url: photosData[photoDataId].downloadURL,
        })) // convert photo data to list of strings
    )
    .reduce((acc, itemPhotosData) => {
      acc.push(...itemPhotosData.filter(({ url }) => Boolean(url))); // Flatten all photos to single array
      return acc;
    }, []);
};
