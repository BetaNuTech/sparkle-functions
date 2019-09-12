const assert = require('assert');
const express = require('express');
const cors = require('cors');
const got = require('got');
const hbs = require('handlebars');
const log = require('../utils/logger');
const authUser = require('../utils/auth-firebase-user');
const toISO8601 = require('./utils/date-to-iso-8601');
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
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @return {Function} - onRequest handler
 */
module.exports = function createOnTrelloDeficientItemCard(db, auth) {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  // Template all Card
  // descriptions come from
  const descriptionTemplate = hbs.compile(
    config.deficientItems.trelloCardDescriptionTemplate
  );

  /**
   * create trello card for requested deficient item
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  const handler = async (req, res) => {
    const { params, user } = req;
    const { propertyId, deficientItemId } = params;

    log.info(`${PREFIX} requested by user: ${user.id}`);

    if (!propertyId || !deficientItemId) {
      let message = '';
      if (!propertyId) message = 'request URL missing Property wildcard';
      if (!deficientItemId)
        message = ' request URL missing Deficient Item wildcard';
      return res.status(400).send({ message: message.trim() });
    }

    // Lookup Deficient Item
    let deficientItem;
    try {
      const deficientItemSnap = await deficientItemsModel.find(
        db,
        propertyId,
        deficientItemId
      );

      if (!deficientItemSnap.exists()) throw Error();
      deficientItem = deficientItemSnap.val();
    } catch (err) {
      return res.status(409).send({
        message: 'Requested property or deficient item could not be found',
      });
    }

    // Lookup Trello credentials
    let trelloCredentials = null;
    try {
      const savedTokenCredentials = await systemModel.findTrelloCredentials(db);

      if (!savedTokenCredentials.exists()) throw Error();
      trelloCredentials = savedTokenCredentials.val();
    } catch (err) {
      return res.status(403).send({ message: 'Error accessing trello token' });
    }

    // Reject request to re-create previously
    // published Trello Card
    try {
      const trelloCardExists = await systemModel.isDeficientItemTrelloCardCreated(
        db,
        propertyId,
        deficientItemId
      );
      if (trelloCardExists) throw Error();
    } catch (err) {
      return res
        .status(409)
        .send({ message: 'Deficient Item already has published Trello Card' });
    }

    // Lookup integration data
    let trelloPropertyConfig = null;
    try {
      const trelloIntegrationSnap = await integrationsModel.findByTrelloProperty(
        db,
        propertyId
      );

      if (!trelloIntegrationSnap.exists()) throw Error();
      trelloPropertyConfig = trelloIntegrationSnap.val();
      if (!trelloPropertyConfig.openList) throw Error();
    } catch (err) {
      return res.status(409).send({
        message: 'Trello integration details for property not found or invalid',
      });
    }

    // Look DI's Inspection
    let inspectionItem = null;
    try {
      const inspectionItemSnap = await inspectionsModel.findItem(
        db,
        deficientItem.inspection,
        deficientItem.item
      );
      if (!inspectionItemSnap.exists()) throw Error();
      inspectionItem = inspectionItemSnap.val();
    } catch (err) {
      log.error(`${PREFIX} inspection item lookup failed | ${err}`);
      return res
        .status(409)
        .send({ message: 'Inspection of Deficient Item does not exist' });
    }

    let trelloOrganization = null;
    try {
      const trelloOrgSnap = await integrationsModel.getTrelloOrganization(db);
      trelloOrganization = trelloOrgSnap.val() || {};
    } catch (err) {
      log.error(
        `${PREFIX} Trello Organization integration lookup failed | ${err}`
      );
    }

    // Lookup and sort for item's largest score value
    const [highestItemScore] = ITEM_VALUE_NAMES.map(name =>
      typeof inspectionItem[name] === 'number' ? inspectionItem[name] : 0
    ).sort((a, b) => b - a);

    let trelloPayload = null;
    try {
      const trelloCardPayload = {
        name: deficientItem.itemTitle, // source inspection item name
        desc: descriptionTemplate({
          createdAt: new Date(deficientItem.createdAt * 1000)
            .toGMTString()
            .split(' ')
            .slice(0, 4)
            .join(' '),
          itemScore: deficientItem.itemScore || 0,
          highestItemScore,
          itemInspectorNotes: deficientItem.itemInspectorNotes || '',
          currentPlanToFix: deficientItem.currentPlanToFix || '',
          sectionTitle: deficientItem.sectionTitle || '',
          sectionSubtitle: deficientItem.sectionSubtitle || '',
        }),
      };

      // Set members to authorized Trello account
      if (trelloOrganization.member) {
        trelloCardPayload.idMembers = trelloOrganization.member;
      }

      // Append current due date as date string
      if (deficientItem.currentDueDateDay) {
        trelloCardPayload.due = toISO8601(deficientItem.currentDueDateDay);
      }

      const trelloResponse = await got(
        `https://api.trello.com/1/cards?idList=${trelloPropertyConfig.openList}&keyFromSource=all&key=${trelloCredentials.apikey}&token=${trelloCredentials.authToken}`,
        {
          headers: { 'content-type': 'application/json' },
          body: trelloCardPayload,
          responseType: 'json',
          json: true,
        }
      );
      trelloPayload = trelloResponse && trelloResponse.body;
      if (!trelloPayload) throw Error('bad payload');
    } catch (err) {
      log.error(`${PREFIX} Error retrieved from Trello API: ${err}`);
      return res.status(err.statusCode || 500).send({
        message: 'Error from trello API',
      });
    }

    try {
      await systemModel.createPropertyTrelloCard(db, {
        property: propertyId,
        trelloCard: trelloPayload.id,
        deficientItem: deficientItemId,
        trelloCardURL: trelloPayload.shortUrl,
      });
    } catch (err) {
      log.error(`${PREFIX} Error persisting trello reference: ${err}`);
      return res.status(500).send({
        message: 'Trello card reference failed to save',
      });
    }

    res.status(201).send({
      message: 'successfully created trello card',
    });
  };

  // Create express app with single POST endpoint
  const app = express();
  app.use(cors());
  app.post(
    '/properties/:propertyId/deficient-items/:deficientItemId/trello/card',
    authUser(db, auth, true),
    handler
  );
  return app;
};
