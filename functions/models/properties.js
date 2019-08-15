const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: properties:';

module.exports = modelSetup({
  /**
   * Find property by ID
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  findRecord(db, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );

    return db.ref(`/properties/${propertyId}`).once('value');
  },
});
