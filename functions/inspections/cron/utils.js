const assert = require('assert');

module.exports = {
  /**
   * Determine if inspection proxy is outdated
   * @param  {firebaseAdmin.database} db
   * @param  {Object} inspection
   * @param  {String} proxyDbPath
   * @return {Promise} - resolves {Boolean}
   */
  isInspectionOutdated: async (db, inspection, proxyDbPath) => {
    assert(Boolean(db), 'has firebase database reference');
    assert(proxyDbPath && typeof proxyDbPath === 'string', 'has proxy DB path');

    if (!inspection || !inspection.updatedLastDate) {
      return false;
    }

    // Lookup mismatched `updatedLastDate` and check for
    // any difference between inspection & proxy last update date
    const proxyUpdateDateSnap = await db.ref(`${proxyDbPath}/updatedLastDate`).once('value');
    return !proxyUpdateDateSnap.exists() || proxyUpdateDateSnap.val() !== inspection.updatedLastDate;
  },

  /**
   * Run function against each inspection
   * paginated by groups of 10 to prevent exceeding
   * memory limits
   * @param {firebaseAdmin.database} db
   * @param {Function} fn
   */
  forEachInspection: async (db, fn) => {
    let inspectionIds = [];

    // Fetch first inspection ID in database
    let lastInspectionId = await db.ref('/inspections').orderByKey().limitToFirst(1).once('value');
    lastInspectionId = Object.keys(lastInspectionId.val())[0];

    // Has no inspections
    if (!lastInspectionId) {
      return;
    }

    do {
      // Load inspections 10 at a time
      let queuedInspections = await db.ref('/inspections').orderByKey().startAt(lastInspectionId).limitToFirst(11).once('value');
      queuedInspections = queuedInspections.val();

      // Remove last itterations' last inspection
      // that's been already upserted
      if (inspectionIds.length > 0) {
        delete queuedInspections[lastInspectionId];
      }

      inspectionIds = Object.keys(queuedInspections);
      lastInspectionId = inspectionIds[inspectionIds.length - 1];

      let i, updatedInspectionProxies;

      // Sync inspection data to propertyInspectionsList,
      for (i = 0; i < inspectionIds.length; i++) {
        const inspectionId = inspectionIds[i];
        const inspectionSnap = await db.ref(`/inspections/${inspectionId}`).once('value');
        const inspection = inspectionSnap.val();
        await fn(
          inspectionId,
          inspection
        );
      }
    } while (inspectionIds.length > 0);
    return;
  }
}
