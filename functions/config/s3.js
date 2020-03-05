if (!process.env.AWS_S3_ACCESS_KEY_ID) {
  throw Error('"AWS_S3_ACCESS_KEY_ID" not configured for AWS S3 Uploads');
}

if (!process.env.AWS_S3_SECRET_ACCESS_KEY) {
  throw Error('"AWS_S3_SECRET_ACCESS_KEY" not configured for AWS S3 Uploads');
}

module.exports = {
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  endpoint: 's3.amazonaws.com',
  inspectionReportBucket: 'sapphireinspections',
};
