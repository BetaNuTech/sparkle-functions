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
  }
}
