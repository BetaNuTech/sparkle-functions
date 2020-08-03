const createOnDeleteWatcher = require('./on-delete-watcher');
const onDeleteV2 = require('./on-delete-v2');
const removeForProperty = require('./utils/remove-for-property');
const createSyncTeam = require('./pubsub/team-sync');
const createSyncUserTeam = require('./pubsub/user-teams-sync');

module.exports = {
  removeForProperty,
  createOnDeleteWatcher,
  onDeleteV2,

  pubsub: {
    createSyncTeam,
    createSyncUserTeam,
  },
};
