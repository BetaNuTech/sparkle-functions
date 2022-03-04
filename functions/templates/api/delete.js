const assert = require('assert');
const log = require('../../utils/logger');
const templatesModel = require('../../models/templates');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'templates: api: delete:';

/**
 * Factory for creating a DELETE endpoint
 * that removes a template and cleans up
 * all associationed properties
 * @param {admin.firestore} db
 * @return {Function} - onRequest handler
 */
module.exports = function createDelete(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle DELETE request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params } = req;
    const { templateId } = params;
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(`Delete template: "${templateId}" requested`);

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Lookup template
    let template = null;
    try {
      const templateSnap = await templatesModel.findRecord(db, templateId);
      template = templateSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'template lookup failed', 'unexpected error');
    }

    // Reject when team can't be found
    if (!template) {
      log.error(`${PREFIX} requested template: "${templateId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'team' },
            title: 'Template not found',
          },
        ],
      });
    }

    try {
      await db.runTransaction(async transaction => {
        // Lookup team's properties
        const propertiesOfTemplateIds = [];
        try {
          const propertiesOfTemplateSnap = await propertiesModel.query(
            db,
            {
              [`templates.${templateId}`]: ['==', true],
            },
            transaction
          );
          propertiesOfTemplateIds.push(
            ...propertiesOfTemplateSnap.docs.map(({ id }) => id)
          );
        } catch (err) {
          throw Error(
            `failed to lookup properties associated with template: ${err}`
          );
        }

        // Add team delete to batch
        try {
          await templatesModel.removeRecord(db, templateId, transaction);
        } catch (err) {
          throw Error(`template removal failed: ${err}`);
        }

        // Cleanup template's properties
        if (propertiesOfTemplateIds.length) {
          try {
            await propertiesModel.batchRemoveTemplate(
              db,
              propertiesOfTemplateIds,
              templateId,
              transaction
            );
          } catch (err) {
            throw Error(`error removing template from properties: ${err}`);
          }
        }
      });
    } catch (err) {
      return send500Error(
        err,
        'template delete and association cleanup transaction failed',
        'unexpected error'
      );
    }

    // Successful delete
    res.status(204).send();

    if (!incognitoMode) {
      const templateName = template.name || 'Untitled Template';

      try {
        // Send success global notification
        await notificationsModel.addRecord(db, {
          title: 'Template Deletion',
          summary: notifyTemplate('template-delete-summary', {
            name: templateName,
            authorName,
          }),
          markdownBody: notifyTemplate('template-delete-markdown-body', {
            name: templateName,
            authorName,
            authorEmail,
          }),
          creator: req.user ? req.user.id || '' : '',
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }
  };
};
