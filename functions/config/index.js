const s3Config = require('./s3.json');

const env = (process.env.NODE_ENV || 'production');

if (env === 'development' || env === 'test') {
  // development settings
} else {
  // Production (default) settings
}

s3Config.accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
s3Config.secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;

module.exports = Object.assign(
  {env},
  {s3: s3Config},
  {
    /**
     * Apply firebase configuration to config
     * @param  {Object} fbConfig
     * @return {Object} - config
     */
    configure(fbConfig = {}) {
      const sapphireinspections = fbConfig.sapphireinspections || {};

      if (sapphireinspections.aws_s3_access_key_id) {
        this.s3.accessKeyId = sapphireinspections.aws_s3_access_key_id;
      }

      if (sapphireinspections.aws_s3_secret_access_key) {
        this.s3.secretAccessKey = sapphireinspections.aws_s3_secret_access_key;
      }

      return this;
    }
  }
);
