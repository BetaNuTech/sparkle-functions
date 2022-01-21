const assert = require('assert');
const s3Client = require('../../utils/s3-client');
const CONFIG = require('../../config');

module.exports = {
  /**
   * Upload a local file to the inspection report S3 bucket
   * @param  {Buffer} file
   * @param  {String} destPath
   * @return {Promise} - resolves {String} Url to inspection PDF
   */
  s3(file, destPath) {
    assert(Buffer.isBuffer(file), 'has file buffer');
    assert(destPath && typeof destPath === 'string', 'has upload string');

    return new Promise((resolve, reject) => {
      s3Client.putObject(
        {
          Body: file,
          Bucket: CONFIG.s3.inspectionReportBucket,
          Key: destPath,
          ContentType: 'application/pdf',
        },
        putErr => {
          if (putErr) return reject(putErr);
          return resolve(
            `https://${CONFIG.s3.inspectionReportBucket}.${CONFIG.s3.endpoint}/${destPath}`
          );
        }
      );
    });
  },
};
