const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const createStateHistory = require('../deficient-items/utils/create-state-history');
const systemModel = require('./system');
const archive = require('./_internal/archive');
const config = require('../config');

const PREFIX = 'models: deficient-items:';
const DATABASE_PATH = config.deficientItems.dbPath;
const DEFICIENT_COLLECTION = config.deficientItems.collection;

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
      .ref(`/${DATABASE_PATH}/${propertyId}/${deficientItemId}`)
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
    const deficientItemsByPropertySnap = await db
      .ref(DATABASE_PATH)
      .once('value');

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
    const path = `${DATABASE_PATH}/${propertyId}`;
    return db.ref(path).once('value');
  },

  /**
   * Add a deficient item to a property
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} propertyId
   * @param  {Object} recordData
   * @return {Promise} - resolves {Object} JSON of path and update
   */
  async createRecord(db, fs, propertyId, recordData) {
    assert(Boolean(fs), 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(recordData && typeof recordData === 'object', 'has record data');
    assert(Boolean(recordData.inspection), 'has inspection reference');
    assert(Boolean(recordData.item), 'has item reference');
    const archiveQuery = {
      propertyId,
      inspectionId: recordData.inspection,
      itemId: recordData.item,
    };

    let archived = null;
    let archivedId = '';

    // Recover any previously
    // archived realtime deficient item
    try {
      const archivedSnap = await archive.deficientItem.realtimeFindRecord(
        db,
        archiveQuery
      );
      archived = archivedSnap ? archivedSnap.val() : null;
      if (archived) archivedId = archivedSnap.key;
    } catch (err) {
      throw Error(
        `${PREFIX} createRecord: realtime archive lookup failed | ${err}`
      );
    }

    // Recover any previously
    // archived firestore deficiency
    if (!archived) {
      try {
        const archivedDoc = await archive.deficientItem.firestoreFindRecord(
          fs,
          archiveQuery
        );
        archived = archivedDoc ? archivedDoc.data() : null;
        if (archived) archivedId = archived.id;
      } catch (err) {
        throw Error(
          `${PREFIX} createRecord: firestore archive lookup failed | ${err}`
        );
      }
    }

    let ref;
    let deficiencyId = '';
    if (archived) {
      // Re-use previously created DI identifier
      ref = db.ref(`${DATABASE_PATH}/${propertyId}/${archivedId}`);
      deficiencyId = archivedId;
    } else {
      // Create brand new DI identifier
      ref = db.ref(`${DATABASE_PATH}/${propertyId}`).push();
      deficiencyId = ref.path
        .toString()
        .split('/')
        .pop();
    }

    // Merge any archived into new record
    const data = {};
    Object.assign(data, recordData, archived);

    try {
      await ref.set(data);
    } catch (err) {
      throw Error(`${PREFIX} createRecord: realtime record set: ${err}`);
    }

    try {
      fs.collection(DEFICIENT_COLLECTION)
        .doc(deficiencyId)
        .create(data);
    } catch (err) {
      throw Error(`${PREFIX} createRecord: firestore record create: ${err}`);
    }

    // Cleanup archive
    if (archived) {
      try {
        await archive.deficientItem.realtimeRemoveRecord(
          db,
          propertyId,
          archivedId
        );
      } catch (err) {
        throw Error(`${PREFIX} createRecord: realtime archive remove: ${err}`);
      }

      try {
        await archive.deficientItem.firestoreRemoveRecord(fs, archivedId);
      } catch (err) {
        throw Error(`${PREFIX} createRecord: firestore archive remove: ${err}`);
      }
    }

    return { [ref.path.toString()]: data };
  },

  /**
   * Create a new realtime
   * Deficient Item record
   * NOTE: ignores archive
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} propertyId
   * @param  {Object} data
   * @return {Promise} - resolves {Reference}
   */
  realtimeCreateRecord(db, propertyId, data) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data');
    const ref = db.ref(`${DATABASE_PATH}/${propertyId}`).push();
    return ref.set(data).then(() => ref);
  },

  /**
   * Update Deficient Item
   * TODO: update firestore
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} propertyId
   * @param  {String} defItemId
   * @param  {Object} data
   * @return {Promise}
   */
  updateRecord(db, propertyId, defItemId, data) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );
    assert(
      defItemId && typeof defItemId === 'string',
      `${PREFIX} has inspection id`
    );
    assert(data && typeof data === 'object', `${PREFIX} has upsert data`);
    return db.ref(`${DATABASE_PATH}/${propertyId}/${defItemId}`).update(data);
  },

  /**
   * Perform all updates to progress
   * a single deficient items' state
   * TODO: update Firestore state
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
    const updates = {};
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
   * Perform update of single completed photo of
   * deficient items
   * @param  {firebaseadmin.database} db
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} completedPhotoId
   * @param  {String} trelloAttachmentId
   * @return {Promise} - resolves {void}
   */
  updateCompletedPhotoTrelloCardAttachment(
    db,
    propertyId,
    deficientItemId,
    completedPhotoId,
    trelloAttachmentId
  ) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(
      completedPhotoId && typeof completedPhotoId === 'string',
      'has completed photo id'
    );
    assert(
      trelloAttachmentId && typeof trelloAttachmentId === 'string',
      'has trello attachment id'
    );

    const path = `${DATABASE_PATH}/${propertyId}/${deficientItemId}`;

    // Atomic update
    return db.ref().update({
      // Modify DI's mark latest changes
      [`${path}/updatedAt`]: Math.round(Date.now() / 1000),

      // Update DI's completed photo trello attachment id
      [`${path}/completedPhotos/${completedPhotoId}/trelloCardAttachement`]: trelloAttachmentId,
    });
  },

  /**
   * Move a deficient item under `/archive`
   * and remove it from its' active location
   * TODO: support firestore archive
   * @param  {firebaseadmin.database} db
   * @param  {DataSnapshot} diSnap
   * @param  {Boolean} archiving is the function either archiving or unarchiving this deficient item?
   * @return {Promise} - resolves {Object} updates hash
   */
  async toggleArchive(db, diSnap, archiving = true) {
    const updates = {};
    const activePath = diSnap.ref.path.toString();
    const [propertyId] = activePath.split('/').slice(-2, -1);
    const deficientItem = diSnap.val();
    const toggleType = archiving ? 'archive' : 'unarchive';

    // DI Destination path
    const writePath = archiving
      ? `/archive${activePath}`
      : activePath.replace(/^\/archive/, '');

    // Current DI path
    const removePath = activePath;

    try {
      await db.ref(writePath).set(deficientItem);
      updates[writePath] = 'created';
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
        propertyId,
        diSnap.key,
        archiving
      );
      if (archiveResponse) updates.trelloCardChanged = archiveResponse.id;
    } catch (err) {
      const resultErr = Error(
        `${PREFIX} associated Trello card ${toggleType} failed | ${err}`
      );
      resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
      throw resultErr;
    }

    return updates;
  },

  /**
   * Create a Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String}  deficientItemId
   * @param  {Object}  data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, deficientItemId, data) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has data');
    assert(
      data.property && typeof data.property === 'string',
      'data has property id'
    );
    assert(
      data.inspection && typeof data.inspection === 'string',
      'data has inspection id'
    );
    assert(data.item && typeof data.item === 'string', 'data has item id');
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .create(data);
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  firestoreFindRecord(fs, deficientItemId) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      `${PREFIX} has deficient item id`
    );
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single property
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQueryByProperty(fs, propertyId) {
    assert(
      propertyId && typeof propertyId === 'string',
      `${PREFIX} has property id`
    );

    const colRef = fs.collection(DEFICIENT_COLLECTION);
    colRef.where('property', '==', propertyId);
    return colRef.get();
  },
});
