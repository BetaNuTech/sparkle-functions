const cors = require('cors');
const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const fileParser = require('express-multipart-file-parser');
const slack = require('./slack');
const trello = require('./trello');
const deficiencies = require('./deficient-items');
const properties = require('./properties');
const inspections = require('./inspections');
const templates = require('./templates');
const templateCategories = require('./template-categories');
const jobs = require('./jobs');
const users = require('./users');
const clients = require('./clients');
const teams = require('./teams');
const authUser = require('./utils/auth-firebase-user');
const authUserCrud = require('./middleware/auth-user-crud');
const authTrelloReq = require('./utils/auth-trello-request');
const swaggerDocument = require('./swagger.json');
const config = require('./config');

/**
 * Configure Express app with
 * all API endpoints
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {admin.auth} auth - Firebase Admin auth instance
 * @param  {Object} settings
 * @param  {Object} storage
 * @return {Express}
 */
module.exports = (fs, auth, settings, storage, pubsubClient) => {
  assert(Boolean(fs), 'has firestore database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  const app = express();
  const completeInspUpdatePublisher = pubsubClient
    .topic('complete-inspection-update')
    .publisher();

  app.use(bodyParser.json(), cors({ origin: true, credentials: true }));
  swaggerDocument.host = process.env.FIREBASE_FUNCTIONS_DOMAIN;

  // API documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Return latest published
  // client app versions
  app.get('/v0/versions', authUser(fs, auth), clients.api.getAppVersions(fs));
  app.get(
    '/v0/clients/versions',
    authUser(fs, auth),
    clients.api.getAppVersions(fs)
  );

  // Create client error report
  app.post('/v0/clients/errors', authUser(fs, auth), clients.api.postError());

  // Inspection creation end point
  app.post(
    '/v0/properties/:propertyId/inspections',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.post(fs)
  );

  // Update Inspection Items
  app.patch(
    '/v0/inspections/:inspectionId/template',
    inspections.api.propertyAuthSetupMiddleware(fs),
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.patchTemplate(fs, storage, completeInspUpdatePublisher)
  );

  // Upload a image to an inspection item
  app.post(
    '/v0/inspections/:inspectionId/template/items/:itemId/image',
    inspections.api.propertyAuthSetupMiddleware(fs),
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    fileParser,
    inspections.api.postTemplateItemImage(fs, storage)
  );

  // Inspection property
  // reassignment endpoint
  app.patch(
    '/v0/inspections/:inspectionId',
    authUser(fs, auth, true), // admin only
    inspections.api.createPatchProperty(fs)
  );

  // Generate Inspection PDF report
  app.patch(
    '/v0/inspections/:inspectionId/report-pdf',
    inspections.api.propertyAuthSetupMiddleware(fs),
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.createPatchReportPDF(
      fs,
      storage,
      completeInspUpdatePublisher
    )
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/inspections/latest-completed',
    // TODO: auth?
    inspections.api.getLatestCompletedInspection(fs)
  );

  // Create a template
  app.post(
    '/v0/templates',
    authUser(fs, auth, { admin: true, corporate: true }),
    templates.api.post(fs)
  );

  // Delete a template
  app.delete(
    '/v0/templates/:templateId',
    authUser(fs, auth, { admin: true }),
    templates.api.delete(fs)
  );

  // Create a template category
  app.post(
    '/v0/template-categories',
    authUser(fs, auth, { admin: true, corporate: true }),
    templateCategories.api.post(fs)
  );

  // Update a template category
  app.patch(
    '/v0/template-categories/:templateCategoryId',
    authUser(fs, auth, { admin: true, corporate: true }),
    templateCategories.api.patch(fs)
  );

  // Delete a template category
  app.delete(
    '/v0/template-categories/:templateCategoryId',
    authUser(fs, auth, { admin: true, corporate: true }),
    templateCategories.api.delete(fs)
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/residents',
    authUser(fs, auth),
    properties.middleware.propertyCode(fs),
    properties.middleware.yardiIntegration(fs),
    properties.api.getPropertyYardiResidents(fs)
  );

  // Request Property's work orders from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/work-orders',
    authUser(fs, auth),
    properties.middleware.propertyCode(fs),
    properties.middleware.yardiIntegration(fs),
    properties.api.getPropertyYardiWorkOrders()
  );

  // Create a property
  app.post(
    '/v0/properties',
    authUser(fs, auth, true), // admin only
    properties.api.post(fs)
  );

  // Update a property
  app.put(
    '/v0/properties/:propertyId',
    authUser(fs, auth, { admin: true, corporate: true }),
    properties.api.put(fs)
  );

  // Upload an image/logo to property
  app.post(
    '/v0/properties/:propertyId/image',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
    }),
    fileParser,
    properties.api.postImage(fs, storage)
  );

  // Authorize Slack API credentials
  app.post(
    '/v0/integrations/slack/authorization',
    authUser(fs, auth, true),
    slack.api.postAuth(fs)
  );

  // Delete Slack App from a Slack Workspace
  app.delete(
    '/v0/integrations/slack/authorization',
    authUser(fs, auth, true),
    slack.api.deleteAuth(fs)
  );

  // Slack POST events webook
  app.post('/v0/integrations/slack/events', slack.api.postEventsWebhook(fs));

  // Authorize Trello API credentials
  app.post(
    '/v0/integrations/trello/authorization',
    authUser(fs, auth, true),
    trello.api.postAuth(fs)
  );

  // Remove Trello API credentials & integrations
  app.delete(
    '/v0/integrations/trello/authorization',
    authUser(fs, auth, true),
    trello.api.deleteAuth(fs)
  );

  // Fetch all Trello boards
  app.get(
    '/v0/integrations/trello/boards',
    authUser(fs, auth, true),
    authTrelloReq(fs),
    trello.api.getBoards(fs)
  );

  // Fetch all Trello board's lists
  app.get(
    '/v0/integrations/trello/boards/:boardId/lists',
    authUser(fs, auth, true),
    authTrelloReq(fs),
    trello.api.getBoardLists(fs)
  );

  app.post(
    '/v0/properties/:propertyId/jobs/:jobId/trello',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    authTrelloReq(fs),
    trello.api.postJobCard(fs)
  );

  // Create Trello Card for deficiency
  app.post(
    '/v0/deficiencies/:deficiencyId/trello/card',
    // setup property-level auth requirements
    deficiencies.api.putBatchSetupMiddleware(fs),
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    authTrelloReq(fs),
    trello.api.postDeficiencyCard(fs)
  );

  // Update 1 or more deficiencies
  const enableProgressNoteNotifications = Boolean(
    config.notifications.enabled.deficientItemProgressNote
  );
  app.put(
    '/v0/deficiencies',
    // setup property-level auth requirements
    deficiencies.api.putBatchSetupMiddleware(fs),
    // permission auth
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    deficiencies.api.putBatch(fs, enableProgressNoteNotifications)
  );

  // Upload a image to an deficiency
  app.post(
    '/v0/deficiencies/:deficiencyId/image',
    deficiencies.api.putBatchSetupMiddleware(fs),
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    fileParser,
    deficiencies.api.postImage(fs, storage)
  );

  // Create new user
  app.post(
    '/v0/users',
    authUser(fs, auth),
    authUserCrud(auth),
    users.api.createPostUser(fs, auth)
  );

  // Update User
  app.patch(
    '/v0/users/:userId',
    authUser(fs, auth),
    users.api.createPatchUser(fs, auth)
  );

  // Delete User
  app.delete(
    '/v0/users/:userId',
    authUser(fs, auth),
    authUserCrud(auth),
    users.api.createDeleteUser(fs, auth)
  );

  // Create job
  app.post(
    '/v0/properties/:propertyId/jobs',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.post(fs)
  );

  // Update a job
  app.put(
    '/v0/properties/:propertyId/jobs/:jobId',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.put(fs)
  );

  // Update a bid
  app.put(
    '/v0/properties/:propertyId/jobs/:jobId/bids/:bidId',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.putBid(fs)
  );

  // Create bid
  app.post(
    '/v0/properties/:propertyId/jobs/:jobId/bids',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.postBid(fs)
  );

  // Create Team
  app.post('/v0/teams', authUser(fs, auth, true), teams.api.post(fs));

  // Update Team
  app.patch('/v0/teams/:teamId', authUser(fs, auth, true), teams.api.patch(fs));

  // Delete Team
  app.delete(
    '/v0/teams/:teamId',
    authUser(fs, auth, true),
    teams.api.delete(fs)
  );

  return app;
};
