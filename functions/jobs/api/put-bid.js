const assert = require('assert');
const bidsModel = require('../../models/bids');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const validate = require('../utils/validate-bid');
const canUpdateState = require('../utils/can-user-update-bid-state');
const doesContainInvalidAttr = require('../utils/does-contain-invalid-bid-update-attr');
const log = require('../../utils/logger');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'jobs: api: put bid:';
const REQ_TO_APPROVE = ['costMin', 'costMax', 'startedAt', 'completedAt'];

/**
 * Factory for creating a PUT endpoint
 * that updates Firestore bid
 * @param  {admin.firestore} fs
 * @return {Function} - Express middleware
 */
module.exports = function createPutJobsBid(fs) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');

  /**
   * Handle PUT request for updating job's bid
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, body = {} } = req;
    const { propertyId, jobId, bidId } = params;
    const update = body;
    const send500Error = create500ErrHandler(PREFIX, res);
    const hasUpdates = Boolean(Object.keys(update || {}).length);
    const isUpdatingToApproved = update ? update.state === 'approved' : false;

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');

    log.info("Update job's bid requested");

    // Reject missing update request JSON
    if (!hasUpdates) {
      log.error(`${PREFIX} missing update body`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Body missing update object',
            detail: 'Bad Request: bid update body required',
          },
        ],
      });
    }

    // Validate bid atrributes
    const updateAttrs = Object.keys(update);
    const validationErrors = validate({ ...update });
    const updateValidationErrors = validationErrors.filter(
      validationErr => updateAttrs.includes(validationErr.path) // collect only update errors
    );
    const isValidUpdate = updateValidationErrors.length === 0;

    // Reject on invalid bid update
    if (!isValidUpdate) {
      log.error(`${PREFIX} invalid bid update attributes`);
      return res.status(400).send({
        errors: updateValidationErrors.map(({ message, path }) => ({
          detail: message,
          source: { pointer: path },
        })),
      });
    }

    // Check payload contains non-updatable attributes
    if (doesContainInvalidAttr(update)) {
      log.error(`${PREFIX} body contains non-updatable attributes`);
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Body contains non-updatable attributes',
            detail: 'Can not update non-updatable attributes',
          },
        ],
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

    // Lookup Firestore Job
    let job;
    try {
      const jobSnap = await jobsModel.findRecord(fs, jobId);
      job = jobSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'job lookup failed', err);
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

    // Bid lookup
    let bid;
    try {
      const bidSnap = await bidsModel.findRecord(fs, bidId);
      bid = bidSnap.data() || null;
    } catch (err) {
      return send500Error(err, 'bid lookup failed', 'unexpected error');
    }

    // Reject when invalid bid provided
    if (!bid) {
      log.error(`${PREFIX} requested bid: "${bidId}" does not exist`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'bid' },
            title: 'Bid not found',
          },
        ],
      });
    }

    // Check if the bid's job already has an approved bid
    let areOtherApprovedBids = false;
    if (isUpdatingToApproved) {
      try {
        const approvedBidsSnap = await bidsModel.queryJobsApproved(
          fs,
          bid.job.id
        );
        areOtherApprovedBids = approvedBidsSnap.size > 0;
      } catch (err) {
        return send500Error(
          err,
          'unexpected error',
          'approved bids lookup failed'
        );
      }
    }

    // Reject when job already has an approved bid
    if (isUpdatingToApproved && areOtherApprovedBids) {
      return res.status(400).send({
        errors: [
          {
            source: { pointer: 'body' },
            title: 'Job already has approved bids',
            detail: 'Unapprove another bid first',
          },
        ],
      });
    }

    // Validate state update
    const isBidOpen = bid.state === 'open';
    const updatedBid = { ...bid, ...update };
    updatedBid.state = bid.state;
    const canBidTransitionToUpdate = canUpdateState(update, updatedBid);

    // Reject open bid that doesn't have required
    // attributes to progress to approved status
    if (isBidOpen && isUpdatingToApproved && !canBidTransitionToUpdate) {
      const missingAttrs = REQ_TO_APPROVE.filter(
        attr => Boolean(updatedBid[attr]) === false
      );
      return res.status(409).send({
        errors: missingAttrs.map(pointer => ({
          detail: 'Required to approve bid',
          source: { pointer },
        })),
      });
    }

    // Update batch
    const batch = fs.batch();
    const isJobAuthorized = job.state === 'authorized';
    const isUpdatingToIncomplete = update.state === 'incomplete';
    const isUpdatingToRejected = update.state === 'rejected';

    // Regess authorized job when it's only
    // authorized bid becomes "incomplete" or
    // gets "rejected"
    if (
      isJobAuthorized &&
      (isUpdatingToIncomplete || isUpdatingToRejected) &&
      !areOtherApprovedBids // no other approved bids
    ) {
      try {
        await jobsModel.updateRecord(fs, jobId, { state: 'approved' }, batch);
      } catch (err) {
        return send500Error(
          err,
          'job update: failed to persist updates',
          `Unexpected error: failed to update job "${jobId}"`
        );
      }
    }

    // Update bid
    try {
      await bidsModel.updateRecord(fs, bidId, update, batch);
    } catch (err) {
      return send500Error(
        err,
        'bid update: failed to persist updates',
        `failed to update bid "${bidId}"`
      );
    }

    // Commit job/bid updates
    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'batch commit: failed to persist updates',
        'failed to update bid'
      );
    }

    // Remove relationships
    // from attributes
    delete bid.job;

    // Success response
    res.status(201).send({
      data: {
        id: bidId,
        type: 'bid',
        attributes: { ...bid, ...update },
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