const fs = require('fs');
const assert = require('assert');
const s3Client = require('../../../utils/s3-client');
const CONFIG = require('../../../config');

/**
 * Upload a local file to the inspection report S3 bucket
 * @param  {Buffer} file
 * @param  {String} destPath
 * @return {Promise} - resolves {String} Url to inspection PDF
 */
module.exports = function uploadInspectionPromise(file, destPath) {
  assert('has file buffer', file instanceof Buffer);
  assert('has upload string', destPath && typeof destPath === 'string');

  return new Promise((resolve, reject) => {
    s3Client.putObject(
      {
        Body: file,
        Bucket: CONFIG.s3.inspectionReportBucket,
        Key: destPath,
        ContentType: 'application/pdf'
      },
      (putErr, result) => {
        if (putErr) return reject(putErr);
        resolve(
          `https://${CONFIG.s3.inspectionReportBucket}.${
            CONFIG.s3.endpoint
          }/${destPath}`
        );
      }
    );
  });
}
