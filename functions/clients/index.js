const getAppVersions = require('./api/get-app-versions');
const postError = require('./api/post-error');

module.exports = {
  api: { getAppVersions, postError },
};
