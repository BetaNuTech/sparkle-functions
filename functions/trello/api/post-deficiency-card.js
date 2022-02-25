const assert = require('assert');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const toISO8601 = require('../utils/date-to-iso-8601');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const inspectionsModel = require('../../models/inspections');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const trello = require('../../services/trello');
const config = require('../../config');
const { getItemPhotoData } = require('../../utils/inspection');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');

const PREFIX = 'trello: api: post-card:';
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;
const DEF_ITEM_URI = config.clientApps.web.deficientItemURL;

/**
 * Factory for creating POST request handler
 * that creates new Trello card for a deficiency
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {String} deficiencyUri
 * @return {Function} - onRequest handler
 */
module.exports = function createOnTrelloDeficientItemCard(
  db,
  deficiencyUri = DEF_ITEM_URI
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
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

    // Is client requesting notifications
    // for their requested updates
    const isNotifying = req.query.notify
      ? req.query.notify.search(/true/i) > -1
      : false;

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Lookup Deficiency
    let deficiency = null;
    let propertyId = '';
    try {
      const deficiencySnap = await deficiencyModel.findRecord(db, deficiencyId);
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
      deficiency.id = deficiencyId;
    } catch (err) {
      log.error(`${PREFIX} deficiency lookup failed: ${err}`);
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
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
      if (!property) throw Error(`property: "${propertyId}" does not exist`);
      property.id = propertyId;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed: ${err}`);
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
      const trelloCardId = await systemModel.findTrelloCardId(
        db,
        propertyId,
        deficiencyId
      );
      if (trelloCardId) {
        throw Error('trello card already exists for deficiency');
      }
    } catch (err) {
      log.error(`${PREFIX} failed to find trello card identifier: ${err}`);
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
      const trelloIntegrationSnap = await integrationsModel.findTrelloProperty(
        db,
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
      const inspectionSnap = await inspectionsModel.findRecord(
        db,
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
      const trelloOrgSnap = await integrationsModel.findTrello(db);
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
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        trelloCardPayload
      );
      cardId = trelloResponse.id;
      cardUrl = trelloResponse.shortUrl;
    } catch (err) {
      return send500Error(
        err,
        `Error retrieved from Trello API: ${err}`,
        'Error from trello API'
      );
    }

    // Publish inspection item's
    const inspItemPhotos = getItemPhotoData(inspectionItem);
    const inspItemPhotoUrls = inspItemPhotos.map(({ url }) => url);

    // POST attachment(s) to Deficiency's Trello Card
    let attachmentIds = [];
    try {
      attachmentIds = await trello.publishAllCardAttachments(
        cardId,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        inspItemPhotoUrls
      );

      if (attachmentIds.length !== inspItemPhotoUrls.length) {
        throw Error('did not publish all inspection item  photos');
      }
    } catch (err) {
      // Continue after failure
      log.error(
        `${PREFIX} failed to publish all inspection item photos: ${err}`
      );
    }

    const batch = db.batch();

    // Update system trello/property cards
    try {
      await systemModel.upsertPropertyTrello(
        db,
        propertyId,
        { cards: { [cardId]: deficiencyId } },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        `failed to update system trello property: ${err}`,
        'Trello card reference failed to save'
      );
    }

    // Update deficiency trello card url
    try {
      const update = {
        updatedAt: Math.round(Date.now() / 1000),
        trelloCardURL: cardUrl,
      };
      await deficiencyModel.updateRecord(db, deficiencyId, update, batch);

      // Keep deficiency up to date for
      // any requested notification
      Object.assign(deficiency, update);
    } catch (err) {
      return send500Error(
        err,
        `failed to update deficiency trello card: ${err}`,
        'Deficiency failed to save'
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        `failed to commit database writes: ${err}`,
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

    // Client did not request any global
    // notifications for update
    if (!isNotifying || incognitoMode) {
      return;
    }

    log.info(`${PREFIX} sending Trello Card create notification`);

    try {
      await notificationsModel.addRecord(
        db,
        createNotificationConfig(user, property, deficiency)
      );
    } catch (err) {
      log.error(`${PREFIX} failed to add notification: ${err}`);
    }
  };
};

/**
 * Create Global Notification for creation
 * of Deficient Item Trello card
 * @param  {Object} user
 * @param  {Object} property
 * @param  {Object} deficientItem
 * @return {Object} - trello card notification config
 */
function createNotificationConfig(user, property, deficientItem) {
  assert(
    `${PREFIX} createNotificationConfig: has user`,
    user && typeof user === 'object'
  );
  assert(
    `${PREFIX} createNotificationConfig: has property`,
    property && typeof property === 'object'
  );
  assert(
    `${PREFIX} createNotificationConfig: has deficiency`,
    deficientItem && typeof deficientItem === 'object'
  );

  // Create Global Notification
  const propertyName = property.name;
  const title = deficientItem.itemTitle || 'Unknown Item';
  const section = deficientItem.sectionTitle || '';
  const subSection = deficientItem.sectionSubtitle || '';
  const trelloCardURL = deficientItem.trelloCardURL || 'google.com';
  const authorName = getFullName(user) || 'Unknown User';
  const authorEmail = user.email || 'Missing Email';
  const authorId = user.id;

  const result = {
    title: propertyName,
    summary: notifyTemplate('deficient-item-trello-card-create-summary', {
      title,
      authorName,
    }),
    markdownBody: notifyTemplate(
      'deficient-item-trello-card-create-markdown-body',
      {
        title,
        section,
        subSection,
        trelloCardURL,
        authorName,
        authorEmail,
      }
    ),
    property: property.id,
  };

  if (authorId) {
    result.creator = authorId;
  }

  return result;
}
