/**
 * Find latest admin edit of an item
 * @param  {Object} item
 * @return {Number} - admin edit timestamp or `0`
 */
module.exports = function getLatestItemAdminEditTimestamp({ adminEdits }) {
  const [result] = Object.keys(adminEdits || {})
    .map(adminEditId => adminEdits[adminEditId]) // Create admin edit array
    .sort((a, b) => b.edit_date - a.edit_date); // Descending
  return result ? result.edit_date : 0;
};
