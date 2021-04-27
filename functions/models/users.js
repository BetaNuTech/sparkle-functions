const assert = require('assert');
const FieldValue = require('firebase-admin').firestore.FieldValue;
const modelSetup = require('./utils/model-setup');

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
  firestoreBatchRemoveTeam(fs, userIds, teamId, parentBatch) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
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

    const batch = parentBatch || fs.batch();
    const collection = fs.collection(USERS_COLLECTION);

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
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  firestoreFindRecord(fs, userId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return fs
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
  async firestoreUpsertRecord(db, userId, data, transaction) {
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
      throw Error(
        `${PREFIX} firestoreUpsertRecord: Failed to get document: ${err}`
      );
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
        `${PREFIX} firestoreUpsertRecord: ${
          exists ? 'updating' : 'creating'
        } document: ${err}`
      );
    }

    return docRef;
  },

  /**
   * Create a Firestore user
   * @param  {admin.firestore} fs
   * @param  {String} userId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  firestoreCreateRecord(fs, userId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    assert(data && typeof data === 'object', 'has data');
    return fs
      .collection(USERS_COLLECTION)
      .doc(userId)
      .create(data);
  },

  /**
   * Remove Firestore User
   * @param  {firebaseAdmin.firestore} fs - Firestore DB instance
   * @param  {String} userId
   * @return {Promise}
   */
  firestoreRemoveRecord(fs, userId) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(userId && typeof userId === 'string', 'has user id');
    return fs
      .collection(USERS_COLLECTION)
      .doc(userId)
      .delete();
  },
  /**
   * Query all users with a team in
   * their `teams` hash
   * @param  {admin.firestore} fs
   * @param  {String} teamId
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {QuerySnapshot}
   */
  firestoreFindByTeam(fs, teamId, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(teamId && typeof teamId === 'string', 'has team id');

    const query = fs
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
   * @param  {admin.firestore} fs
   * @param  {Object} query
   * @param  {firestore.transaction?} transaction
   * @return {Promise} - resolves {DataSnapshot}
   */
  firestoreQuery(fs, query, transaction) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    assert(query && typeof query === 'object', 'has query');
    if (transaction) {
      assert(
        typeof transaction.get === 'function',
        'has firestore transaction'
      );
    }

    let fsQuery = fs.collection(USERS_COLLECTION);

    // Append each query as where clause
    Object.keys(query).forEach(attr => {
      const queryArgs = query[attr];
      assert(
        queryArgs && Array.isArray(queryArgs),
        'has query arguments array'
      );
      fsQuery = fsQuery.where(attr, ...queryArgs);
    });

    if (transaction) {
      return Promise.resolve(transaction.get(fsQuery));
    }

    return fsQuery.get(query);
  },

  /**
   * Lookup all user documents snapshots
   * @param  {admin.firestore} fs
   * @return {Promise} - resolves {DocumentSnapshot[]}
   */
  firestoreFindAll(fs) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    return fs.collection(USERS_COLLECTION).get();
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
      throw Error(`${PREFIX} unexpected claims lookup error`);
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
      throw Error(`${PREFIX} unexpected claims lookup error`);
    }

    return Boolean(reqUserClaims.admin);
  },

  /**
   * Requestor has permission to perform update
   * @param {admin.auth} auth - Firebase Auth instance
   * @param {String} requestingUserId - user ID
   * @param {Object} updates
   * @return {Promise} - resolves {Boolean}
   */
  async hasUpdatePermission(auth, requestingUserId, updates) {
    assert(
      auth && typeof auth.getUser === 'function',
      'has firebase auth instance'
    );
    assert(
      requestingUserId && typeof requestingUserId === 'string',
      'has requesting user ID'
    );
    assert(updates && typeof updates === 'object', 'has updates hash');

    const isUpdatingSuperAdmin = typeof updates.superAdmin === 'boolean';

    // Get requesting user's current custom claim state
    let reqUserClaims = null;
    try {
      reqUserClaims = await this.getCustomClaims(auth, requestingUserId);
    } catch (err) {
      throw Error(`${PREFIX} unexpected claims lookup error`);
    }

    // Non super admins may not set super admins
    if (isUpdatingSuperAdmin && !reqUserClaims.superAdmin) {
      return false;
    }

    // All other updates require admin claim
    if (!isUpdatingSuperAdmin && !reqUserClaims.admin) {
      return false;
    }

    return true;
  },
});
