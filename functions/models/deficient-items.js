const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const createStateHistory = require('../deficient-items/utils/create-state-history');

const API_PATH = '/propertyInspectionDeficientItems';

module.exports = modelSetup({
  /**
   * Find all DI's associated with a property
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {InspectionSnapshots[]}
   */
  async findAllByInspection(db, inspectionId) {
    assert(inspectionId && typeof inspectionId === 'string', 'has inspection id');

    const result = [];
    const deficientItemsByPropertySnap = await db.ref(API_PATH).once('value');

    // Add each DI belonging to an inspection to result
    deficientItemsByPropertySnap.forEach(propertyDeficientItemsSnap => {
      propertyDeficientItemsSnap.forEach(deficientItemsSnap => {
        try {
          if (deficientItemsSnap.val().inspection === inspectionId) {
            result.push(deficientItemsSnap);
          }
        } catch (e) {}
      });
    });

    return result;
  },

  /**
   * Push deficient item into property path
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DataSnapshot}
   */
  findAllByProperty(db, propertyId) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const path = `${API_PATH}/${propertyId}`;
    return db.ref(path).once('value');
  },

  /**
   * Add a deficient item to a property
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @param  {String} itemId
   * @param  {Object} recordData
   * @return {Promise} - resolves {Object} JSON of path and update
   */
  async createRecord(db, propertyId, itemId, recordData) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(itemId && typeof itemId === 'string', 'has item id');
    assert(recordData && typeof recordData === 'object', 'has record date');
    const path = `${API_PATH}/${propertyId}/${itemId}`;
    await db.ref(path).set(recordData);
    return { [path]: recordData };
  },

  /**
   * Perform all updates to progress
   * a single deficient items' state
   * @param  {firebaseadmin.database} db
   * @param  {DataSnapshot} diSnap
   * @param  {String} newState
   * @return {Promise} - resolves {Object} updates hash
   */
  async updateState(db, diSnap, newState) {
    assert(
      diSnap &&
      typeof diSnap.ref === 'object' &&
      typeof diSnap.val === 'function',
      'has data snapshot'
    );
    assert(newState && typeof newState === 'string', 'has new state string');
    const path = diSnap.ref.path.toString();
    const diItem = diSnap.val();
    const updates = Object.create(null);
    diItem.state = newState;

    // Update DI's state
    await db.ref(`${path}/state`).set(diItem.state);
    updates[`${path}/state`] = 'updated';

    // Update `stateHistory` with latest DI state
    await db.ref(`${path}/stateHistory`).push(createStateHistory(diItem));
    updates[`${path}/stateHistory`] = 'added';

    // Modify updatedAt to denote changes
    await db.ref(`${path}/updatedAt`).set(Date.now() / 1000);
    updates[`${path}/updatedAt`] = 'updated';

    return updates;
  }
});
