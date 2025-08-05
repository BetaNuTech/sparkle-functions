const assert = require('assert');
const hbs = require('handlebars');
const log = require('../../utils/logger');
const systemModel = require('../../models/system');
const deficiencyModel = require('../../models/deficient-items');
const inspectionsModel = require('../../models/inspections');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const clickup = require('../../services/clickup');
const config = require('../../config');
const { getBestStatusMatch } = require('../utils');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');

const PREFIX = 'clickup: api: post-deficiency-task:';
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;
const DEF_ITEM_URI = config.clientApps.web.deficientItemURL;

/**
 * Factory for creating POST request handler
 * that creates new ClickUp task for a deficiency
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {String} deficiencyUri
 * @return {Function} - onRequest handler
 */
module.exports = function createOnClickUpDeficientItemTask(
  db,
  deficiencyUri = DEF_ITEM_URI
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(
    deficiencyUri && typeof deficiencyUri === 'string',
    'has deficiency uri string'
  );

  // Template for task descriptions
  const descriptionTemplate = hbs.compile(
    config.clickup.deficientItemTaskDescriptionTemplate
  );
  const deficientItemUriTemplate = hbs.compile(deficiencyUri);

  /**
   * Create POST ClickUp task for deficient item handler
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, params, clickupCredentials } = req;
    const { deficiencyId = '' } = params;
    const send500Error = create500ErrHandler(PREFIX, res);
    
    assert(
      deficiencyId && typeof deficiencyId === 'string',
      'defined "deficiencyId" param in path'
    );
    assert(
      clickupCredentials && typeof clickupCredentials === 'object',
      'has ClickUp credentials in request'
    );
    assert(
      user && typeof user === 'object',
      'has user configuration in request'
    );

    // Is client requesting notifications
    const isNotifying = req.query.notify
      ? req.query.notify.search(/true/i) > -1
      : false;

    // Optional incognito mode query
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

    // Reject request to re-create a previously published ClickUp Task
    try {
      const clickupTaskId = await systemModel.findClickUpTaskId(
        db,
        propertyId,
        deficiencyId
      );
      if (clickupTaskId) {
        throw Error('ClickUp task already exists for deficiency');
      }
    } catch (err) {
      log.error(`${PREFIX} failed to find ClickUp task identifier: ${err}`);
      return res.status(409).send({
        errors: [
          {
            detail: 'Deficiency already has published ClickUp Task',
          },
        ],
      });
    }

    // Lookup ClickUp property integration data
    let clickupPropertyConfig = null;
    try {
      const clickupIntegrationSnap = await integrationsModel.findClickUpProperty(
        db,
        propertyId
      );

      clickupPropertyConfig = clickupIntegrationSnap.data() || null;

      if (!clickupPropertyConfig) {
        throw Error('ClickUp integration not configured for property');
      }
      if (!clickupPropertyConfig.deficienciesListId) {
        throw Error('ClickUp deficiencies list not configured for property');
      }
    } catch (err) {
      log.error(
        `${PREFIX} ClickUp integration details lookup failed | ${err}`
      );
      return res.status(409).send({
        errors: [
          {
            detail:
              'ClickUp integration details for property not found or invalid',
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

    // Get list details to find available statuses
    let listDetails = null;
    try {
      listDetails = await clickup.fetchList(
        clickupCredentials.apiToken,
        clickupPropertyConfig.deficienciesListId
      );
    } catch (err) {
      log.error(`${PREFIX} failed to fetch list details: ${err}`);
      return res.status(409).send({
        errors: [{ detail: 'Could not access ClickUp deficiencies list' }],
      });
    }

    // Find the best status match for the deficiency state
    const targetStatus = getBestStatusMatch(
      deficiency.state,
      listDetails.statuses || [],
      'deficiency'
    );

    // Lookup and sort for item's largest score value
    const [highestItemScore] = ITEM_VALUE_NAMES.map(name =>
      typeof inspectionItem[name] === 'number' ? inspectionItem[name] : 0
    ).sort((a, b) => b - a);

    // Build task payload
    const clickupTaskPayload = {
      name: deficiency.itemTitle, // source inspection item name
      description: descriptionTemplate({
        createdAt: new Date(deficiency.createdAt * 1000)
          .toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
        itemScore: deficiency.itemScore || 0,
        highestItemScore,
        itemInspectorNotes: deficiency.itemInspectorNotes || '',
        currentPlanToFix: deficiency.currentPlanToFix || '',
        sectionTitle: deficiency.sectionTitle || '',
        sectionSubtitle: deficiency.sectionSubtitle || '',
        currentResponsibilityGroup: deficiency.currentResponsibilityGroup || '',
        currentDueDateDay: deficiency.currentDueDateDay || '',
        propertyName: property.name || '',
        url: deficientItemUriTemplate({
          propertyId,
          deficientItemId: deficiencyId,
        }),
      }),
      status: targetStatus,
      priority: config.clickup.defaults.taskPriority,
      tags: [
        config.clickup.tags.deficientItem,
        config.clickup.tags.sparkle,
        config.clickup.tags.automated
      ],
      notify_all: false
    };

    // Set due date if available
    if (deficiency.currentDueDateDay && deficiency.currentDueDateDay !== 'N/A') {
      try {
        const dueDate = new Date(deficiency.currentDueDateDay + 'T23:59:59');
        clickupTaskPayload.due_date = dueDate.getTime();
        clickupTaskPayload.due_date_time = true;
      } catch (err) {
        log.error(`${PREFIX} failed to parse due date: ${err}`);
        // Continue without due date
      }
    }

    // Create the ClickUp task
    let clickupTask = null;
    try {
      clickupTask = await clickup.createTask(
        clickupCredentials.apiToken,
        clickupPropertyConfig.deficienciesListId,
        clickupTaskPayload
      );
    } catch (err) {
      log.error(`${PREFIX} ClickUp task creation failed: ${err}`);
      return send500Error(
        err,
        'ClickUp task creation failed',
        'Failed to create ClickUp task'
      );
    }

    const batch = db.batch();

    // Store ClickUp task reference in system
    try {
      await systemModel.upsertPropertyClickUp(
        db,
        propertyId,
        {
          tasks: {
            [clickupTask.id]: deficiencyId
          }
        },
        batch
      );
    } catch (err) {
      log.error(`${PREFIX} failed to store ClickUp task reference: ${err}`);
      return send500Error(
        err,
        'Failed to store task reference',
        'Database error'
      );
    }

    // Update deficiency with ClickUp task URL
    const clickupTaskURL = `https://app.clickup.com/t/${clickupTask.id}`;
    try {
      const deficiencyDoc = db.collection(config.deficientItems.collection).doc(deficiencyId);
      batch.update(deficiencyDoc, {
        clickupTaskURL,
        updatedAt: Math.round(Date.now() / 1000)
      });
    } catch (err) {
      log.error(`${PREFIX} failed to update deficiency with task URL: ${err}`);
      return send500Error(
        err,
        'Failed to update deficiency',
        'Database error'
      );
    }

    // Commit all database changes
    try {
      await batch.commit();
    } catch (err) {
      log.error(`${PREFIX} failed to commit database updates: ${err}`);
      return send500Error(
        err,
        'Database commit failed',
        'Database error'
      );
    }

    // Return success response
    res.status(201).send({
      data: {
        id: clickupTask.id,
        type: 'clickup-task',
        attributes: {
          name: clickupTask.name,
          status: (clickupTask.status && clickupTask.status.status) || targetStatus,
          url: clickupTaskURL,
          list: {
            id: clickupPropertyConfig.deficienciesListId,
            name: clickupPropertyConfig.deficienciesListName
          },
          space: {
            id: clickupPropertyConfig.spaceId,
            name: clickupPropertyConfig.spaceName
          }
        },
        relationships: {
          deficiency: {
            data: { id: deficiencyId, type: 'deficient-item' }
          },
          property: {
            data: { id: propertyId, type: 'property' }
          }
        }
      }
    });

    // Send notifications if requested and not in incognito mode
    if (isNotifying && !incognitoMode) {
      try {
        await notificationsModel.addRecord(db, {
          title: 'ClickUp Task Created',
          summary: notifyTemplate('deficient-item-clickup-task-create-summary', {
            title: deficiency.itemTitle,
            authorName: getFullName(user),
          }),
          markdownBody: notifyTemplate(
            'deficient-item-clickup-task-create-markdown-body',
            {
              title: deficiency.itemTitle,
              section: deficiency.sectionTitle,
              subSection: deficiency.sectionSubtitle,
              clickupTaskURL,
            }
          ),
          creator: user.id,
          property: propertyId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create notification: ${err}`);
        // Continue - notification failure shouldn't break the response
      }
    }
  };
};