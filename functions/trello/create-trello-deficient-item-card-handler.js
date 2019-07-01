const assert = require('assert');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const got = require('got');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const systemModel = require('../models/system');
const deficientItemsModel = require('../models/deficient-items');
const inspectionsModel = require('../models/inspections');
const integrationsModel = require('../models/integrations');
const config = require('../config');

const PREFIX = 'trello: create deficient item card:';
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

/**
 * Factory for creating trello cards for deficient items
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnTrelloDeficientItemCardHandler(db, auth) {
  assert(Boolean(db), `${PREFIX} has firebase database instance`);
  assert(Boolean(auth), `${PREFIX} has firebase auth instance`);

  /**
   * create trello card for requested deficient item
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const createTrelloDeficientItemCardHandler = async (req, res) => {
    const { body, user } = req;
    const { propertyId, deficientItemId, listId, boardId } = body;

    log.info(`${PREFIX} requested by user: ${user.id}`);

    if (!propertyId || !deficientItemId || !listId || !boardId) {
      let message = '';
      if (!listId) message = 'request missing listId property';
      if (!boardId) message = ' request missing boardId property';
      if (!propertyId) message = ' request missing propertyId property';
      if (!deficientItemId)
        message = ' request missing deficientItemId property';

      return res.status(400).send({ message: message.trim() });
    }

    let deficientItemSnap;
    try {
      deficientItemSnap = await deficientItemsModel.find(
        db,
        propertyId,
        deficientItemId
      );
      if (!deficientItemSnap.exists()) throw Error();
    } catch (err) {
      return res.status(409).send({
        message: 'Requested property or deficient item could not be found',
      });
    }

    const deficientItem = deficientItemSnap.val();

    let trelloCredentials = null;
    let trelloBoardDetails = null;

    try {
      const savedTokenCredentials = await systemModel.findTrelloCredentialsForProperty(
        db,
        propertyId
      );
      if (!savedTokenCredentials.exists()) throw Error();

      const trelloIntegrationSnap = await integrationsModel.findByTrelloProperty(
        db,
        propertyId
      );

      if (!trelloIntegrationSnap.exists()) {
        return res.status(409).send({
          message: 'Trello integration details for this property not found',
        });
      }

      trelloCredentials = savedTokenCredentials.val();
      trelloBoardDetails = trelloIntegrationSnap.val();
    } catch (err) {
      log.error(`${PREFIX} Error accessing trello token: ${err}`);
      return res.status(403).send({ message: 'Error accessing trello token' });
    }

    let inspectionItemSnap = null;
    try {
      inspectionItemSnap = await inspectionsModel.findItem(
        db,
        deficientItem.inspection,
        deficientItem.item
      );
    } catch (err) {
      log.error(`${PREFIX} inspection item lookup failed ${err}`);
      return res.status(500).send({ message: 'Error creating Trello Card' });
    }

    const inspectionItem = inspectionItemSnap.val();

    // Lookup and sort for item's largest score value
    const [highestItemScore] = ITEM_VALUE_NAMES.map(name =>
      typeof inspectionItem[name] === 'number' ? inspectionItem[name] : 0
    ).sort((a, b) => b - a);

    try {
      const trelloCardPayload = {
        name: deficientItem.itemTitle, // source inspection item name
        desc: `
        DEFICIENT ITEM (${deficientItem.createdAt})
        Score: ${deficientItem.itemScore} ${
          highestItemScore > 0 ? 'of' : ''
        } ${highestItemScore || ''}
        Inspector Notes: ${deficientItem.itemInspectorNotes}
        Plan to fix: ${deficientItem.currentPlanToFix}
        `,
        due: deficientItem.currentDueDate,
        idMembers: trelloCredentials.member,
      };

      const trelloResponse = await got(
        `https://api.trello.com/1/cards?idList=${trelloBoardDetails.list}&keyFromSource=all&key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}`,
        {
          headers: { 'content-type': 'application/json' },
          body: trelloCardPayload,
          responseType: 'json',
          json: true,
        }
      );

      const newTrelloCardID = trelloResponse.body.id;
      await systemModel.createPropertyTrelloCard(db, {
        property: propertyId,
        trelloCard: newTrelloCardID,
        inspectionItem: deficientItem.item,
      });
    } catch (err) {
      log.error(`${PREFIX} Error retrieved from Trello API: ${err}`);
      return res.status(err.statusCode || 500).send({
        message: 'Error from trello API',
      });
    }

    res.status(201).send({
      message: 'successfully created trello card',
    });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors(), bodyParser.json());
  app.post(
    '/deficient-items/trello/card',
    authUser(db, auth, true),
    createTrelloDeficientItemCardHandler
  );
  return app;
};
