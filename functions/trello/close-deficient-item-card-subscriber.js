const log = require('../utils/logger');
const systemModel = require('../models/system');
const integrationsModel = require('../models/integrations');
const defItemModel = require('../models/deficient-items');
const parseDiStateEventMsg = require('./utils/parse-di-state-event-msg');

const PREFIX = 'trello: close-deficient-item-card-subscriber:';
const PROCESS_DI_STATES = ['closed', 'completed'];

/**
 * Move closed/completed DI Card to closed list
 * and remove any due date on the Trello card
 * @param  {string} topic
 * @param  {functions.pubsub} pubsub
 * @param  {firebaseadmin.database} db
 * @return {functions.cloudfunction}
 */
module.exports = function closeDiCardSubscriber(topic = '', pubsub, db) {
  return pubsub.topic(topic).onPublish(async message => {
    let propertyId = '';
    let deficientItemId = '';
    let deficientItemState = '';

    // Parse event message
    try {
      [propertyId, deficientItemId, deficientItemState] = parseDiStateEventMsg(
        message
      );
    } catch (err) {
      const msgErr = `${PREFIX} ${topic} message error: ${err}`;
      log.error(msgErr);
      throw Error(msgErr);
    }

    // Ignore events for non-closed/uncompleted DI's
    if (!PROCESS_DI_STATES.includes(deficientItemState)) {
      return;
    }

    log.info(
      `${PREFIX} received ${parseInt(
        Date.now() / 1000,
        10
      )} for DI: ${propertyId}/${deficientItemId} | state: ${deficientItemState}`
    );

    // Find created Trello Card reference
    let trelloCardId = '';
    try {
      trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficientItemId
      );
    } catch (err) {
      log.error(`${PREFIX} ${err}`);
      throw err;
    }

    if (!trelloCardId) {
      log.info(`${PREFIX} Deficient Item has no Trello Card, exiting`);
      return; // eslint-disable-line no-useless-return
    }

    // Closeout any due date on card
    const requestUpdates = {};

    // Add moving card to closed list to
    // updates if optional closed list target set
    if (deficientItemState === 'closed') {
      let closedList = '';
      try {
        const trelloIntegrationSnap = await integrationsModel.findByTrelloProperty(
          db,
          propertyId
        );

        const trelloIntegration = trelloIntegrationSnap.val() || {};
        closedList = trelloIntegration.closedList;
      } catch (err) {
        log.error(
          `${PREFIX}: property trello integration lookup failed | ${err}`
        );
      }

      if (closedList) {
        requestUpdates.idList = closedList;
      }
    }

    // Lookup Deficient Item
    let deficientItem = null;
    try {
      const deficientItemSnap = await defItemModel.find(
        db,
        propertyId,
        deficientItemId
      );
      deficientItem = deficientItemSnap.val();
    } catch (err) {
      log.error(`${PREFIX} deficient item lookup failed | ${err}`);
    }

    // Determine if due date could have been previously set
    // on Trello card before adding request to remove it
    if (
      deficientItem &&
      Boolean(deficientItem.deferredDates || deficientItem.dueDates)
    ) {
      requestUpdates.dueComplete = true;
    }

    // Abort if no updates necessary
    if (Object.keys(requestUpdates).length === 0) {
      return;
    }

    try {
      // Perform update request
      const trelloCardResponse = await systemModel.updateTrelloCard(
        db,
        propertyId,
        deficientItemId,
        trelloCardId,
        requestUpdates
      );
      if (trelloCardResponse)
        log.info(`${PREFIX} successfully closed Trello card`);
    } catch (err) {
      log.error(
        `${PREFIX} Failed request to update DI's Trello card: "${err.status ||
          'N/A'}" | message: "${err.body ? err.body.message : err}"`
      );
    }
  });
};
