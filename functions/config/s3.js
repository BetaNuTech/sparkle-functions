const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

// Use any system or firebase AWS secrets
const AWS_S3_ACCESS_KEY_ID =
  process.env.AWS_S3_ACCESS_KEY_ID ||
  (firebaseConfig.aws && firebaseConfig.aws.id);

const AWS_S3_SECRET_ACCESS_KEY =
  process.env.AWS_S3_SECRET_ACCESS_KEY ||
  (firebaseConfig.aws && firebaseConfig.aws.key);

const AWS_S3_BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME ||
  (firebaseConfig.aws && firebaseConfig.aws.bucketname);

if (!AWS_S3_ACCESS_KEY_ID) {
  throw Error('"AWS_S3_ACCESS_KEY_ID" not configured for AWS S3 Uploads');
}

if (!AWS_S3_SECRET_ACCESS_KEY) {
  throw Error('"AWS_S3_SECRET_ACCESS_KEY" not configured for AWS S3 Uploads');
}

if (!AWS_S3_BUCKET_NAME) {
  throw Error('"AWS_S3_BUCKET_NAME" not configured for AWS S3 Uploads');
}

module.exports = {
  accessKeyId: AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
  endpoint: 's3.amazonaws.com',
  inspectionReportBucket: AWS_S3_BUCKET_NAME,
};
