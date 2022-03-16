const assert = require('assert');
const log = require('../../utils/logger');
const templatesModel = require('../../models/templates');
const templateCategoriesModel = require('../../models/template-categories');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'template-categories: api: delete:';

/**
 * Factory for creating a DELETE endpoint
 * that delete's a Firebase template categories
 * and cleanup all associations with properties & users
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
    const { templateCategoryId } = params;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Delete template category "${templateCategoryId}" requested${
        authorId ? ` by "${authorId}"` : ''
      }`
    );

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    // Lookup template category
    let templateCategory = null;
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

    // Reject when template category can't be found
    if (!templateCategory) {
      log.error(
        `${PREFIX} requested template category: "${templateCategoryId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'template-category' },
            title: 'Template category not found',
          },
        ],
      });
    }

    try {
      await db.runTransaction(async transaction => {
        // Lookup template's associated with category
        const templatesOfCategoryIds = [];
        try {
          const snapshot = await templatesModel.query(
            db,
            {
              category: ['==', templateCategoryId],
            },
            transaction
          );
          templatesOfCategoryIds.push(...snapshot.docs.map(({ id }) => id));
        } catch (err) {
          throw Error(
            `failed to lookup templates associated with template category: ${err}`
          );
        }

        log.info(
          `${PREFIX} found ${templatesOfCategoryIds.length} template(s) to disassociate from category`
        );

        // Add template category delete to batch
        try {
          await templateCategoriesModel.deleteRecord(
            db,
            templateCategoryId,
            transaction
          );
        } catch (err) {
          throw Error(`template category removal failed: ${err}`);
        }

        // Cleanup template category's templates
        if (templatesOfCategoryIds.length) {
          try {
            await templatesModel.batchRemoveCategory(
              db,
              templatesOfCategoryIds,
              transaction
            );
          } catch (err) {
            throw Error(
              `error removing template category from templates: ${err}`
            );
          }
        }
      });
    } catch (err) {
      return send500Error(
        err,
        'team delete and association cleanup transaction failed',
        'unexpected error'
      );
    }

    if (!incognitoMode) {
      try {
        // Notify of the deleted template
        await notificationsModel.addRecord(db, {
          title: 'Template Deletion',
          summary: notifyTemplate('template-category-delete-summary', {
            name: templateCategory.name,
            authorName,
          }),
          markdownBody: notifyTemplate(
            'template-category-delete-markdown-body',
            {
              name: templateCategory.name,
              authorName,
              authorEmail,
            }
          ),
          creator: authorId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create source notification: ${err}`); // proceed with error
      }
    }

    // Successful delete
    res.status(204).send();
  };
};
