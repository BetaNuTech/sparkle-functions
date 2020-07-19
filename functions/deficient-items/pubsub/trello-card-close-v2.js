const assert = require('assert');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const trello = require('../../services/trello');
const integrationsModel = require('../../models/integrations');
const deficiencyModel = require('../../models/deficient-items');
const parseDiStateEventMsg = require('../../trello/utils/parse-di-state-event-msg');

const PREFIX = 'deficiency: pubsub: trello-card-close:';
const PROCESS_DI_STATES = ['closed', 'completed'];

/**
 * Move closed/completed Deficiency's Trello Card
 * to closed list and/or remove any due date it has
 * @param  {admin.firestore} fs
 * @param  {functions.pubsub} pubsub
 * @param  {string} topic
 * @return {functions.cloudfunction}
 */
module.exports = function closeDeficiencyCard(fs, pubsub, topic) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(pubsub && typeof pubsub.topic === 'function', 'has pubsub client');
  assert(topic && typeof topic === 'string', 'has topic string');

  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficiencyId = '';
    let deficiencyState = '';

    // Parse event message
    try {
      [propertyId, deficiencyId, deficiencyState] = parseDiStateEventMsg(
        message
      );
    } catch (err) {
      throw Error(`${PREFIX} failed to parse pubsub message | ${err}`);
    }

    // Ignore events for non-closed/uncompleted DI's
    if (!PROCESS_DI_STATES.includes(deficiencyState)) {
      return;
    }

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.firestoreFindTrelloCardId(
        fs,
        propertyId,
        deficiencyId
      );
    } catch (err) {
      // Wrap error
      throw Error(
        `${PREFIX} system property trello card id lookup failed  | ${err}`
      );
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficiency has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    // Closeout any due date on card
    const requestUpdates = {};

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const trelloCredentialsSnap = await systemModel.firestoreFindTrello(fs);
      trelloCredentials = trelloCredentialsSnap.data();
      if (!trelloCredentials) {
        throw Error('Organization has not authorized Trello');
      }
    } catch (err) {
      log.warn(`${PREFIX} trello credentials not found | ${err}`); // wrap error
      return;
    }

    // Add moving card to closed list to
    // updates if optional closed list target set
    if (deficiencyState === 'closed') {
      let closedList = '';
      try {
        const trelloIntegrationSnap = await integrationsModel.firestoreFindTrelloProperty(
          fs,
          propertyId
        );

        const trelloIntegration = trelloIntegrationSnap.data() || {};
        closedList = trelloIntegration.closedList || '';
      } catch (err) {
        log.error(
          `${PREFIX} property trello integration lookup failed | ${err}`
        );
      }

      if (closedList) {
        requestUpdates.idList = closedList;
      }
    }

    // Lookup Deficient Item
    let deficiency = null;
    try {
      const deficiencySnap = await deficiencyModel.firestoreFindRecord(
        fs,
        deficiencyId
      );
      deficiency = deficiencySnap.data() || null;
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed | ${err}`);
    }

    // Determine if due date could have been previously set
    // on Trello card before adding request to remove it
    if (
      deficiency &&
      Boolean(deficiency.deferredDates || deficiency.dueDates)
    ) {
      requestUpdates.dueComplete = true;
    }

    // Abort if no updates necessary
    if (Object.keys(requestUpdates).length === 0) {
      return;
    }

    try {
      // Perform update request
      const trelloCardResponse = await trello.updateTrelloCard(
        trelloCardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        requestUpdates
      );
      if (trelloCardResponse) {
        log.info(
          `${PREFIX} successfully closed Trello card: "${trelloCardId}"`
        );
      }
    } catch (err) {
      if (err.code === 'ERR_TRELLO_CARD_DELETED') {
        try {
          await systemModel.firestoreCleanupDeletedTrelloCard(
            fs,
            deficiencyId,
            trelloCardId
          );
          return;
        } catch (cleanUpErr) {
          throw Error(
            `${PREFIX} failed to cleanup deleted Trello Card | ${cleanUpErr}`
          );
        }
      } else {
        throw Error(
          `${PREFIX} failed to update Trello card | ${
            err.body ? err.body.message : err
          }`
        );
      }
    }
  });
};
