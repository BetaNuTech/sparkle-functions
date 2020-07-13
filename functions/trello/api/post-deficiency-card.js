const assert = require('assert');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const toISO8601 = require('../utils/date-to-iso-8601');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const inspectionsModel = require('../../models/inspections');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const trello = require('../../services/trello');
const config = require('../../config');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'trello: api: post-card:';
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;
const DEF_ITEM_URI = config.clientApps.web.deficientItemURL;

/**
 * Factory for creating POST request handler
 * that creates new Trello card for a deficiency
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {String} deficiencyUri
 * @return {Function} - onRequest handler
 */
module.exports = function createOnTrelloDeficientItemCard(
  fs,
  deficiencyUri = DEF_ITEM_URI
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(
    deficiencyUri && typeof deficiencyUri === 'string',
    'has deficiency uri string'
  );

  // Template all Card
  // descriptions come from
  const descriptionTemplate = hbs.compile(
    config.deficientItems.trelloCardDescriptionTemplate
  );
  const deficientItemUriTemplate = hbs.compile(deficiencyUri);

  /**
   * Create POST trello card for request handler
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, params, trelloCredentials } = req;
    const { deficiencyId = '' } = params;
    const send500Error = create500ErrHandler(PREFIX, res);
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'defined "deficiencyId" param in path'
    );
    assert(
      trelloCredentials && typeof trelloCredentials === 'object',
      'has trello credentials in request'
    );
    assert(
      user && typeof user === 'object',
      'has user configuration in request'
    );

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

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
      return res.status(409).send({
        errors: [
          {
            detail: 'Requested property or deficiency could not be found',
          },
        ],
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
      log.error(`${PREFIX} property lookup failed | ${err}`);
      return res.status(409).send({
        errors: [
          {
            detail: "Deficiency's property could not be found",
          },
        ],
      });
    }

    // Reject request to re-create a
    // previously published Trello Card
    try {
      const trelloCardId = await systemModel.firestoreFindTrelloCardId(
        fs,
        propertyId,
        deficiencyId
      );
      if (trelloCardId) {
        throw Error('trello card already exists for deficiency');
      }
    } catch (err) {
      log.error(`${PREFIX} | ${err}`);
      return res.status(409).send({
        errors: [
          {
            detail: 'Deficiency already has published Trello Card',
          },
        ],
      });
    }

    // Lookup public integration data
    let trelloPropertyConfig = null;
    try {
      const trelloIntegrationSnap = await integrationsModel.firestoreFindTrelloProperty(
        fs,
        propertyId
      );

      trelloPropertyConfig = trelloIntegrationSnap.data() || null;

      if (!trelloPropertyConfig) {
        throw Error('public Trello integration not recorded');
      }
      if (!trelloPropertyConfig.openList) {
        throw Error('public Trello integration open list not set');
      }
    } catch (err) {
      log.error(
        `${PREFIX} public trello integration details lookup failed | ${err}`
      );
      return res.status(409).send({
        errors: [
          {
            detail:
              'Trello integration details for property not found or invalid',
          },
        ],
      });
    }

    // Lookup Deficiency's Inspection
    let inspectionItem = null;
    try {
      const inspectionSnap = await inspectionsModel.firestoreFindRecord(
        fs,
        deficiency.inspection
      );
      const inspection = inspectionSnap.data() || null;

      if (
        !inspection ||
        !inspection.template ||
        typeof inspection.template.items !== 'object'
      ) {
        throw Error("deficiency's inspection could not be found");
      }
      inspectionItem = inspection.template.items[deficiency.item] || null;
      if (!inspectionItem) {
        throw Error("deficiency's inspection item could not be found");
      }
    } catch (err) {
      log.error(`${PREFIX} inspection item lookup failed | ${err}`);
      return res.status(409).send({
        errors: [{ detail: 'Inspection of Deficiency does not exist' }],
      });
    }

    // Lookup Trello public facing details
    let trelloOrganization = null;
    try {
      const trelloOrgSnap = await integrationsModel.firestoreFindTrello(fs);
      trelloOrganization = trelloOrgSnap.data() || {};
    } catch (err) {
      // Allow failure
      log.error(
        `${PREFIX} Trello Organization integration lookup failed | ${err}`
      );
    }

    // Lookup and sort for item's largest score value
    const [highestItemScore] = ITEM_VALUE_NAMES.map(name =>
      typeof inspectionItem[name] === 'number' ? inspectionItem[name] : 0
    ).sort((a, b) => b - a);

    const trelloCardPayload = {
      name: deficiency.itemTitle, // source inspection item name
      desc: descriptionTemplate({
        createdAt: new Date(deficiency.createdAt * 1000)
          .toGMTString()
          .split(' ')
          .slice(0, 4)
          .join(' '),
        itemScore: deficiency.itemScore || 0,
        highestItemScore,
        itemInspectorNotes: deficiency.itemInspectorNotes || '',
        currentPlanToFix: deficiency.currentPlanToFix || '',
        sectionTitle: deficiency.sectionTitle || '',
        sectionSubtitle: deficiency.sectionSubtitle || '',
        url: deficientItemUriTemplate({
          propertyId,
          deficientItemId: deficiencyId,
        }),
      }),
    };

    // Set members to authorized Trello account
    if (trelloOrganization.member) {
      trelloCardPayload.idMembers = trelloOrganization.member;
    }

    // Append any due date as date string
    if (deficiency.currentDueDateDay || deficiency.currentDeferredDateDay) {
      const dueDate =
        deficiency.currentDueDateDay || deficiency.currentDeferredDateDay;
      trelloCardPayload.due = toISO8601(dueDate, property.zip);
    }

    // Publish Card to Trello API
    let cardId = '';
    let cardUrl = '';
    try {
      const trelloResponse = await trello.publishListCard(
        trelloPropertyConfig.openList,
        trelloCredentials.apikey,
        trelloCredentials.authToken,
        trelloCardPayload
      );
      cardId = trelloResponse.id;
      cardUrl = trelloResponse.shortUrl;
    } catch (err) {
      return send500Error(
        err,
        `Error retrieved from Trello API | ${err}`,
        'Error from trello API'
      );
    }

    const batch = fs.batch();

    // Update system trello/property cards
    try {
      await systemModel.firestoreUpsertPropertyTrello(
        fs,
        propertyId,
        { cards: { [cardId]: deficiencyId } },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `failed to update system trello property | ${err}`,
        'Trello card reference failed to save'
      );
    }

    // Update deficiency trello card url
    try {
      await deficiencyModel.firestoreUpdateRecord(
        fs,
        deficiencyId,
        {
          updatedAt: Math.round(Date.now() / 1000),
          trelloCardURL: cardUrl,
        },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `failed to update deficiency trello card | ${err}`,
        'Deficiency failed to save'
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `failed to commit database writes | ${err}`,
        'System error'
      );
    }

    // Success
    res.status(201).send({
      data: {
        id: cardId,
        type: 'trello-card',
        data: { shortUrl: cardUrl },
      },
      relationships: {
        deficiency: {
          id: deficiencyId,
          type: 'deficiency',
        },
      },
    });
  };
};
