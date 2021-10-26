const assert = require('assert');
const log = require('../../utils/logger');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate');
const config = require('../../config');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const {
  getMinBids,
  getAuthorizedRules,
} = require('../utils/job-authorization');

const PREFIX = 'jobs: api: post:';
const INITIAL_STATE = config.jobs.stateTypes[0];
const DEFAULT_AUTH_RULES = config.jobs.authorizedRuleTypes[0];

/**
 * Factory for creating a POST job endpoint
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @return {Function} - onRequest handler
 */

module.exports = function createPostJob(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle POST request for creating
   * a property's Job
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { propertyId } = params;
    const send500Error = create500ErrHandler(PREFIX, res);
    const badReqPayload = { errors: [] };

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create job requested');

    // Create errors for missing required attributes
    Object.entries({ title: body.title, type: body.type })
      .filter(([, value]) => !value)
      .forEach(([name]) => {
        badReqPayload.errors.push({
          source: { pointer: name },
          title: `body missing "${name}" identifier`,
          detail: `${name} is required`,
        });
      });

    // Send bad request error
    if (badReqPayload.errors.length) {
      log.error(`${PREFIX} invalid user request`);
      return res.status(400).send(badReqPayload);
    }

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(fs, propertyId);
      property = propertySnap.data() || null;
    } catch (err) {
      return send500Error(err, 'property lookup failed', 'unexpected error');
    }

    // Invalid property
    if (!property) {
      log.error(`${PREFIX} requested property: "${propertyId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'property' },
            title: 'Property not found',
          },
        ],
      });
    }

    // Create Job object
    const now = Math.round(Date.now() / 1000);
    const job = {
      ...body,
      state: INITIAL_STATE,
      createdAt: now,
      updatedAt: now,
    };

    // Set authorized rules
    const currentAuthorizedRules = body.authorizedRules || DEFAULT_AUTH_RULES;
    job.authorizedRules = getAuthorizedRules(currentAuthorizedRules, job.type);

    // Set minimum bids value
    job.minBids = getMinBids(job.authorizedRules);

    // Validate job atrributes
    const jobValidationErrors = validate(job);
    const isValidJob = jobValidationErrors.length === 0;

    // Reject on missing job attributes
    if (!isValidJob) {
      return res.status(400).send({
        errors: jobValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Generate Job ID
    const jobId = jobsModel.createId(fs);

    // Add property relationship
    job.property = propertiesModel.createDocRef(fs, propertyId);

    // Persist new job
    try {
      await jobsModel.createRecord(fs, jobId, job);
    } catch (err) {
      return send500Error(err, 'job creation failed', err.message);
    }

    // Remove relationships
    // from attributes
    delete job.property;

    // Send newly created job
    res.status(201).send({
      data: {
        id: jobId,
        type: 'job',
        attributes: job,
        relationships: {
          property: {
            data: {
              id: propertyId,
              type: 'property',
            },
          },
        },
      },
    });
  };
};
