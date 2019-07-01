const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const PREFIX = 'models: inspections:';

module.exports = modelSetup({
  /**
   * Lookup single deficient item
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @param  {String} itemId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  findItem(db, inspectionId, itemId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      `${PREFIX} has inspection id`
    );
    assert(
      itemId && typeof itemId === 'string',
      `${PREFIX} has inspection item id`
    );
    return db
      .ref(`/inspections/${inspectionId}/template/items/${itemId}`)
      .once('value');
  },
});
