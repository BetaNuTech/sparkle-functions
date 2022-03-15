const assert = require('assert');
const log = require('../../utils/logger');
const { getFullName } = require('../../utils/user');
const templatesModel = require('../../models/templates');
const templateCategoriesModel = require('../../models/template-categories');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-attr');
const notifyTemplate = require('../../utils/src-notification-templates');
const notificationsModel = require('../../models/notifications');
const validate = require('../utils/validate-template-update');
const validateNewEntries = require('../utils/validate-template-new-entries');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const updateTemplate = require('../utils/update');

const PREFIX = 'templates: api: patch:';

/**
 * Factory for creating a PATCH template endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function createPatchTemplate(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request for templates
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {}, params } = req;
    const { templateId } = params;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const updates = JSON.parse(JSON.stringify(body)); // clone
    const hasUpdates = Boolean(Object.keys(updates || {}).length);
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Update template: "${templateId}" requested${
        authorId ? ` by "${authorId}"` : ''
      }`
    );

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing updates in payload`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: template update body required',
          },
        ],
      });
    }

    // Check payload contains non-updatable attributes
    if (doesContainInvalidAttr(updates)) {
      log.error(`${PREFIX} request contains invalid attributes`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Payload contains non updatable attributes',
            detail: 'Can not update non-updatable attributes',
          },
        ],
      });
    }

    const validationErrors = validate({ ...updates });
    const isValidUpdate = validationErrors.length === 0;

    // Reject on invalid update
    if (!isValidUpdate) {
      log.error(`${PREFIX} invalid template update attributes`);
      return res.status(400).send({
        errors: validationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Lookup template
    let template = null;
    try {
      const snapshot = await templatesModel.findRecord(db, templateId);
      template = snapshot.data() || null;
    } catch (err) {
      return send500Error(err, 'template lookup failed', 'unexpected error');
    }

    // Reject when template can't be found
    if (!template) {
      log.error(`${PREFIX} requested template: "${templateId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'template' },
            title: 'Template not found',
          },
        ],
      });
    }

    // Validate new entry configurations
    // for any new sections & items
    const newEntryValidationErrors = validateNewEntries(template, updates);
    const isValidNewEntryUpdate = newEntryValidationErrors.length === 0;

    // Reject on invalid update
    if (!isValidNewEntryUpdate) {
      log.error(`${PREFIX} invalid template new entry update attributes`);
      return res.status(400).send({
        errors: newEntryValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    let templateCategory = null;
    const templateCategoryId = updates.category || '';
    const hasCategoryUpdate = Boolean(templateCategoryId);

    // Lookup template category
    if (hasCategoryUpdate) {
      try {
        const snapshot = await templateCategoriesModel.findRecord(
          db,
          templateCategoryId
        );
        templateCategory = snapshot.data() || null;
      } catch (err) {
        return send500Error(
          err,
          'template category lookup failed',
          'unexpected error'
        );
      }
    }

    // Reject when referrenced template category can't be found
    if (hasCategoryUpdate && !templateCategory) {
      log.error(
        `${PREFIX} requested template category: "${templateCategoryId}" does not exist`
      );
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'category' },
            title: 'Template category not found',
          },
        ],
      });
    }

    // Calculate new template result
    const templateUpdates = updateTemplate(template, updates);
    const hasTemplateUpdates = Boolean(Object.keys(templateUpdates).length);
    const didTemplateBecomeComplete = Boolean(templateUpdates.completedAt);
    const wasTemplateAlreadyComplete = Boolean(template.completedAt);

    // Exit eairly if user updates
    // had no impact on template
    if (!hasTemplateUpdates) {
      log.info(`${PREFIX} update to template: "${templateId}" had no effect`);
      return res.status(204).send();
    }

    // Persist template updates
    try {
      await templatesModel.setRecord(
        db,
        templateId,
        templateUpdates,
        null,
        true
      );
    } catch (err) {
      return send500Error(err, 'template write failed', 'unexpected error');
    }

    log.info(`${PREFIX} successfully updated template: "${templateId}"`);

    // Send newly updated template
    res.status(201).send({
      data: {
        id: templateId,
        type: 'template',
        attributes: templateUpdates,
      },
    });

    // Silence notifications
    // in incognito mode
    if (incognitoMode) {
      return;
    }

    // Lookup template
    let updatedTemplate = null;
    try {
      const snapshot = await templatesModel.findRecord(db, templateId);
      updatedTemplate = snapshot.data() || null;
    } catch (err) {
      log.error(
        `${PREFIX} failed to lookup updated template for notifications: ${err}`
      );
      return;
    }

    const previousSectionsCount = Object.keys(template.sections || {}).length;
    const previousItemsCount = Object.keys(template.items || {}).length;
    const currentSectionsCount = Object.keys(updatedTemplate.sections || {})
      .length;
    const currentItemsCount = Object.keys(updatedTemplate.items || {}).length;

    if (didTemplateBecomeComplete) {
      const name = template.name || 'Untitled Template';
      const categoryName = hasCategoryUpdate ? templateCategory.name : '';

      try {
        await notificationsModel.addRecord(db, {
          title: 'Template Creation',
          summary: notifyTemplate('template-creation-summary', {
            name,
            authorName,
          }),
          markdownBody: notifyTemplate('template-creation-markdown-body', {
            name,
            description: template.description,
            category: categoryName,
            sectionsCount: currentSectionsCount,
            itemsCount: currentItemsCount,
            authorName,
            authorEmail,
          }),
          creator: authorId,
        });
      } catch (err) {
        log.error(
          `${PREFIX} failed to add creation source notification: ${err}`
        ); // proceed with error
      }
    } else if (wasTemplateAlreadyComplete) {
      const {
        name: previousName,
        description: previousDescription,
        category: previousCategory,
      } = template;
      const {
        name: currentName,
        description: currentDescription,
        category: currentCategory,
      } = updatedTemplate;
      try {
        await notificationsModel.addRecord(db, {
          title: 'Template Update',
          summary: notifyTemplate('template-update-summary', {
            name: currentName,
            authorName,
          }),
          markdownBody: notifyTemplate('template-update-markdown-body', {
            previousName,
            previousDescription,
            previousCategory,
            previousSectionsCount,
            previousItemsCount,
            currentName,
            currentDescription,
            currentCategory,
            currentSectionsCount,
            currentItemsCount,
            authorName,
            authorEmail,
          }),
        });
      } catch (err) {
        log.error(
          `${PREFIX} failed to create updated source notification: ${err}`
        ); // proceed with error
      }
    }
  };
};
