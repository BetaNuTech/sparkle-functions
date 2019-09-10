const upsert = require('./utils/upsert');
const remove = require('./utils/remove');
const processWrite = require('./utils/process-write');
const removeForProperty = require('./utils/remove-for-property');

module.exports = {
  upsert,
  remove,
  processWrite,
  removeForProperty,
};
