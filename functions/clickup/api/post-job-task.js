const assert = require('assert');
const hbs = require('handlebars');
const moment = require('moment-timezone');
const log = require('../../utils/logger');
const zipToTimezone = require('../../utils/zip-to-timezone');
const systemModel = require('../../models/system');
const jobsModel = require('../../models/jobs');
const integrationsModel = require('../../models/integrations');
const propertiesModel = require('../../models/properties');
const notificationsModel = require('../../models/notifications');
const clickup = require('../../services/clickup');
const config = require('../../config');
const { getBestStatusMatch } = require('../utils');
const create500ErrHandler = require('../../utils/unexpected-api-error');
const notifyTemplate = require('../../utils/src-notification-templates');
const { getFullName } = require('../../utils/user');

const PREFIX = 'clickup: api: post-job-task:';
const JOB_URI = config.clientApps.web.jobURL;

/**
 * Factory for creating POST request handler
 * that creates new ClickUp task for a job
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {String} jobUri
 * @return {Function} - onRequest handler
 */
module.exports = function createOnClickUpJobTask(
  db,
  jobUri = JOB_URI
) {
  assert(db && typeof db.collection === 'function', 'has firestore db');
  assert(
    jobUri && typeof jobUri === 'string',
    'has job uri string'
  );

  // Template for task descriptions
  const descriptionTemplate = hbs.compile(
    config.clickup.jobTaskDescriptionTemplate
  );
  const jobUriTemplate = hbs.compile(jobUri);

  /**
   * Create POST ClickUp task for job handler
   * @param  {Object} req Express req
   * @param  {Object} res Express res
   * @return {Promise}
   */
  return async (req, res) => {
    const { user, params, clickupCredentials } = req;
    const { propertyId, jobId } = params;
    const send500Error = create500ErrHandler(PREFIX, res);
    
    assert(
      propertyId && typeof propertyId === 'string',
      'defined "propertyId" param in path'
    );
    assert(
      jobId && typeof jobId === 'string',
      'defined "jobId" param in path'
    );
    assert(
      clickupCredentials && typeof clickupCredentials === 'object',
      'has ClickUp credentials in request'
    );
    assert(
      user && typeof user === 'object',
      'has user configuration in request'
    );

    // Is client requesting notifications
    const isNotifying = req.query.notify
      ? req.query.notify.search(/true/i) > -1
      : false;

    // Optional incognito mode query
    const incognitoMode = req.query.incognitoMode
      ? req.query.incognitoMode.search(/true/i) > -1
      : false;

    log.info(`${PREFIX} requested by user: "${user.id}"`);

    // Configure JSON API response
    res.set('Content-Type', 'application/vnd.api+json');

    // Lookup Property
    let property = null;
    try {
      const propertySnap = await propertiesModel.findRecord(db, propertyId);
      property = propertySnap.data() || null;
      if (!property) {
        throw Error(`property: "${propertyId}" does not exist`);
      }
      property.id = propertyId;
    } catch (err) {
      log.error(`${PREFIX} property lookup failed: ${err}`);
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
      const jobSnap = await jobsModel.findRecord(db, jobId);
      job = jobSnap.data() || null;
      if (!job) {
        throw Error(`job: "${jobId}" does not exist`);
      }
      job.id = jobId;
    } catch (err) {
      log.error(`${PREFIX} job lookup failed: ${err}`);
      return res.status(404).send({
        errors: [
          {
            source: { pointer: 'job' },
            title: 'Job not found',
          },
        ],
      });
    }

    // Reject if Job already has an associated ClickUp task
    if (job.clickupTaskURL) {
      log.error(
        `${PREFIX} requested job: "${jobId}" already has an associated ClickUp task`
      );
      return res.status(409).send({
        errors: [
          {
            source: { pointer: 'job' },
            title: 'Job already has an associated ClickUp task',
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

    // Lookup for approved bids when job is authorized
    let approvedBid = null;
    if (job.state === 'authorized') {
      try {
        const bidsSnap = await jobsModel.findAssociatedBids(db, jobsModel.createDocRef(db, jobId));
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

    // Lookup ClickUp property integration data
    let clickupPropertyConfig = null;
    try {
      const clickupIntegrationSnap = await integrationsModel.findClickUpProperty(
        db,
        propertyId
      );

      clickupPropertyConfig = clickupIntegrationSnap.data() || null;

      if (!clickupPropertyConfig) {
        throw Error('ClickUp integration not configured for property');
      }
      if (!clickupPropertyConfig.jobsListId) {
        throw Error('ClickUp jobs list not configured for property');
      }
    } catch (err) {
      log.error(
        `${PREFIX} ClickUp integration details lookup failed | ${err}`
      );
      return res.status(409).send({
        errors: [
          {
            detail:
              'ClickUp integration details for property not found or invalid',
          },
        ],
      });
    }

    // Get list details to find available statuses
    let listDetails = null;
    try {
      listDetails = await clickup.fetchList(
        clickupCredentials.apiToken,
        clickupPropertyConfig.jobsListId
      );
    } catch (err) {
      log.error(`${PREFIX} failed to fetch list details: ${err}`);
      return res.status(409).send({
        errors: [{ detail: 'Could not access ClickUp jobs list' }],
      });
    }

    // Find the best status match for the job state
    const targetStatus = getBestStatusMatch(
      job.state,
      listDetails.statuses || [],
      'job'
    );

    // Build task payload
    const clickupTaskPayload = {
      name: job.title || 'Untitled Job', // job title
      description: descriptionTemplate({
        propertyName: property.name || '',
        jobTitle: job.title || '',
        jobType: job.type || '',
        estimatedCost: job.estimatedCost || '',
        completionDate: job.targetCompletionDate || '',
        jobDescription: job.description || '',
        clientUrl: jobUriTemplate({
          propertyId,
          jobId,
        }),
      }),
      status: targetStatus,
      priority: config.clickup.defaults.taskPriority,
      tags: [
        config.clickup.tags.job,
        config.clickup.tags.sparkle,
        config.clickup.tags.automated
      ],
      notify_all: false
    };

    // Set due date - prioritize approved bid completion date, fallback to job target date
    let dueDateTime = null;
    
    // First check for approved bid completion date
    if (approvedBid && approvedBid.completeAt) {
      try {
        const zipCode = property.zip || '10001'; // default zip
        const timezone = zipToTimezone(zipCode);
        const dueDate = moment
          .unix(approvedBid.completeAt)
          .tz(timezone)
          .endOf('day'); // Set to end of day
        dueDateTime = dueDate.valueOf(); // Get milliseconds
      } catch (err) {
        log.error(`${PREFIX} failed to parse bid completion date: ${err}`);
      }
    }
    
    // Fallback to job target completion date if no bid date
    if (!dueDateTime && job.targetCompletionDate && job.targetCompletionDate !== 'N/A') {
      try {
        const dueDate = new Date(job.targetCompletionDate + 'T23:59:59');
        dueDateTime = dueDate.getTime();
      } catch (err) {
        log.error(`${PREFIX} failed to parse job target date: ${err}`);
      }
    }
    
    // Set due date in payload if we have one
    if (dueDateTime) {
      clickupTaskPayload.due_date = dueDateTime;
      clickupTaskPayload.due_date_time = true;
    }

    // Create the ClickUp task
    let clickupTask = null;
    try {
      clickupTask = await clickup.createTask(
        clickupCredentials.apiToken,
        clickupPropertyConfig.jobsListId,
        clickupTaskPayload
      );
    } catch (err) {
      log.error(`${PREFIX} ClickUp task creation failed: ${err}`);
      return send500Error(
        err,
        'ClickUp task creation failed',
        'Failed to create ClickUp task'
      );
    }

    const batch = db.batch();

    // Store ClickUp task reference in system
    try {
      await systemModel.upsertPropertyClickUp(
        db,
        propertyId,
        {
          tasks: {
            [clickupTask.id]: `job-${jobId}` // Prefix to distinguish from deficiency IDs
          }
        },
        batch
      );
    } catch (err) {
      log.error(`${PREFIX} failed to store ClickUp task reference: ${err}`);
      return send500Error(
        err,
        'Failed to store task reference',
        'Database error'
      );
    }

    // Update job with ClickUp task URL
    const clickupTaskURL = `https://app.clickup.com/t/${clickupTask.id}`;
    try {
      const jobDoc = db.collection(config.jobs.collection).doc(jobId);
      batch.update(jobDoc, {
        clickupTaskURL,
        updatedAt: Math.round(Date.now() / 1000)
      });
    } catch (err) {
      log.error(`${PREFIX} failed to update job with task URL: ${err}`);
      return send500Error(
        err,
        'Failed to update job',
        'Database error'
      );
    }

    // Commit all database changes
    try {
      await batch.commit();
    } catch (err) {
      log.error(`${PREFIX} failed to commit database updates: ${err}`);
      return send500Error(
        err,
        'Database commit failed',
        'Database error'
      );
    }

    // Return success response
    res.status(201).send({
      data: {
        id: clickupTask.id,
        type: 'clickup-task',
        attributes: {
          name: clickupTask.name,
          status: (clickupTask.status && clickupTask.status.status) || targetStatus,
          url: clickupTaskURL,
          list: {
            id: clickupPropertyConfig.jobsListId,
            name: clickupPropertyConfig.jobsListName
          },
          space: {
            id: clickupPropertyConfig.spaceId,
            name: clickupPropertyConfig.spaceName
          }
        },
        relationships: {
          job: {
            data: { id: jobId, type: 'job' }
          },
          property: {
            data: { id: propertyId, type: 'property' }
          }
        }
      }
    });

    // Send notifications if requested and not in incognito mode
    if (isNotifying && !incognitoMode) {
      try {
        await notificationsModel.addRecord(db, {
          title: 'ClickUp Task Created for Job',
          summary: notifyTemplate('job-clickup-task-create-summary', {
            title: job.title,
            authorName: getFullName(user),
          }),
          markdownBody: notifyTemplate(
            'job-clickup-task-create-markdown-body',
            {
              title: job.title,
              jobType: job.type,
              estimatedCost: job.estimatedCost,
              clickupTaskURL,
            }
          ),
          creator: user.id,
          property: propertyId,
        });
      } catch (err) {
        log.error(`${PREFIX} failed to create notification: ${err}`);
        // Continue - notification failure shouldn't break the response
      }
    }
  };
};