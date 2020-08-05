const onDeleteV2 = require('./on-delete-v2');
const removeForProperty = require('./utils/remove-for-property');
const createSyncUserTeam = require('./pubsub/user-teams-sync');

module.exports = {
  removeForProperty,
  onDeleteV2,

  pubsub: {
    createSyncUserTeam,
  },
};
