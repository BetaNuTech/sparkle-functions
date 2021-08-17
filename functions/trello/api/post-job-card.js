const assert = require('assert');
const hbs = require('handlebars');
const moment = require('moment-timezone');
const zipToTimezone = require('../../utils/zip-to-timezone');
const jobsModel = require('../../models/jobs');
const propertiesModel = require('../../models/properties');
const integrationsModel = require('../../models/integrations');
const systemModel = require('../../models/system');
const trello = require('../../services/trello');
const config = require('../../config');
const log = require('../../utils/logger');
const toISO8601 = require('../utils/date-to-iso-8601');
const create500ErrHandler = require('../../utils/unexpected-api-error');

const PREFIX = 'trello: api: post job card:';
const JOB_URI = config.clientApps.web.jobURL;

/**
 * Factory for creating a POST endpoint
 * that creates new Trello card for a job
 * @param  {firebaseAdmin.firestore} fs - Firestore Admin DB instance
 * @param  {String} jobUri - Job ur
 * @param  {String} default zip code for card due date
 * @return {Function} - onRequest handler
 */

module.exports = function createPostTrelloJob(
  fs,
  jobUri = JOB_URI,
  defaultZip = '10001'
) {
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(jobUri && typeof jobUri === 'string', 'has job uri string');
  assert(defaultZip && typeof defaultZip === 'string', 'has default zip code');

  // Job card templates factories
  const descriptionTemplate = hbs.compile(
    config.jobs.trelloCardDescriptionTemplate
  );
  const jobUriTemplate = hbs.compile(jobUri);

  /**
   * Handle POST request for creating
   * a trello card for a Job
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { params, trelloCredentials } = req;
    const { propertyId, jobId } = params;
    const send500Error = create500ErrHandler(PREFIX, res);

    // Set content type
    res.set('Content-Type', 'application/vnd.api+json');
    log.info('Create Trello job card requested');

    // Property lookup
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

    // Job lookup
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

    // Reject if Job already has an associated trello card
    if (job.trelloCardURL) {
      log.error(
        `${PREFIX} requested job: "${jobId}" already has an associated trello card`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'job' },
            title: 'Job already has an associated trello card',
          },
        ],
      });
    }

    // Reject if Job is in complete state
    if (job.state === 'complete') {
      log.error(`${PREFIX} job is in complete state`);
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'job' },
            title: 'Job is in complete state',
          },
        ],
      });
    }

    // Lookup Trello integration
    let trelloOrg = null;
    try {
      const trelloOrgSnap = await integrationsModel.firestoreFindTrello(fs);
      trelloOrg = trelloOrgSnap.data() || null;
    } catch (err) {
      return send500Error(
        err,
        'unexpected error',
        'trello integration lookup failed'
      );
    }

    // Reject when trello is not integrated
    if (!trelloOrg) {
      log.error(`${PREFIX} trello is not integrated`);
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'trello' },
            title: 'Trello is not integrated',
          },
        ],
      });
    }

    // Lookup public integration data
    let trelloPropertyConfig = null;
    try {
      const trelloIntegrationSnap = await integrationsModel.firestoreFindTrelloProperty(
        fs,
        propertyId
      );

      trelloPropertyConfig = trelloIntegrationSnap.data() || null;

      if (!trelloPropertyConfig) {
        throw Error('public Trello integration not recorded');
      }
      if (!trelloPropertyConfig.openList) {
        throw Error('public Trello integration open list not set');
      }
    } catch (err) {
      log.error(
        `${PREFIX} public trello integration details lookup failed | ${err}`
      );
      return res.status(409).send({
        errors: [
          {
            detail:
              'Trello integration details for property not found or invalid',
          },
        ],
      });
    }

    const trelloCardPayload = {
      name: job.title, // source inspection item name
      desc: descriptionTemplate({
        propertyName: property.name,
        jobTitle: job.title,
        clientUrl: jobUriTemplate({
          propertyId,
          jobId,
        }),
      }),
    };

    // Lookup for approved bids
    let approvedBid = null;
    if (job.state === 'authorized') {
      try {
        const bidsSnap = await jobsModel.findAssociatedBids(fs, jobId);
        bidsSnap.docs.forEach(doc => {
          const bid = doc.data();
          if (bid && bid.state === 'approved') {
            approvedBid = { ...bid, id: doc.id };
          }
        });
      } catch (err) {
        return send500Error(
          err,
          'associate bid lookup failed',
          'unexpected error'
        );
      }
    }

    // Add approved bid's completion time
    // as the due date of the Trello card
    if (approvedBid && approvedBid.completeAt) {
      const { completeAt } = approvedBid;
      const zipCode = property.zip || defaultZip;
      const timezone = zipToTimezone(zipCode);
      const dateStr = moment
        .unix(completeAt)
        .tz(timezone)
        .format('MM/DD/YYYY');
      trelloCardPayload.due = toISO8601(dateStr, zipCode);
      trelloCardPayload.dueComplete = false;
    }

    // Set members to authorized Trello account
    if (trelloOrg.member) {
      trelloCardPayload.idMembers = trelloOrg.member;
    }

    // Publish Card to Trello API
    let cardId = '';
    let cardUrl = '';
    try {
      const trelloResponse = await trello.publishListCard(
        trelloPropertyConfig.openList,
        trelloCredentials.authToken,
        trelloCredentials.apikey,
        trelloCardPayload
      );
      cardId = trelloResponse.id;
      cardUrl = trelloResponse.shortUrl;
      if (!cardId) throw Error(`Unexpected Trello payload missing "id"`);
      if (!cardUrl) throw Error(`Unexpected Trello payload missing "shortUrl"`);
    } catch (err) {
      return send500Error(
        err,
        'Error retrieved from Trello API',
        'Error from trello API'
      );
    }

    const batch = fs.batch();

    // Update system trello/property cards
    try {
      await systemModel.firestoreUpsertPropertyTrello(
        fs,
        propertyId,
        { cards: { [cardId]: jobId } },
        batch
      );
    } catch (err) {
      return send500Error(
        err,
        'failed to update system trello property',
        'Trello card reference failed to save'
      );
    }

    // Update job trello card url
    const updatedAt = Math.round(Date.now() / 1000);
    const jobUpdate = { updatedAt, trelloCardURL: cardUrl };
    try {
      await jobsModel.updateRecord(fs, jobId, jobUpdate, batch);
    } catch (err) {
      return send500Error(
        err,
        'failed to update job trello card',
        'Job failed to save'
      );
    }

    try {
      await batch.commit();
    } catch (err) {
      return send500Error(
        err,
        'failed to commit database writes',
        'System error'
      );
    }
    // Success
    res.status(201).send({
      data: {
        id: jobId,
        type: 'job',
        attributes: jobUpdate,
      },
    });
  };
};
