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

  /**
   * Lookup template name inspection
   * @param  {Object} inspection
   * @return {String} - templateName
   */
  getTemplateName(inspection) {
    return inspection.templateName || inspection.template.name;
  },

  /**
   * Get inspection score or `0`
   * @param  {Object} inspection
   * @return {Number} - score
   */
  getScore(inspection) {
    return inspection.score && typeof inspection.score === 'number'
      ? inspection.score
      : 0;
  },
};
