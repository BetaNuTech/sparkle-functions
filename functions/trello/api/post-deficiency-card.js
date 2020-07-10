const assert = require('assert');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const toISO8601 = require('../utils/date-to-iso-8601');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const inspectionsModel = require('../../models/inspections');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const config = require('../../config');

const PREFIX = 'trello: api: post-card:';
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

/**
 * Factory for creating POST request handler
 * that creates new Trello card for a deficiency
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {String} deficientItemUri - Source template for all DI URI's
 * @return {Function} - onRequest handler
 */
module.exports = function createOnTrelloDeficientItemCard(
  fs,
  deficientItemUri
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  // TODO: Move?
  assert(
    deficientItemUri && typeof deficientItemUri === 'string',
    'has deficient item URI template'
  );

  // Template all Card
  // descriptions come from
  const descriptionTemplate = hbs.compile(
    config.deficientItems.trelloCardDescriptionTemplate
  );
  const deficientItemUriTemplate = hbs.compile(deficientItemUri);

  /**
   * Create POST trello card for request handler
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, user } = req;
    const { deficiencyId } = params;

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Lookup Deficiency
    let deficiency = null;
    let propertyId = '';
    try {
      const deficiencySnap = await deficiencyModel.firestoreFindRecord(
        fs,
        deficiencyId
      );
      deficiency = deficiencySnap.data() || null;
      if (!deficiency) {
        throw Error(`deficiency: "${deficiencyId}" does not exist`);
      }
      propertyId = deficiency.property;
      if (!propertyId) {
        throw Error(
          `deficiency: "${deficiencyId}" has no "property" association`
        );
      }
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed | ${err}`);
      // TODO JSON-API
      return res.status(409).send({
        message: 'Requested property or deficient item could not be found',
      });
    }

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.firestoreFindRecord(
        fs,
        propertyId
      );
      property = propertySnap.data() || null;
      if (!property) throw Error(`property: "${propertyId}" does not exist`);
    } catch (err) {
      // TODO JSON-API
      return res.status(409).send({
        message: "Deficiency's property could not be found",
      });
    }

    // Lookup Trello credentials
    // TODO
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
    // TODO
    try {
      const trelloCardExists = await systemModel.isDeficientItemTrelloCardCreated(
        db,
        propertyId,
        deficiencyId
      );
      if (trelloCardExists) throw Error();
    } catch (err) {
      // TODO JSON-API
      return res
        .status(409)
        .send({ message: 'Deficient Item already has published Trello Card' });
    }

    // Lookup integration data
    // TODO
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
      // TODO JSON-API
      return res.status(409).send({
        message: 'Trello integration details for property not found or invalid',
      });
    }

    // Lookup Deficiency's Inspection
    // TODO
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
      // TODO JSON-API
      return res
        .status(409)
        .send({ message: 'Inspection of Deficient Item does not exist' });
    }

    // Lookup Trello public facing details
    // TODO
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
          url: deficientItemUriTemplate({ propertyId, deficiencyId }),
        }),
      };

      // Set members to authorized Trello account
      if (trelloOrganization.member) {
        trelloCardPayload.idMembers = trelloOrganization.member;
      }

      // Append any due date as date string
      if (
        deficientItem.currentDueDateDay ||
        deficientItem.currentDeferredDateDay
      ) {
        const dueDate =
          deficientItem.currentDueDateDay ||
          deficientItem.currentDeferredDateDay;
        trelloCardPayload.due = toISO8601(dueDate, property.zip);
      }

      // TODO move to service
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
      // TODO JSON-API
      return res.status(err.statusCode || 500).send({
        message: 'Error from trello API',
      });
    }

    try {
      // TODO
      await systemModel.createPropertyTrelloCard(db, {
        property: propertyId,
        trelloCard: trelloPayload.id,
        deficientItem: deficiencyId,
        trelloCardURL: trelloPayload.shortUrl,
      });
    } catch (err) {
      log.error(`${PREFIX} Error persisting trello reference: ${err}`);
      // TODO JSON-API
      return res.status(500).send({
        message: 'Trello card reference failed to save',
      });
    }

    // TODO JSON-API Deficiency Record
    res.status(201).send({
      message: 'successfully created trello card',
    });
  };
};
