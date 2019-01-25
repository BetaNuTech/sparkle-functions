module.exports = {
  /**
   * Fetch a list of all ID's for a record type
   * @param  {firebaseAdmin.database} db
   * @param  {String} recordPath
   * @return {Promise} - resolves {String[]} ID's
   */
  fetchRecordIds(db, recordPath) {
    return db.ref(recordPath).once('value').then((snapShot) => {
      // No records in database
      if (!snapShot.exists()) {
        return [];
      }

      // Collect all truthy ID's
      return (
        snapShot.hasChildren() ? Object.keys(snapShot.toJSON()) : [snapShot.key]
      ).filter(Boolean); // ignore null's
    });
  }
}
