const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');
const firestoreUtils = require('../utils/firestore');

const PREFIX = 'models: users:';
const USERS_COLLECTION = 'users';

module.exports = modelSetup({
  /**
   * Batch remove all firestore users
   * relationships to a deleted team
   * @param  {admin.database} db
   * @param  {String[]} userIds
   * @param  {String} teamId
   * @param  {firestore.batch?} parentBatch
   * @return {Promise}
   */
  batchRemoveTeam(db, userIds, teamId, parentBatch) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userIds && Array.isArray(userIds), 'has user ids is an array');
    assert(
      userIds.every(id => id && typeof id === 'string'),
      'user ids is an array of strings'
    );
    assert(teamId && typeof teamId === 'string', 'has team id');
    if (parentBatch) {
      assert(
        typeof parentBatch.update === 'function',
        'has firestore batch/transaction'
      );
    }

    const batch = parentBatch || db.batch();
    const collection = db.collection(USERS_COLLECTION);

    // Remove each users team
    userIds.forEach(id => {
      const userDoc = collection.doc(id);
      batch.update(userDoc, { [`teams.${teamId}`]: FieldValue.delete() });
    });

    if (parentBatch) {
      return Promise.resolve(parentBatch);
    }

    return batch.commit();
  },

  /**
   * Lookup Firestore user
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  findRecord(db, userId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .get();
  },

  /**
   * Create or update a Firestore user
   * @param  {admin.firestore} db
   * @param  {String}  userId
   * @param  {Object}  data
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DocumentReference}
   */
  async upsertRecord(db, userId, data, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has upsert data');

    const docRef = db.collection(USERS_COLLECTION).doc(userId);
    let docSnap = null;

    try {
      if (transaction) {
        assert(
          typeof transaction.get === 'function',
          'has tansaction instance'
        );
        docSnap = await transaction.get(docRef);
      } else {
        docSnap = await docRef.get();
      }
    } catch (err) {
      throw Error(`${PREFIX} upsertRecord: Failed to get document: ${err}`);
    }

    const { exists } = docSnap;
    const current = docSnap.data() || {};
    const upsert = { ...data };

    try {
      if (exists) {
        // Prevent admin/corporate inclusive state
        if (data.admin) {
          upsert.corporate = false;
        } else if (data.corporate) {
          upsert.admin = false;
        }

        // Replace optional field nulls
        // with Firestore delete values
        if (current.teams && data.teams === null) {
          upsert.teams = FieldValue.delete();
        }
        if (current.properties && data.properties === null) {
          upsert.properties = FieldValue.delete();
        }

        if (transaction) {
          assert(
            typeof transaction.update === 'function',
            'has transaction instance'
          );
          await transaction.update(docRef, upsert);
        } else {
          await docRef.update(upsert);
        }
      } else {
        // Ensure optional falsey values
        // do not exist on created Firestore
        if (!upsert.teams) delete upsert.teams;
        if (!upsert.properties) delete upsert.properties;
        if (transaction) {
          assert(
            typeof transaction.create === 'function',
            'has transaction instance'
          );
          await transaction.create(docRef, upsert);
        } else {
          await docRef.create(upsert);
        }
      }
    } catch (err) {
      throw Error(
        `${PREFIX} upsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Set Firestore User
   * @param  {admin.firestore} db
   * @param  {String} templateId
   * @param  {Object} data
   * @param  {firestore.batch?} batch
   * @param  {Boolean} merge - deep merge record
   * @return {Promise}
   */
  setRecord(db, userId, data, batch, merge = false) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has document id');
    assert(data && typeof data === 'object', 'has update data');

    const docRef = db.collection(USERS_COLLECTION).doc(userId);
    const finalData = JSON.parse(JSON.stringify(data)); // clone
    const deleteWrites = {};
    const teamDeletes = firestoreUtils.getDeleteWrites(
      finalData.teams || {},
      'teams'
    );
    const propertyDeletes = firestoreUtils.getDeleteWrites(
      finalData.properties || {},
      'properties'
    );

    // Merge all delete updates
    Object.assign(deleteWrites, propertyDeletes, teamDeletes);
    const hasDeleteWrites = isObjectEmpty(deleteWrites) === false;

    // Remove nested nulls in teams and properties
    firestoreUtils.removeNulls(finalData.teams || {});
    firestoreUtils.removeNulls(finalData.properties || {});

    // Remove empty properties/teams hashes
    // which could clear all associations
    const hasEmptyTeams = isObjectEmpty((finalData || {}).teams || {});
    const hasEmptyProperties = isObjectEmpty(
      (finalData || {}).properties || {}
    );
    if (hasEmptyTeams) delete finalData.teams;
    if (hasEmptyProperties) delete finalData.properties;

    // Add batched update
    if (batch) {
      assert(
        typeof batch.set === 'function' && typeof batch.update === 'function',
        'has batch instance'
      );
      batch.set(docRef, finalData, { merge });
      if (hasDeleteWrites) batch.update(docRef, deleteWrites); // add deletes
      return Promise.resolve();
    }

    // Normal update
    return docRef.set(finalData, { merge }).then(
      () => (hasDeleteWrites ? docRef.update(deleteWrites) : Promise.resolve()) // append any deletes
    );
  },

  /**
   * Create a Firestore user
   * @param  {admin.firestore} db
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(db, userId, data) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has data');
    return db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .create(data);
  },

  /**
   * Remove Firestore User
   * @param  {firebaseAdmin.firestore} db - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  removeRecord(db, userId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .delete();
  },
  /**
   * Query all users with a team in
   * their `teams` hash
   * @param  {admin.firestore} db
   * @param  {String} teamId
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {QuerySnapshot}
   */
  findByTeam(db, teamId, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    const query = db
      .collection(USERS_COLLECTION)
      .orderBy(`teams.${teamId}`)
      .startAfter(null);

    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
      return transaction.get(query);
    }

    return query.get();
  },

  /**
   * Query all uers
   * @param  {admin.firestore} db
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  query(db, query, transaction) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
    }

    let dbQuery = db.collection(USERS_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      dbQuery = dbQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      return Promise.resolve(transaction.get(dbQuery));
    }

    return dbQuery.get(query);
  },

  /**
   * Lookup all user documents snapshots
   * @param  {admin.firestore} db
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  findAll(db) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    return db.collection(USERS_COLLECTION).get();
  },

  /**
   * Delate a Firestore user document
   * @param  {admin.firestore} db - Firestore database instance
   * @param  {String} userId
   * @return {Promise}
   */
  deleteRecord(db, userId) {
    assert(db && typeof db.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user ID');
    return db
      .collection(USERS_COLLECTION)
      .doc(userId)
      .delete();
  },

  /**
   * Return all a user's custom claims
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @return {Promise} - resolves {Object}
   */
  getCustomClaims(auth, uid) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(uid && typeof uid === 'string', 'has user ID');
    return auth.getUser(uid).then(authUser => authUser.customClaims || {});
  },

  /**
   * Lookup a Firebase Auth user record
   * via an email address
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @return {Promise} - resolves {UserRecord} Firebase Auth user record
   */
  getAuthUserByEmail(auth, email) {
    assert(
      auth && typeof auth.getUserByEmail === 'function',
      'has firebase auth instance'
    );
    assert(email && typeof email === 'string', 'has email string');
    return auth.getUserByEmail(email);
  },

  /**
   * Toggle a user as disabled or not disabled
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @param {Boolean} isDisabled
   * @return {Promise} - resolves {UserRecord} Firebase Auth user record
   */
  setAuthUserDisabled(auth, uid, isDisabled) {
    assert(
      auth && typeof auth.updateUser === 'function',
      'has firebase auth instance'
    );
    assert(uid && typeof uid === 'string', 'has user ID');
    assert(typeof isDisabled === 'boolean', 'has is disabled state');

    return auth.updateUser(uid, {
      disabled: isDisabled,
    });
  },

  /**
   * Update a user's custom claims
   * by merging existing/updated claims
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @param {Object} updates
   * @return {Promise} - resolves {undefined}
   */
  async upsertCustomClaims(auth, uid, updates) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(uid && typeof uid === 'string', 'has user ID');
    assert(updates && typeof updates === 'object', 'has updates hash');

    // Prevent admin/corporate inclusive state
    if (updates.admin) {
      updates.corporate = false;
    } else if (updates.corporate) {
      updates.admin = false;
    }

    // Lookup existing claims state
    let existingClaims = null;
    try {
      existingClaims = await this.getCustomClaims(auth, uid);
    } catch (err) {
      throw Error(
        `${PREFIX} upsertCustomClaims: unexpected claims lookup error`
      );
    }

    return auth.setCustomUserClaims(uid, { ...existingClaims, ...updates });
  },

  /**
   * Lookup a Firebase Auth user record
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @return {Promise} - resolves {UserRecord} Firebase Auth user record
   */
  getAuthUser(auth, uid) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(uid && typeof uid === 'string', 'has user ID');
    return auth.getUser(uid);
  },

  /**
   * Create new Auth user
   * @param {admin.auth} auth - Firebase Auth instance
   * @param  {String} email
   * @return {Promise} - resolves {UserRecord} Auth user record
   */
  createAuthUser(auth, email) {
    assert(
      auth && typeof auth.createUser === 'function',
      'has firebase auth instance'
    );
    assert(email && typeof email === 'string', 'has email string');
    return auth.createUser({ email });
  },

  /**
   * Delete a Firebase Auth user
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} uid - user ID
   * @return {Promise}
   */
  deleteAuthUser(auth, uid) {
    assert(
      auth && typeof auth.deleteUser === 'function',
      'has firebase auth instance'
    );
    assert(uid && typeof uid === 'string', 'has user ID');
    return auth.deleteUser(uid);
  },

  /**
   * User has permission to create users
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} requestingUserId - user ID
   * @return {Promise} - resolves {Boolean}
   */
  async hasCrudPermission(auth, requestingUserId) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(
      requestingUserId && typeof requestingUserId === 'string',
      'has requesting user ID'
    );

    // Get requesting user's current custom claim state
    let reqUserClaims = null;
    try {
      reqUserClaims = await this.getCustomClaims(auth, requestingUserId);
    } catch (err) {
      throw Error(
        `${PREFIX} hasCrudPermission: unexpected claims lookup error`
      );
    }

    return Boolean(reqUserClaims.admin);
  },

  /**
   * Requestor has permission to perform update
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} requestingUserId - user ID
   * @param {String} targetUserId - user ID
   * @param {Object} hasUpdates
   * @return {Promise} - resolves {Boolean}
   */
  async hasUpdatePermission(auth, requestingUserId, targetUserId, hasUpdates) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(
      requestingUserId && typeof requestingUserId === 'string',
      'has requesting user ID'
    );
    assert(
      targetUserId && typeof targetUserId === 'string',
      'has target user ID'
    );
    assert(
      hasUpdates && typeof hasUpdates === 'object',
      'has has updates hash'
    );
    assert(
      Object.values(hasUpdates).every(v => typeof v === 'boolean'),
      'has updates is a flat boolean map'
    );

    const isSuperUserUpdate = hasUpdates.superAdmin;
    const isPermissionLevelUpdate = Boolean(
      hasUpdates.admin ||
        hasUpdates.coroprate ||
        hasUpdates.teams ||
        hasUpdates.properties ||
        hasUpdates.isDisabled
    );
    const isProfileUpdate = Boolean(
      hasUpdates.firstName || hasUpdates.lastName || hasUpdates.pushOptOut
    );

    // Get requesting user's current custom claim state
    let reqUserClaims = null;
    try {
      reqUserClaims = await this.getCustomClaims(auth, requestingUserId);
    } catch (err) {
      throw Error(
        `${PREFIX} hasUpdatePermission: unexpected claims lookup error`
      );
    }

    const isAdmin = reqUserClaims.admin;
    const isUpdatingSelf = requestingUserId === targetUserId;

    // Non super admins may not set super admins
    if (isSuperUserUpdate && !reqUserClaims.superAdmin) {
      return false;
    }

    // Non admins may not update permission levels
    if (isPermissionLevelUpdate && !isAdmin) {
      return false;
    }

    // Must be an admin or the target user
    // to update profile attributes
    if (isProfileUpdate && !isAdmin && !isUpdatingSelf) {
      return false;
    }

    return true;
  },
});

/**
 * Determine if an object contains anything
 * @param  {Object} obj
 * @return {Boolean}
 */
function isObjectEmpty(obj) {
  return Object.keys(obj).length === 0;
}
