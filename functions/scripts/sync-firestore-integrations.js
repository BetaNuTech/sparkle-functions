const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const integrationsModel = require('../models/integrations');

(async () => {
  // /system/integrations/{uid}/trello/organization
  const trelloSnap = await integrationsModel.getTrelloOrganization(db);
  if (trelloSnap.val()) {
    const trelloDetails = trelloSnap.val();
    if (trelloDetails.createdAt) {
      trelloDetails.createdAt = Math.round(trelloDetails.createdAt);
    }
    if (trelloDetails.updatedAt) {
      trelloDetails.updatedAt = Math.round(trelloDetails.updatedAt);
    } else {
      trelloDetails.updatedAt = Math.round(Date.now() / 1000);
    }
    await integrationsModel.firestoreUpsertTrello(fs, trelloDetails);
    log.info(`Synced Trello Integration`);
  }

  // /system/integrations/{uid}/yardi/organization
  // const yardiSnap = await integrationsModel.findYardiCredentials(db);
  // TODO

  // /system/integrations/{uid}/cobalt/organization
  // const cobaltSnap = await integrationsModel.findCobaltCredentials(db)
  // TODO

  // /integrations/slack/organization
  const slackSnap = await integrationsModel.getSlackOrganization(db);

  if (slackSnap.val()) {
    const slackDetails = slackSnap.val();
    if (slackDetails.createdAt) {
      slackDetails.createdAt = Math.round(slackDetails.createdAt);
    }
    if (slackDetails.updatedAt) {
      slackDetails.updatedAt = Math.round(slackDetails.updatedAt);
    } else {
      slackDetails.updatedAt = Math.round(Date.now() / 1000);
    }
    await integrationsModel.firestoreSetSlack(fs, slackDetails);
    log.info(`Synced Slack Integration`);
  }

  log.info('Completed integration sync successfully');
  process.exit();
})();
