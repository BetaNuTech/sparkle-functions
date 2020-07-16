const log = require('../utils/logger');
const { db, fs, uid } = require('./setup'); // eslint-disable-line
const systemModel = require('../models/system');
const utils = require('../utils/firebase-admin');

(async () => {
  // /system/integrations/{uid}/trello/organization
  const trelloSnap = await systemModel.findTrelloCredentials(db);
  if (trelloSnap.val()) {
    const trelloCredentials = trelloSnap.val();
    if (trelloCredentials.createdAt) {
      trelloCredentials.createdAt = Math.round(trelloCredentials.createdAt);
    }
    if (trelloCredentials.updatedAt) {
      trelloCredentials.updatedAt = Math.round(trelloCredentials.updatedAt);
    } else {
      trelloCredentials.updatedAt = Math.round(Date.now() / 1000);
    }
    await systemModel.firestoreUpsertTrello(fs, trelloCredentials);
    log.info(`Synced Trello Credentials`);
  }

  // /system/integrations/${uid}/trello/properties
  await utils.forEachChild(
    db,
    `/system/integrations/${uid}/trello/properties`,
    async (id, data) => {
      log.info(`Syncing Property: "${id}" Trello Details`);

      try {
        await systemModel.firestoreCreateTrelloProperty(fs, id, data);
      } catch (err) {
        log.error(`Failed to sync Property: "${id}" Trello Details`);
      }
    }
  );

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
    slackCredentials.token = slackCredentials.accessToken;
    if (slackCredentials.createdAt) {
      slackCredentials.createdAt = Math.round(slackCredentials.createdAt);
    }
    if (slackCredentials.updatedAt) {
      slackCredentials.updatedAt = Math.round(slackCredentials.updatedAt);
    } else {
      slackCredentials.updatedAt = Math.round(Date.now() / 1000);
    }
    await systemModel.firestoreUpsertSlack(fs, slackCredentials);
    log.info(`Synced Slack Credentials`);
  }

  log.info('Completed system sync successfully');
  process.exit();
})();
