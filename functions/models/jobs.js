const assert = require('assert');
const modelSetup = require('./utils/model-setup');

const JOB_COLLECTION = 'jobs';

module.exports = modelSetup({
  /**
   * Create a Firestore job
   * @param  {admin.firestore} fs
   * @param  {String?} jobId
   * @param  {Object} data
   * @return {Promise} - resolves {WriteResult}
   */
  createRecord(fs, jobId, data) {
    assert(fs && typeof fs.collection === 'function', 'has firestore db');
    if (jobId) assert(typeof jobId === 'string', 'has valid job id');
    assert(data && typeof data === 'object', 'has data');
    assert(
      data.property && data.property.id,
      'has firestore property document reference'
    );
    if (jobId === undefined) jobId = fs.collection(JOB_COLLECTION).doc().id;

    return fs
      .collection(JOB_COLLECTION)
      .doc(jobId)
      .create(data);
  },
});
