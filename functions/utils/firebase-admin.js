const assert = require('assert');

module.exports = {
  /**
   * Fetch a list of all ID's for a record type
   * @param  {firebaseAdmin.database} db
   * @param  {String} recordPath
   * @return {Promise} - resolves {String[]} ID's
   */
  fetchRecordIds(db, recordPath) {
    return db
      .ref(recordPath)
      .once('value')
      .then(snapShot => {
        // No records in database
        if (!snapShot.exists()) {
          return [];
        }

        // Collect all truthy ID's
        return (snapShot.hasChildren()
          ? Object.keys(snapShot.toJSON())
          : [snapShot.key]
        ).filter(Boolean); // ignore null's
      });
  },

  /**
   * Run function against each child record
   * paginated groups by 10 to prevent exceeding
   * memory limits
   * @param {firebaseAdmin.database} db
   * @param {String} childName
   * @param {Function} fn
   */
  forEachChild: async (db, childName, fn) => {
    assert(Boolean(db), 'has firebase admin database');
    assert(childName && typeof childName === 'string', 'has child record name');
    assert(typeof fn === 'function', 'has callback function');

    let pageGroupIds = [];

    // Fetch first record ID in database
    let lastRecordId = await db
      .ref(`${childName}`)
      .orderByKey()
      .limitToFirst(1)
      .once('value');
    lastRecordId = Object.keys(lastRecordId.val() || {})[0];

    // Has no records
    if (!lastRecordId) {
      return;
    }

    do {
      // Load records 10 at a time
      let queuedRecords = await db
        .ref(`${childName}`)
        .orderByKey()
        .startAt(lastRecordId)
        .limitToFirst(11)
        .once('value');
      queuedRecords = queuedRecords.val() || {};

      // Remove last itterations' last record
      // that's been already upserted
      if (pageGroupIds.length > 0) {
        delete queuedRecords[lastRecordId];
      }

      pageGroupIds = Object.keys(queuedRecords);
      lastRecordId = pageGroupIds[pageGroupIds.length - 1];

      // Provide record id & data to callback
      for (let i = 0; i < pageGroupIds.length; i++) {
        const recordId = pageGroupIds[i];
        const snapshot = await db.ref(`${childName}/${recordId}`).once('value');
        const record = snapshot.val();
        await fn(recordId, record, snapshot);
      }
    } while (pageGroupIds.length > 0);
  },
};
