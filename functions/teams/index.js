const createOnDeleteWatcher = require('./on-delete-watcher');
const createOnWriteUserTeamWatcher = require('./on-write-user-teams-watcher');
const removeForProperty = require('./utils/remove-for-property');
const createSyncTeam = require('./pubsub/team-sync');
const createSyncUserTeam = require('./pubsub/user-teams-sync');

module.exports = {
  removeForProperty,
  createOnDeleteWatcher,
  createOnWriteUserTeamWatcher,

  pubsub: {
    createSyncTeam,
    createSyncUserTeam,
  },
};
