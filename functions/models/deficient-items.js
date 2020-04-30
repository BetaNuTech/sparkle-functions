const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
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
        `${PREFIX} createRecord: realtime archive lookup failed: ${err}`
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
        if (archived) archivedId = archivedDoc.id;
      } catch (err) {
        throw Error(
          `${PREFIX} createRecord: firestore archive lookup failed: ${err}`
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
      await this.firestoreCreateRecord(fs, deficiencyId, {
        property: propertyId,
        ...data,
      });
    } catch (err) {
      throw Error(`${PREFIX} createRecord: firestore record create: ${err}`);
    }

    if (archived) {
      try {
        // Cleanup realtime archive
        await archive.deficientItem.realtimeRemoveRecord(
          db,
          propertyId,
          archivedId
        );
      } catch (err) {
        throw Error(`${PREFIX} createRecord: realtime archive remove: ${err}`);
      }

      try {
        // Cleanup firestore archive
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
   * Create a new realtime
   * Deficient Item record
   * NOTE: ignores archive
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} propertyId
   * @param  {String} defItemId
   * @param  {Object} data
   * @return {Promise} - resolves {Reference}
   */
  realtimeUpdateRecord(db, propertyId, defItemId, data) {
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(defItemId && typeof defItemId === 'string', 'has deficient item id');
    assert(data && typeof data === 'object', 'has data');
    return db.ref(`${DATABASE_PATH}/${propertyId}/${defItemId}`).update(data);
  },

  /**
   * Update Deficient Item
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
   * @param  {String} propertyId
   * @param  {String} defItemId
   * @param  {Object} data
   * @return {Promise}
   */
  async updateRecord(db, fs, propertyId, defItemId, data) {
    assert(Boolean(fs), 'has firestore db insatance');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(defItemId && typeof defItemId === 'string', 'has inspection id');
    assert(data && typeof data === 'object', 'has upsert data');

    try {
      await this.realtimeUpdateRecord(db, propertyId, defItemId, data);
    } catch (err) {
      throw Error(
        `${PREFIX} updateRecord: realtime "${defItemId}" update failed: ${err}`
      );
    }

    try {
      await this.firestoreUpsertRecord(fs, defItemId, {
        property: propertyId,
        ...data,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} updateRecord: firestore "${defItemId}" update failed: ${err}`
      );
    }
  },

  /**
   * Perform all updates to progress
   * a single deficient items' state
   * @param  {firebaseadmin.database} db
   * @param  {firebaseadmin.firebase} fs
   * @param  {DataSnapshot} diSnap // TODO: remove requiring
   * @param  {String} newState
   * @return {Promise} - resolves {Object} updates hash
   */
  async updateState(db, fs, diSnap, newState) {
    assert(Boolean(fs), 'has firebase db instance');
    assert(
      diSnap &&
        typeof diSnap.ref === 'object' &&
        typeof diSnap.val === 'function',
      'has data snapshot'
    );
    assert(newState && typeof newState === 'string', 'has new state string');
    const path = diSnap.ref.path.toString();
    const deficientItemId = diSnap.key;
    const [propertyId] = path.split('/').slice(-2, -1);
    const diItem = diSnap.val();
    const updates = {};
    diItem.state = newState;

    const stateHistoryId = db
      .ref(`${path}/stateHistory`)
      .push()
      .path.toString()
      .split('/')
      .pop();
    const updateData = {
      state: newState,
      stateHistory: {
        [stateHistoryId]: createStateHistory(diItem), // Append state history update
        ...(diItem.stateHistory || {}),
      },
      updatedAt: Math.round(Date.now() / 1000),
    };

    try {
      await db.ref(path).update(updateData);
    } catch (err) {
      throw Error(`${PREFIX} updateState: realtime updated DI failed: ${err}`);
    }

    // Create/Update Firestore DI w/ latest data
    try {
      await this.firestoreUpsertRecord(fs, deficientItemId, {
        property: propertyId,
        ...diItem,
        ...updateData,
      });
    } catch (err) {
      throw Error(`${PREFIX} updateState: firestore upsert DI failed: ${err}`);
    }

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
   * @param  {firebaseadmin.database} db
   * @param  {firebaseadmin.firebase} fs
   * @param  {DataSnapshot} diSnap // TODO: remove requiring
   * @param  {Boolean} archiving is the function either archiving or unarchiving this deficient item?
   * @return {Promise} - resolves {Object} updates hash
   */
  async toggleArchive(db, fs, diSnap, archiving = true) {
    assert(Boolean(fs), 'has firebase db instance');
    assert(Boolean(diSnap), 'has snapshot');
    assert(typeof archiving === 'boolean', 'has archiving boolean');

    const updates = {};
    const defItemId = diSnap.key;
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
      throw Error(`${PREFIX} realtime ${toggleType} write failed: ${err}`);
    }

    try {
      await db.ref(removePath).remove();
      updates[removePath] = 'removed';
    } catch (err) {
      throw Error(`${PREFIX} realtime deficient item removal failed: ${err}`);
    }

    if (archiving) {
      // Archive
      let diDoc = null;
      try {
        diDoc = await this.firestoreFindRecord(fs, defItemId);
      } catch (err) {
        throw Error(
          `${PREFIX} firestore DI "${defItemId}" lookup failed: ${err}`
        );
      }

      try {
        await archive.deficientItem.firestoreCreateRecord(
          fs,
          defItemId,
          (diDoc && diDoc.data()) || { property: propertyId, ...deficientItem }
        );
      } catch (err) {
        throw Error(
          `${PREFIX} firestore archived DI "${defItemId}" create failed: ${err}`
        );
      }

      try {
        await this.firestoreRemoveRecord(fs, defItemId);
      } catch (err) {
        throw Error(
          `${PREFIX} firestore DI "${defItemId}" remove failed: ${err}`
        );
      }
    } else {
      // Unarchive
      let diDoc = null;
      try {
        diDoc = await archive.deficientItem.firestoreFindRecord(fs, defItemId);
      } catch (err) {
        throw Error(
          `${PREFIX} firestore DI "${defItemId}" lookup failed: ${err}`
        );
      }
      const diData = (diDoc && diDoc.data()) || {
        property: propertyId,
        ...deficientItem,
      };
      delete diData._collection; // Remove archive only attribute

      try {
        await this.firestoreCreateRecord(fs, defItemId, diData);
      } catch (err) {
        throw Error(
          `${PREFIX} firestore DI "${defItemId}" create failed: ${err}`
        );
      }

      try {
        await archive.deficientItem.firestoreRemoveRecord(fs, defItemId);
      } catch (err) {
        throw Error(
          `${PREFIX} firestore DI "${defItemId}" create failed: ${err}`
        );
      }
    }

    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        db,
        propertyId,
        defItemId,
        archiving
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await this._firestoreCleanupDeletedTrelloCard(fs, defItemId);
        } catch (cleanErr) {
          throw Error(
            `${PREFIX} Firestore Trello card detail cleanup failed: ${cleanErr}`
          );
        }
      } else {
        const resultErr = Error(
          `${PREFIX} associated Trello card ${toggleType} failed | ${err}`
        );
        resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
        throw resultErr;
      }
    }

    return updates;
  },

  /**
   * Create a Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs
   * @param  {String} deficientItemId
   * @param  {Object} data
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
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    colRef.where('property', '==', propertyId);
    return colRef.get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single inspection
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQueryByInspection(fs, inspectionId) {
    assert(inspectionId && typeof inspectionId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    colRef.where('inspection', '==', inspectionId);
    return colRef.get();
  },

  /**
   * Lookup Firestore Deficiency Item query
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @param  {Object} query
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQuery(fs, query) {
    assert(query && typeof query === 'object', 'has query hash');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    Object.keys(query).forEach(attr => colRef.where(attr, '==', query[attr]));
    return colRef.get();
  },

  /**
   * Remove Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, deficientItemId) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .delete();
  },

  /**
   * Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise}
   */
  firestoreUpdateRecord(fs, deficientItemId, data) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .update(data);
  },

  /**
   * Create/Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise}
   */
  async firestoreUpsertRecord(fs, deficientItemId, data) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    assert(data && typeof data === 'object', 'has update data');

    const docRef = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);
    let docSnap = null;

    try {
      docSnap = await docRef.get();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
    }

    const { exists } = docSnap;

    try {
      if (exists) {
        await this.firestoreUpdateRecord(fs, deficientItemId, data);
      } else {
        await this.firestoreCreateRecord(fs, deficientItemId, data);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Cleanup Trello Attributes of
   * Deficient Item or Archived Record
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  async _firestoreCleanupDeletedTrelloCard(fs, deficientItemId) {
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item ID'
    );

    // Lookup Active Record
    let deficientItem = null;
    let isActive = false;
    let isArchived = false;

    try {
      const diDoc = await this.firestoreFindRecord(fs, deficientItemId);
      isActive = Boolean(diDoc && diDoc.exists);
      if (isActive) deficientItem = diDoc.data();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore DI "${deficientItemId}" lookup failed: ${err}`
      );
    }

    // Lookup Archived Record
    if (!isActive) {
      try {
        const diDoc = await archive.deficientItem.firestoreFindRecord(
          fs,
          deficientItemId
        );
        isArchived = Boolean(diDoc && diDoc.exists);
        if (isArchived) deficientItem = diDoc.data();
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore archived DI "${deficientItemId}" lookup failed: ${err}`
        );
      }
    }

    // Firestore record does not exist
    if (!isActive && !isArchived) {
      return;
    }

    const updates = {};

    // Remove DI's Trello Card link
    if (deficientItem.trelloCardURL) {
      updates.trelloCardURL = FieldValue.delete();
    }

    // Remove any Trello Card Attachment references
    // from the completed photos of the DI
    Object.keys(deficientItem.completedPhotos || {}).forEach(id => {
      const photo = deficientItem.completedPhotos[id];
      if (photo && photo.trelloCardAttachement) {
        updates.completedPhotos = updates.completedPhotos || {};
        updates.completedPhotos[id] = {
          ...photo,
          trelloCardAttachement: FieldValue.delete(),
        };
      }
    });

    if (isActive) {
      try {
        await this.firestoreUpdateRecord(fs, deficientItemId, {
          ...deficientItem,
          ...updates,
        });
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore update DI failed: ${err}`
        );
      }
    }

    if (isArchived) {
      try {
        await archive.deficientItem.firestoreUpdateRecord(fs, deficientItemId, {
          ...deficientItem,
          ...updates,
        });
      } catch (err) {
        throw Error(
          `${PREFIX} firestoreCleanupDeletedTrelloCard: firestore archive update DI failed: ${err}`
        );
      }
    }
  },
});
