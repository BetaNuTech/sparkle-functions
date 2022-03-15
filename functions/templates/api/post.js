const moment = require('moment');
const assert = require('assert');
const log = require('../../utils/logger');
const templatesModel = require('../../models/templates');
const createForkedTemplate = require('../utils/fork-template');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'templates: api: post:';

/**
 * Factory for creating a POST template endpoint
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function createPostTemplate(db) {
  assert(db && typeof db.collection === 'function', 'has firestore db');

  /**
   * Handle POST request for templates
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    let template = {}; // Write result
    const authorId = req.user ? req.user.id || '' : '';
    const send500Error = create500ErrHandler(PREFIX, res);

    // Optional clone template target
    const cloneTemplateId = req.query.clone || '';
    const isCloning = Boolean(cloneTemplateId);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info(
      `${cloneTemplateId ? '' : 'New '}Template ${
        cloneTemplateId ? 'clone' : 'creation'
      } requested${
        cloneTemplateId ? ` for template: "${cloneTemplateId}"` : ''
      }${authorId ? ` by "${authorId}"` : ''}`
    );

    // Lookup template to clone
    let cloneTarget = null;
    if (cloneTemplateId) {
      try {
        const templateSnap = await templatesModel.findRecord(
          db,
          cloneTemplateId
        );
        cloneTarget = templateSnap.data() || null;
        log.info(
          `${PREFIX} clone template target ${cloneTarget ? ' ' : 'not '} found`
        );
      } catch (err) {
        return send500Error(
          err,
          'clone template lookup failed',
          'unexpected error'
        );
      }
    }

    // Reject unfound clone template
    if (!cloneTarget && cloneTemplateId) {
      log.error(
        `${PREFIX} requested clone template target: "${cloneTemplateId}" does not exist`
      );
      return res.status(404).send({
        errors: [
          {
            title: 'Template clone target not found',
          },
        ],
      });
    }

    const nowDateString = moment().format('MM/DD/YY h:mm:ss a');

    if (!isCloning) {
      // Set default template to clone
      template = createDefaultTemplate();
      template.name = `New Template - ${nowDateString}`;
    } else {
      // Copy over clone target to payload
      template = createForkedTemplate(cloneTarget);
      template.name = `Copy: ${cloneTarget.name} - ${nowDateString}`;
    }

    // New template must have an
    // updated timestamp equal to
    // the creation timestamp
    const now = Math.round(Date.now() / 1000);
    template.createdAt = now;
    template.updatedAt = now;

    // Generate unique team ID
    const templateId = templatesModel.createId(db);

    try {
      await templatesModel.createRecord(db, templateId, template);
      log.info(`${PREFIX} template successfully written to database`);
    } catch (err) {
      return send500Error(err, 'template creation failed', 'unexpected error');
    }

    // Send newly created template
    res.status(201).send({
      data: {
        id: templateId,
        type: 'template',
        attributes: template,
      },
    });
  };
};

/**
 * Create a default template
 * with only required attributes
 * less created/updated timestamps
 * @return {Object}
 */
function createDefaultTemplate() {
  return {
    name: '',
    trackDeficientItems: false,
    requireDeficientItemNoteAndPhoto: false,
    items: {},
    sections: {},
  };
}
