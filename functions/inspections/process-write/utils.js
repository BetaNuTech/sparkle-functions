module.exports = {
  /**
   * Is inspection valid for writing new
   * proxy inspection records
   * @param  {firebaseAdmin.database} db
   * @param  {Object} inspection
   * @return {Promise}
   */
  async isInspectionWritable(db, inspection, logPrefix = '') {
    if (!inspection.property) {
      throw new Error(`${logPrefix} property relationship missing`);
    }

    // Stop if inspection dead (belongs to archived property)
    const propertySnap = await db
      .ref(`/properties/${inspection.property}`)
      .once('value');
    if (!propertySnap.exists()) {
      throw new Error(`${logPrefix} inspection belongs to archived property`);
    }
  },
};
