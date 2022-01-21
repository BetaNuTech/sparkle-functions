/**
 * Create new/unique timestamp photo data ID
 * @param  {Object?} currentPhotoData
 * @return {String}
 */
module.exports = (currentPhotoData = {}) => {
  let unixTimeId = Math.round(Date.now() / 1000);
  const existingPhotoIds = [...Object.keys(currentPhotoData || {})].map(id =>
    parseInt(id, 10)
  );

  while (existingPhotoIds.includes(unixTimeId)) {
    unixTimeId += 1;
  }

  return `${unixTimeId}`;
};
