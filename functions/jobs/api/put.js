const assert = require('assert');
const log = require('../../utils/logger');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate-update');
const canUpdateState = require('../utils/can-user-update-state');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-attr');
const create500ErrHandler = require('../../utils/unexpected-api-error');

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
    const update = body;
    const send500Error = create500ErrHandler(PREFIX, res);
    const hasUpdates = Boolean(Object.keys(update || {}).length);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Update job requested');

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing body`);
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

    // Lookup Firestore Property
    let property;
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

    // Lookup Firestore Jobs
    let job;
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

    // Lookup for associated bids
    const bids = [];
    try {
      const jobsReference = await jobsModel.createDocRef(fs, jobId);
      const bidsSnap = await jobsModel.findAssociatedBids(fs, jobsReference);
      bidsSnap.docs
        .filter(doc => Boolean(doc.data()))
        .forEach(doc => bids.push({ ...doc.data(), id: doc.id }));
    } catch (err) {
      return send500Error(err, 'bids lookup failed', 'unexpected error');
    }
    // Check if job state can be updated
    const updateStateStatus = update.state
      ? canUpdateState(update.state, job, bids, user)
      : true;

    if (!updateStateStatus) {
      log.error(
        `${PREFIX} user does not have the permission to transition to state: "${update.state}`
      );
      return res.status(403).send({
        errors: [
          {
            source: { pointer: 'state' },
            detail: `Forbidden: you do not have permission to update state to "${update.state}"`,
          },
        ],
      });
    }

    // Update job
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
