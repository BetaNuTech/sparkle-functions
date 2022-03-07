const assert = require('assert');
const log = require('../../utils/logger');
const strings = require('../../utils/strings');
const templateCategoriesModel = require('../../models/template-categories');
const notificationsModel = require('../../models/notifications');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'template-categories: api: patch:';

/**
 * Factory for creating a PATCH template category endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */
module.exports = function updateTemplateCategory(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle PATCH request
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { body = {}, params } = req;
    const { templateCategoryId } = params;
    const authorId = req.user ? req.user.id || '' : '';
    const authorName = getFullName(req.user || {});
    const authorEmail = req.user ? req.user.email : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `Update template category requested${authorId ? ` by "${authorId}"` : ''}`
    );

    // Optional incognito mode query
    // defaults to false
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;
    const hasValidRequest = body && body.name && typeof body.name === 'string';

    // Send bad request error
    if (!hasValidRequest) {
      log.error(`${PREFIX} invalid template category request`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is required',
            detail: 'body missing "name" attribute',
          },
        ],
      });
    }

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

    // Titlized updated template category name
    let isCatNameAvailable = false;
    const categoryName = strings.toCapitalize(body.name);
    const previousName = `${templateCategory.name}`;

    try {
      const categoriesWithName = await templateCategoriesModel.query(db, {
        name: ['==', categoryName],
      });
      isCatNameAvailable = categoriesWithName.size === 0;
    } catch (err) {
      return send500Error(
        err,
        'template category name query failed',
        'unexpected error'
      );
    }

    if (!isCatNameAvailable) {
      log.error(
        `${PREFIX} request to update template category with existing name: "${categoryName}"`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'name' },
            title: 'name is taken',
            detail: `Template Category name "${categoryName}" is already taken, please choose another`,
          },
        ],
      });
    }

    try {
      await templateCategoriesModel.updateRecord(db, templateCategoryId, {
        name: categoryName,
      });
    } catch (err) {
      return send500Error(
        err,
        'template category update failed',
        'unexpected error'
      );
    }

    log.info(
      `${PREFIX} successfully updated template category: "${templateCategoryId}"`
    );

    // Send updated
    // template category
    res.status(201).send({
      data: {
        id: templateCategoryId,
        type: 'template-category',
        attributes: {
          name: categoryName,
        },
      },
    });

    if (!incognitoMode) {
      log.info(
        `${PREFIX} sending global notifications for template category update`
      );
      try {
        // Notify of updated template category
        await notificationsModel.addRecord(db, {
          title: 'Template Category Update',
          summary: notifyTemplate('template-category-update-summary', {
            name: categoryName,
            previousName,
            authorName,
          }),
          markdownBody: notifyTemplate(
            'template-category-update-markdown-body',
            {
              name: categoryName,
              previousName,
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
  };
};
