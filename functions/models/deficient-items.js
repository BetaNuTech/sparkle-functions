const assert = require('assert');
const modelSetup = require('./utils/model-setup');
const createStateHistory = require('../deficient-items/utils/create-state-history');
const systemModel = require('./system');
const archive = require('./_internal/archive');
const config = require('../config');

const PREFIX = 'models: deficient-items:';
const DATABASE_PATH = config.deficientItems.dbPath;
const DEFICIENT_COLLECTION = config.deficientItems.collection;
const STORAGE_PATH_TEMPLATE = config.deficientItems.storagePathTemplate;

module.exports = modelSetup({
  /**
   * Lookup single deficient item
   * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DataSnapshot} deficient item snapshot
   */
  find(db, propertyId, deficientItemId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
        if (archived) {
          archivedId = archivedDoc.id;
          delete archived._collection; // Remove arhive only attibute
        }
      } catch (err) {
        throw Error(
          `${PREFIX} createRecord: firestore archive lookup failed: ${err}`
        );
      }
    }

    let ref;
    if (archived) {
      // Re-use previously created DI identifier
      ref = db.ref(`${DATABASE_PATH}/${propertyId}/${archivedId}`);
    } else {
      // Create brand new DI identifier
      ref = db.ref(`${DATABASE_PATH}/${propertyId}`).push();
    }

    // Merge any archived into new record
    const data = {};
    Object.assign(data, recordData, archived);

    try {
      const realtimeData = { ...data };
      delete realtimeData.property; // Remove firstore only attr
      await ref.set(realtimeData);
    } catch (err) {
      throw Error(`${PREFIX} createRecord: realtime record set: ${err}`);
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(data && typeof data === 'object', 'has data');
    const ref = db.ref(`${DATABASE_PATH}/${propertyId}`).push();
    const recordData = JSON.parse(JSON.stringify(data)); // clone
    delete recordData.property; // remove property attribute
    return ref.set(recordData).then(() => ref);
  },

  /**
   * Add/update Realtime Deficient Item
   * @param  {firebaseAdmin.database} db - Realtime DB Instance
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @return {Promise}
   */
  realtimeUpsertRecord(db, propertyId, deficiencyId, data) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(data && typeof data === 'object', 'has upsert data');
    return db
      .ref(`${DATABASE_PATH}/${propertyId}/${deficiencyId}`)
      .update(data);
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(defItemId && typeof defItemId === 'string', 'has deficient item id');
    assert(data && typeof data === 'object', 'has data');
    const recordData = JSON.parse(JSON.stringify(data)); // clone
    delete recordData.property; // remove property attribute
    return db
      .ref(`${DATABASE_PATH}/${propertyId}/${defItemId}`)
      .update(recordData);
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
   * Find a progress note by its' ID
   * @param  {admin.database} db
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @param  {String} progNoteId
   * @return {Promise} - resolves {DataSnapshot}
   */
  realtimeFindRecordProgressNote(db, propertyId, deficiencyId, progNoteId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(
      progNoteId && typeof progNoteId === 'string',
      'has progress note id'
    );
    const path = `${DATABASE_PATH}/${propertyId}/${deficiencyId}/${progNoteId}`;
    return db.ref(path).once('value');
  },

  /**
   * Perform update of single completed photo of
   * deficient items
   * @param  {admin.database} db
   * @param  {admin.firestore} fs
   * @param  {String} propertyId
   * @param  {String} deficientItemId
   * @param  {String} completedPhotoId
   * @param  {String} trelloAttachmentId
   * @return {Promise} - resolves {void}
   */
  async updateCompletedPhotoTrelloCardAttachment(
    db,
    fs,
    propertyId,
    deficientItemId,
    completedPhotoId,
    trelloAttachmentId
  ) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
    const updatedAt = Math.round(Date.now() / 1000);

    // Atomic realtime update
    try {
      await db.ref().update({
        // Modify DI's mark latest changes
        [`${path}/updatedAt`]: updatedAt,

        // Update DI's completed photo trello attachment id
        [`${path}/completedPhotos/${completedPhotoId}/trelloCardAttachement`]: trelloAttachmentId,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} updateCompletedPhotoTrelloCardAttachment: realtime update failed: ${err}`
      );
    }

    try {
      await this.firestoreUpdateRecord(fs, deficientItemId, {
        updatedAt,
        [`completedPhotos.${completedPhotoId}.trelloCardAttachement`]: trelloAttachmentId,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} updateCompletedPhotoTrelloCardAttachment: firestore update failed: ${err}`
      );
    }
  },

  /**
   * Move a deficient item under `/archive`
   * and remove it from its' active location
   * @param  {admin.database} db
   * @param  {admin.firebase} fs
   * @param  {DataSnapshot} diSnap // TODO: remove requiring
   * @param  {Boolean} archiving is the function either archiving or unarchiving this deficient item?
   * @return {Promise} - resolves {Object} updates hash
   */
  async toggleArchive(db, fs, diSnap, archiving = true) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
      diData.archive = false;

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
        fs,
        propertyId,
        defItemId,
        archiving
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code !== 'ERR_TRELLO_CARD_DELETED') {
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
   * @param  {admin.firestore} fs
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, deficientItemId, data, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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

    const doc = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.create(doc, data);
      return Promise.resolve();
    }

    return doc.create(data);
  },

  /**
   * Create a deficiency ensuring that
   * it is not a duplicate for a matching
   * proeprty/inspection/item combination
   * @param  {admin.firestore} fs - Firestore Admin DB instance
   * @param  {String} deficiencyId
   * @param  {Object} data
   * @return {Promise}
   */
  async firestoreSafelyCreateRecord(fs, deficiencyId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(data && typeof data === 'object', 'has record data');
    assert(data.item && typeof data.item === 'string', 'has item reference');
    assert(
      data.inspection && typeof data.inspection === 'string',
      'has inspection reference'
    );
    assert(
      data.property && typeof data.property === 'string',
      'has property reference'
    );

    let archived = null;
    let archivedId = '';
    const query = {
      propertyId: data.property,
      inspectionId: data.inspection,
      itemId: data.item,
    };

    // Recover any previously
    // archived firestore deficiency
    try {
      const archivedDoc = await archive.deficientItem.firestoreFindRecord(
        fs,
        query
      );
      archived = archivedDoc ? archivedDoc.data() : null;
      if (archived) {
        archivedId = archivedDoc.id;
        delete archived._collection; // Remove arhive only attibute
      }
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreSafelyCreateRecord: archive lookup failed: ${err}`
      );
    }

    try {
      await fs.runTransaction(async transaction => {
        const existingQuery = fs
          .collection(DEFICIENT_COLLECTION)
          .where('property', '==', data.property)
          .where('inspection', '==', data.inspection)
          .where('item', '==', data.item);
        const existingDeficiencies = await transaction.get(existingQuery);

        if (existingDeficiencies.size === 0) {
          this.firestoreCreateRecord(
            fs,
            archivedId || deficiencyId,
            { ...data, ...archived },
            transaction
          );

          if (archived) {
            // Cleanup firestore archive
            archive.deficientItem.firestoreRemoveRecord(
              fs,
              archivedId,
              transaction
            );
          }
        }
      });
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreSafelyCreateRecord: transaction failed: ${err}`
      );
    }
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise}
   */
  firestoreFindRecord(fs, deficientItemId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    return fs
      .collection(DEFICIENT_COLLECTION)
      .doc(deficientItemId)
      .get();
  },

  /**
   * Lookup Firestore Deficiency
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQueryRecords(fs, query) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query object');

    const { property, inspection, item } = query;
    assert(property && typeof property === 'string', 'has property id');
    assert(inspection && typeof inspection === 'string', 'has inspection id');
    assert(item && typeof item === 'string', 'has item id');

    return fs
      .collection(DEFICIENT_COLLECTION)
      .where('property', '==', property)
      .where('inspection', '==', inspection)
      .where('item', '==', item)
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
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    return colRef.where('property', '==', propertyId).get();
  },

  /**
   * Lookup Firestore Deficiency Item's
   * belonging to a single inspection
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} inspectionId
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQueryByInspection(fs, inspectionId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(inspectionId && typeof inspectionId === 'string', 'has property id');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    return colRef.where('inspection', '==', inspectionId).get();
  },

  /**
   * Lookup Firestore Deficiency Item query
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @param  {Object} query
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreQuery(fs, query) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query hash');
    const colRef = fs.collection(DEFICIENT_COLLECTION);
    Object.keys(query).forEach(attr => colRef.where(attr, '==', query[attr]));
    return colRef.get();
  },

  /**
   * Remove Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {firestore.batch?} batch
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, deficientItemId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficientItemId && typeof deficientItemId === 'string',
      'has deficient item id'
    );
    const doc = fs.collection(DEFICIENT_COLLECTION).doc(deficientItemId);

    if (batch) {
      batch.delete(doc);
      return Promise.resolve();
    }

    return doc.delete();
  },

  /**
   * Update Firestore Deficient Item
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} deficientItemId
   * @param  {Object} data
   * @return {Promise}
   */
  firestoreUpdateRecord(fs, deficientItemId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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
   * Archive a Firestore deficiency
   * TODO: Remove `db` once system models migrated
   * @param  {admin.database} db
   * @param  {admin.firestore} fs
   * @param  {String}  deficiencyId
   * @return {Promise}
   */
  async firestoreDeactivateRecord(db, fs, deficiencyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await this.firestoreFindRecord(fs, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = fs.batch();
    const deficientItem = diDoc.data();
    deficientItem.archive = true;

    try {
      await archive.deficientItem.firestoreCreateRecord(
        fs,
        deficiencyId,
        deficientItem,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: archived DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await this.firestoreRemoveRecord(fs, deficiencyId, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: DI "${deficiencyId}" remove failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreDeactivateRecord: batch commit failed: ${err}`
      );
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        db,
        fs,
        deficientItem.property,
        deficiencyId,
        false
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code !== 'ERR_TRELLO_CARD_DELETED') {
        const resultErr = Error(
          `${PREFIX} firestoreDeactivateRecord: failed to unarchive trello card | ${err}`
        );
        resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
        throw resultErr;
      }
    }

    return updates;
  },

  /**
   * Unarchive a previously
   * archived Firestore deficiency
   * TODO: Remove `db` once system models migrated
   * @param  {admin.database} db
   * @param  {admin.firestore} fs
   * @param  {String}  deficiencyId
   * @return {Promise}
   */
  async firestoreActivateRecord(db, fs, deficiencyId) {
    assert(db && typeof db.ref === 'function', 'has realtime db');
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );

    let diDoc = null;
    const updates = {};

    try {
      diDoc = await archive.deficientItem.firestoreFindRecord(fs, deficiencyId);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord:  DI "${deficiencyId}" lookup failed: ${err}`
      );
    }

    if (!diDoc.exists) {
      return updates;
    }

    const batch = fs.batch();
    const deficientItem = diDoc.data();
    delete deficientItem._collection; // Remove archive only attribute
    deficientItem.archive = false;

    try {
      await this.firestoreCreateRecord(fs, deficiencyId, deficientItem, batch);
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    try {
      await archive.deficientItem.firestoreRemoveRecord(
        fs,
        deficiencyId,
        batch
      );
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: DI "${deficiencyId}" create failed: ${err}`
      );
    }

    // Batched write
    try {
      await batch.commit();
    } catch (err) {
      throw Error(
        `${PREFIX} firestoreActivateRecord: batch commit failed: ${err}`
      );
    }

    // Archive Trello Card
    try {
      const trelloResponse = await systemModel.archiveTrelloCard(
        db,
        fs,
        deficientItem.property,
        deficiencyId,
        true
      );
      if (trelloResponse) updates.trelloCardChanged = trelloResponse.id;
    } catch (err) {
      if (err.code !== 'ERR_TRELLO_CARD_DELETED') {
        const resultErr = Error(
          `${PREFIX} firestoreActivateRecord: failed to archive trello card | ${err}`
        );
        resultErr.code = err.code || 'ERR_ARCHIVE_TRELLO_CARD';
        throw resultErr;
      }
    }

    return updates;
  },

  /**
   * Delete all inspections active
   * and archived, associated with
   * a property
   * @param  {admin.firestore} fs - Firestore DB instance
   * @param  {String} propertyId
   * @param  {firestore.batch} batch
   * @return {Promise} - resolves {QuerySnapshot[]}
   */
  firestoreRemoveForProperty(fs, propertyId, batch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(propertyId && typeof propertyId === 'string', 'has property id');

    return fs
      .runTransaction(async transaction => {
        const queryActive = fs
          .collection(DEFICIENT_COLLECTION)
          .where('property', '==', propertyId);

        // Collection references to
        // all active and archived
        // deficiencies for the property
        let activeDiSnap = null;
        let archivedDiSnap = null;
        const inspectionRefs = [];
        try {
          [activeDiSnap, archivedDiSnap] = await Promise.all([
            transaction.get(queryActive),
            archive.deficientItem.firestoreQueryByProperty(
              fs,
              propertyId,
              transaction
            ),
          ]);
          activeDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
          archivedDiSnap.forEach(({ ref }) => inspectionRefs.push(ref));
        } catch (err) {
          throw Error(
            `${PREFIX} firestoreRemoveForProperty: deficiency lookup failed: ${err}`
          );
        }

        // Include all deletes into batch
        const batchOrTrans = batch || transaction;
        inspectionRefs.forEach(ref => batchOrTrans.delete(ref));

        // Retuern all active/archived
        // deficiency query snapshots
        return [activeDiSnap, archivedDiSnap];
      })
      .catch(err => {
        throw Error(
          `${PREFIX} firestoreRemoveForProperty: deficiency deletes failed: ${err}`
        );
      });
  },

  /**
   * Delete a deficiency's image uploads
   * @param  {admin.storage} storage
   * @param  {String} propertyId
   * @param  {String} deficiencyId
   * @param  {String} url
   * @return {Promise}
   */
  deleteUpload(storage, propertyId, deficiencyId, url) {
    assert(storage && typeof storage.bucket === 'function', 'has storage');
    assert(propertyId && typeof propertyId === 'string', 'has property id');
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'has deficiency id'
    );
    assert(url && typeof url === 'string', 'has url string');

    const fileName = (decodeURIComponent(url).split('?')[0] || '')
      .split('/')
      .pop();
    const filePath = STORAGE_PATH_TEMPLATE.replace('{{propertyId}}', propertyId)
      .replace('{{deficiencyId}}', deficiencyId)
      .replace('{{fileName}}', fileName);

    return storage
      .bucket()
      .file(filePath)
      .delete()
      .catch(err => Promise.reject(Error(`${PREFIX} deleteUpload: ${err}`)));
  },

  /**
   * Generate a Firestore ID for deficiency collection
   * @param  {admin.firestore} fs
   * @return {String} - id
   */
  uuid(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(DEFICIENT_COLLECTION).doc().id;
  },
});
