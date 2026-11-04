const {
  AWS_S3_ACCESS_KEY_ID,
  AWS_S3_SECRET_ACCESS_KEY,
  AWS_S3_BUCKET_NAME,
} = process.env;

if (!AWS_S3_ACCESS_KEY_ID) {
  console.warn(
    'Warning: "AWS_S3_ACCESS_KEY_ID" not configured for AWS S3 Uploads'
  );
}

if (!AWS_S3_SECRET_ACCESS_KEY) {
  console.warn(
    'Warning: "AWS_S3_SECRET_ACCESS_KEY" not configured for AWS S3 Uploads'
  );
}

if (!AWS_S3_BUCKET_NAME) {
  console.warn(
    'Warning: "AWS_S3_BUCKET_NAME" not configured for AWS S3 Uploads'
  );
}

module.exports = {
  accessKeyId: AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: AWS_S3_SECRET_ACCESS_KEY,
  endpoint: 's3.amazonaws.com',
  inspectionReportBucket: AWS_S3_BUCKET_NAME,
};
