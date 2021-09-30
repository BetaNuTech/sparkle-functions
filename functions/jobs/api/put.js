const assert = require('assert');
const log = require('../../utils/logger');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate-update');
const validateStateTransition = require('../utils/validate-state-transition');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-attr');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const {
  getAuthorizedRules,
  getMinBids,
} = require('../utils/job-authorization');

const PREFIX = 'jobs: api: put:';

/**
 * Factory for creating a PUT endpoint
 * to update a job
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
 */
module.exports = function createPutJob(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle PUT request for updating job
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { propertyId, jobId } = params;
    const { user } = req;
    const update = JSON.parse(JSON.stringify(body)); // clone
    const send500Error = create500ErrHandler(PREFIX, res);
    const hasUpdates = Boolean(Object.keys(update || {}).length);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Update job requested');

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing updates in payload`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'body missing update object',
            detail: 'Bad Request: job update body required',
          },
        ],
      });
    }

    // Check payload contains non-updatable attributes
    if (doesContainInvalidAttr(update)) {
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

    // Validate job atrributes
    const jobValidationErrors = validate({ ...update });
    const isValidUpdate = jobValidationErrors.length === 0;

    // Reject on invalid job update attributes
    if (!isValidUpdate) {
      log.error(`${PREFIX} bad request`);
      return res.status(400).send({
        errors: jobValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
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

    // Lookup Job
    let job = null;
    try {
      const jobSnap = await jobsModel.findRecord(fs, jobId);
      job = jobSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'job lookup failed', 'unexpected error');
    }

    // Reject when invalid job provided
    if (!job) {
      log.error(`${PREFIX} requested job: "${jobId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'job' },
            title: 'Job not found',
          },
        ],
      });
    }

    // Check user permission to update authorizedRules
    if (update.authorizedRules && !user.admin) {
      log.error(
        `${PREFIX} user does not have the permission to update authorized rules`
      );
      return res.status(403).send({
        errors: [
          {
            source: { pointer: 'authorizedRules' },
            detail:
              'Forbidden: you do not have permission to update authorized rules',
          },
        ],
      });
    }

    // Update changed authorized rules
    const currentAuthorizedRules =
      update.authorizedRules || job.authorizedRules;
    const updatedAuthorizedRules = getAuthorizedRules(
      currentAuthorizedRules,
      update.type || job.type
    );

    if (currentAuthorizedRules !== updatedAuthorizedRules) {
      update.authorizedRules = updatedAuthorizedRules;
    }

    // Update new min bids count
    const updatedMinBids = getMinBids(updatedAuthorizedRules);
    if (job.minBids !== updatedMinBids) {
      update.minBids = updatedMinBids;
    }

    // Lookup for associated bids
    const bids = [];
    try {
      const jobsReference = jobsModel.createDocRef(fs, jobId);
      const bidsSnap = await jobsModel.findAssociatedBids(fs, jobsReference);
      bidsSnap.docs
        .filter(doc => Boolean(doc.data()))
        .forEach(doc => bids.push({ ...doc.data(), id: doc.id }));
    } catch (err) {
      return send500Error(err, 'bids lookup failed', 'unexpected error');
    }

    // Check if job state can be updated
    const stateValidationErrors = update.state
      ? validateStateTransition(update.state, job, bids, user)
      : [];
    const hasStateValidationErrors = stateValidationErrors.length > 0;

    // Reject invalid state transition request
    if (hasStateValidationErrors) {
      const hasPermissionsError =
        stateValidationErrors
          .map(({ path }) => path)
          .join('')
          .search('admin') > -1;
      const statusCode = hasPermissionsError ? 403 : 400;
      const logErrMsg = hasPermissionsError
        ? `${PREFIX} user lacks permission to transition to state: "${update.state}"`
        : `${PREFIX} failed to transition to state: "${update.state}"`;
      log.error(logErrMsg);

      return res.status(statusCode).send({
        errors: stateValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Persist job udates
    try {
      await jobsModel.updateRecord(fs, jobId, update);
    } catch (err) {
      return send500Error(
        err,
        `failed to update job "${jobId}"`,
        'failed to persist updates'
      );
    }

    // Remove relationships
    // from attributes
    delete job.property;

    // Success response
    res.status(201).send({
      data: {
        id: jobId,
        type: 'job',
        attributes: { ...job, ...update },
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
