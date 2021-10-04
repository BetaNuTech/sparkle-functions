const assert = require('assert');
const log = require('../../utils/logger');
const bidsModel = require('../../models/bids');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate-bid');
const config = require('../../config');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'jobs: api: post bid:';
const now = Math.round(Date.now() / 1000);

/**
 * Factory for creating a POST endpoint
 * that creates Firestore bid
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
 */
module.exports = function createPostJobsBid(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle POST request for creating job's bid
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { propertyId, jobId } = params;
    const bid = body;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info("Create job's bid requested");

    // Validate bid atrributes
    const bidValidationErrors = validate(bid);
    const isValidBid = bidValidationErrors.length === 0;

    // Send bad request error
    if (!isValidBid) {
      log.error(`${PREFIX} invalid bid request`);
      return res.status(400).send({
        errors: bidValidationErrors.map(({ message, path }) => ({
          source: { pointer: path },
          detail: message,
        })),
      });
    }

    // Lookup Firestore Property
    let property;
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

    // Lookup Job
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

    // Set fixed price bid
    if (bid.costMax && !bid.costMin) {
      bid.costMin = Math.ceil(bid.costMax * 100) / 100;
    }

    if (bid.costMin && !bid.costMax) {
      bid.costMax = Math.ceil(bid.costMin * 100) / 100;
    }

    // Creare bid object
    const newBid = {
      ...bid,
      state: config.bids.stateTypes[0],
      job: jobsModel.createDocRef(fs, jobId),
      createdAt: now,
      updatedAt: now,
    };

    // Generate bid ID
    const bidId = bidsModel.createId(fs);

    // create firestore record
    try {
      await bidsModel.createRecord(fs, bidId, newBid);
    } catch (err) {
      return send500Error(err, 'bid creation failed', err.message);
    }

    // Remove relationships
    // from attributes
    delete newBid.job;

    // Send newly created bid
    res.status(201).send({
      data: {
        id: bidId,
        type: 'bid',
        attributes: newBid,
        relationships: {
          job: {
            data: {
              id: jobId,
              type: 'job',
            },
          },
        },
      },
    });
  };
};
