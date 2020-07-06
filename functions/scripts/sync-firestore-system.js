const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const systemModel = require('../models/system');

(async () => {
  // /system/integrations/{uid}/trello/organization
  // const trelloSnap = await systemModel.findTrelloCredentials(db);
  // TODO

  // /system/integrations/{uid}/yardi/organization
  // const yardiSnap = await systemModel.findYardiCredentials(db);
  // TODO

  // /system/integrations/{uid}/cobalt/organization
  // const cobaltSnap = await systemModel.findCobaltCredentials(db)
  // TODO

  // /system/integrations/{uid}/slack/organization
  const slackSnap = await systemModel.findSlackCredentials(db);

  if (slackSnap.val()) {
    const slackCredentials = slackSnap.val();
    await systemModel.firestoreUpsertSlack(fs, {
      token: slackCredentials.accessToken,
      scope: slackCredentials.scope,
      createdAt: Math.round(slackCredentials.createdAt),
    });
    log.info(`Synced Slack Credentials`);
  }

  log.info('Completed system sync successfully');
  process.exit();
})();
