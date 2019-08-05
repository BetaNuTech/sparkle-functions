const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const createStateHistory = require('../deficient-items/utils/create-state-history');
const systemModel = require('./system');

const API_PATH = '/propertyInspectionDeficientItems';
const PREFIX = 'deficient-items: on-di-archive-update:';

module.exports = modelSetup({
  /**
   * Lookup single deficient item
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  find(db, propertyId, deficientItemId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item id`
    );

    return db
      .ref(`/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}`)
      .once('value');
  },

  /**
   * Find all DI's associated with an inspection
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DeficientItemsSnapshot[]}
   */
  async findAllByInspection(db, inspectionId) {
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection id'
    );

    const result = [];
    const deficientItemsByPropertySnap = await db.ref(API_PATH).once('value');

    // Add each DI belonging to an inspection to result
    deficientItemsByPropertySnap.forEach(propertyDeficientItemsSnap => {
      propertyDeficientItemsSnap.forEach(deficientItemsSnap => {
        try {
          if (deficientItemsSnap.val().inspection === inspectionId) {
            result.push(deficientItemsSnap);
          }
        } catch (e) {} // eslint-disable-line no-empty
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
   * @param  {Object} recordData
   * @return {Promise} - resolves {Object} JSON of path and update
   */
  async createRecord(db, propertyId, recordData) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(recordData && typeof recordData === 'object', 'has record data');
    assert(Boolean(recordData.inspection), 'has inspection reference');
    assert(Boolean(recordData.item), 'has item reference');

    // Recover any previously archived deficient item
    const archivedSnap = await this._findArchived(db, {
      propertyId,
      inspectionId: recordData.inspection,
      itemId: recordData.item,
    });
    const archived = archivedSnap ? archivedSnap.val() : null;

    let ref;
    if (archived) {
      // Re-use previously created DI identifier
      ref = db.ref(`${API_PATH}/${propertyId}/${archivedSnap.key}`);
    } else {
      // Create brand new DI identifier
      ref = db.ref(`${API_PATH}/${propertyId}`).push();
    }

    // Merge archived and created into active path
    await ref.set(Object.assign(recordData, archived));

    if (archived) {
      // Cleanup archive
      await archivedSnap.ref.remove();
    }

    return { [ref.path.toString()]: recordData };
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
  },

  /**
   * Move a deficient item under `/archive`
   * and remove it from its' active location
   * @param  {firebaseadmin.database} db
   * @param  {DataSnapshot} diSnap
   * @param  {Boolean} archiving is the function either archiving or unarchiving this deficient item?
   * @return {Promise} - resolves {Object} updates hash
   */
  async toggleArchive(db, diSnap, archiving = true) {
    const updates = Object.create(null);
    const activePath = diSnap.ref.path.toString();
    const deficientItem = diSnap.val();
    const toggleType = archiving ? 'archive' : 'unarchive';

    // DI Destination path
    const destPath = archiving
      ? `/archive${activePath}`
      : activePath.replace(/^\/archive/, '');

    // Current DI path
    const removePath = activePath;

    try {
      await db.ref(destPath).set(deficientItem);
      updates[destPath] = 'created';
    } catch (err) {
      throw Error(`${PREFIX} ${toggleType} write failed: ${err}`);
    }

    try {
      await db.ref(removePath).remove();
      updates[removePath] = 'removed';
    } catch (err) {
      throw Error(`${PREFIX} deficient item removal failed: ${err}`);
    }

    try {
      const archiveResponse = await systemModel.archiveTrelloCard(
        db,
        deficientItem,
        archiving
      );
      if (archiveResponse) updates.trelloCardChanged = archiveResponse.id;
    } catch (err) {
      throw Error(
        `${PREFIX} associated Trello card ${toggleType} failed: ${err}`
      );
    }

    return updates;
  },

  /**
   * Recover any deficient item from archive
   * matching a property's inspection item
   * @param  {firebaseadmin.database} db
   * @param  {String}  propertyId
   * @param  {String}  inspectionId
   * @param  {String}  itemId
   * @return {Promise} - resolve {DataSnapshot|Object}
   */
  async _findArchived(db, { propertyId, inspectionId, itemId }) {
    assert(
      propertyId && typeof propertyId === 'string',
      'has property reference'
    );
    assert(
      inspectionId && typeof inspectionId === 'string',
      'has inspection reference'
    );
    assert(itemId && typeof itemId === 'string', 'has item reference');

    let result = null;
    const archPropertyDiRef = db.ref(`archive${API_PATH}/${propertyId}`);
    const deficientItemSnaps = await archPropertyDiRef
      .orderByChild('item')
      .equalTo(itemId)
      .once('value');

    // Find DI's matching inspection ID
    // (we've matched or property and item already)
    deficientItemSnaps.forEach(deficientItemSnap => {
      if (!result && deficientItemSnap.val().inspection === inspectionId) {
        result = deficientItemSnap;
      }
    });

    return result;
  },
});
