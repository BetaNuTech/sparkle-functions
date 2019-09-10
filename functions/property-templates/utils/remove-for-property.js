/**
 * Remove all template proxies belonging to a property
 * @param  {firebaseAdmin.database}
 * @param  {String} propertyId
 * @return {Promise} - resolves {Boolean} remove() results
 */
module.exports = function removeForProperty(db, propertyId) {
  return db.ref(`/propertyTemplatesList/${propertyId}`).remove();
};
