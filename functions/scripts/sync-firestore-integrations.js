const log = require('../utils/logger');
const { db, fs } = require('./setup'); // eslint-disable-line
const integrationsModel = require('../models/integrations');
const utils = require('../utils/firebase-admin');

(async () => {
  // /integrations/trello/organization
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
    try {
      await integrationsModel.firestoreUpsertTrello(fs, trelloDetails);
      log.info(`Synced Trello Integration`);
    } catch (err) {}
  }

  // /integrations/trello/properties/{propertyId}
  await utils.forEachChild(
    db,
    `/integrations/trello/properties`,
    async (id, data) => {
      log.info(`Syncing Trello Integration of Property: "${id}"`);

      try {
        await integrationsModel.firestoreCreateTrelloProperty(fs, id, data);
      } catch (err) {
        log.error(
          `Failed to sync Property: "${id}" Trello Integration Details`
        );
      }
    }
  );

  // /integrations/yardi/organization
  const yardiSnap = await integrationsModel.getYardiOrganization(db);
  if (yardiSnap.val()) {
    const details = yardiSnap.val();
    try {
      await integrationsModel.firestoreCreateYardi(fs, details);
      log.info(`Synced Yardi Integration`);
    } catch (err) {} // eslint-disable-line
  }

  // /integrations/cobalt/organization
  const cobaltSnap = await integrationsModel.getCobaltOrganization(db);
  if (cobaltSnap.val()) {
    const details = cobaltSnap.val();
    try {
      await integrationsModel.firestoreCreateCobalt(fs, details);
      log.info(`Synced Cobalt Integration`);
    } catch (err) {} // eslint-disable-line
  }

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
    try {
      await integrationsModel.firestoreSetSlack(fs, slackDetails);
      log.info(`Synced Slack Integration`);
    } catch (err) {}
  }

  log.info('Completed integration sync successfully');
  process.exit();
})();
