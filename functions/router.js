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
 * @param  {admin.firestore} db - Firestore Admin DB instance
 * @param  {admin.auth} auth - Firebase Admin auth instance
 * @param  {Object} settings
 * @param  {Object} storage
 * @return {Express}
 */
module.exports = (db, auth, settings, storage, pubsubClient) => {
  assert(Boolean(db), 'has firestore database instance');
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
  app.get('/v0/versions', authUser(db, auth), clients.api.getAppVersions(db));
  app.get(
    '/v0/clients/versions',
    authUser(db, auth),
    clients.api.getAppVersions(db)
  );

  // Create client error report
  app.post('/v0/clients/errors', authUser(db, auth), clients.api.postError());

  // Inspection creation end point
  app.post(
    '/v0/properties/:propertyId/inspections',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.post(db)
  );

  // Update Inspection Items
  app.patch(
    '/v0/inspections/:inspectionId/template',
    inspections.api.propertyAuthSetupMiddleware(db),
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.patchTemplate(db, storage, completeInspUpdatePublisher)
  );

  // Upload a image to an inspection item
  app.post(
    '/v0/inspections/:inspectionId/template/items/:itemId/image',
    inspections.api.propertyAuthSetupMiddleware(db),
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    fileParser,
    inspections.api.postTemplateItemImage(db, storage)
  );

  // Inspection property
  // reassignment endpoint
  app.patch(
    '/v0/inspections/:inspectionId',
    authUser(db, auth, true), // admin only
    inspections.api.createPatchProperty(db)
  );

  // Generate Inspection PDF report
  app.patch(
    '/v0/inspections/:inspectionId/report-pdf',
    inspections.api.propertyAuthSetupMiddleware(db),
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    inspections.api.createPatchReportPDF(
      db,
      storage,
      completeInspUpdatePublisher
    )
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/inspections/latest-completed',
    // TODO: auth?
    inspections.api.getLatestCompletedInspection(db)
  );

  // Create a template
  app.post(
    '/v0/templates',
    authUser(db, auth, { admin: true, corporate: true }),
    templates.api.post(db)
  );

  // Update a template
  app.patch(
    '/v0/templates/:templateId',
    authUser(db, auth, { admin: true, corporate: true }),
    templates.api.patch(db)
  );

  // Delete a template
  app.delete(
    '/v0/templates/:templateId',
    authUser(db, auth, { admin: true }),
    templates.api.delete(db)
  );

  // Create a template category
  app.post(
    '/v0/template-categories',
    authUser(db, auth, { admin: true, corporate: true }),
    templateCategories.api.post(db)
  );

  // Update a template category
  app.patch(
    '/v0/template-categories/:templateCategoryId',
    authUser(db, auth, { admin: true, corporate: true }),
    templateCategories.api.patch(db)
  );

  // Delete a template category
  app.delete(
    '/v0/template-categories/:templateCategoryId',
    authUser(db, auth, { admin: true, corporate: true }),
    templateCategories.api.delete(db)
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/residents',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    properties.middleware.propertyCode(db),
    properties.middleware.yardiIntegration(db),
    properties.api.getPropertyYardiResidents(db)
  );

  // Request Property's work orders from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/work-orders',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    properties.middleware.propertyCode(db),
    properties.middleware.yardiIntegration(db),
    properties.api.getPropertyYardiWorkOrders()
  );

  // Create a property
  app.post(
    '/v0/properties',
    authUser(db, auth, true), // admin only
    properties.api.post(db)
  );

  // Update a property
  app.put(
    '/v0/properties/:propertyId',
    authUser(db, auth, { admin: true, corporate: true }),
    properties.api.put(db)
  );

  // Upload an image/logo to property
  app.post(
    '/v0/properties/:propertyId/image',
    authUser(db, auth, {
      admin: true,
      corporate: true,
    }),
    fileParser,
    properties.api.postImage(db, storage)
  );

  // Authorize Slack API credentials
  app.post(
    '/v0/integrations/slack/authorization',
    authUser(db, auth, true),
    slack.api.postAuth(db)
  );

  // Update Slack Integration Details
  app.patch(
    '/v0/integrations/slack/authorization',
    authUser(db, auth, true),
    slack.api.patchAuth(db)
  );

  // Delete Slack App from a Slack Workspace
  app.delete(
    '/v0/integrations/slack/authorization',
    authUser(db, auth, true),
    slack.api.deleteAuth(db)
  );

  // Slack POST events webook
  app.post('/v0/integrations/slack/events', slack.api.postEventsWebhook(db));

  // Authorize Trello API credentials
  app.post(
    '/v0/integrations/trello/authorization',
    authUser(db, auth, true),
    trello.api.postAuth(db)
  );

  // Remove Trello API credentials & integrations
  app.delete(
    '/v0/integrations/trello/authorization',
    authUser(db, auth, true),
    trello.api.deleteAuth(db)
  );

  // Fetch all Trello boards
  app.get(
    '/v0/integrations/trello/boards',
    authUser(db, auth, true),
    authTrelloReq(db),
    trello.api.getBoards(db)
  );

  // Fetch all Trello board's lists
  app.get(
    '/v0/integrations/trello/boards/:boardId/lists',
    authUser(db, auth, true),
    authTrelloReq(db),
    trello.api.getBoardLists(db)
  );

  // Create/update a property's trello integration
  app.put(
    '/v0/integrations/trello/properties/:propertyId',
    authUser(db, auth, true),
    authTrelloReq(db),
    trello.api.putPropertyIntegration(db)
  );

  app.post(
    '/v0/properties/:propertyId/jobs/:jobId/trello',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    authTrelloReq(db),
    trello.api.postJobCard(db)
  );

  // Create Trello Card for deficiency
  app.post(
    '/v0/deficiencies/:deficiencyId/trello/card',
    // setup property-level auth requirements
    deficiencies.api.authSetup(db),
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    authTrelloReq(db),
    trello.api.postDeficiencyCard(db)
  );

  // Update 1 or more deficiencies
  const enableProgressNoteNotifications = Boolean(
    config.notifications.enabled.deficientItemProgressNote
  );
  app.put(
    '/v0/deficiencies',
    // setup property-level auth requirements
    deficiencies.api.authSetup(db),
    // permission auth
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    deficiencies.api.putBatch(db, enableProgressNoteNotifications)
  );

  // Upload a image to an deficiency
  app.post(
    '/v0/deficiencies/:deficiencyId/image',
    // setup property-level auth requirements
    deficiencies.api.authSetup(db),
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    fileParser,
    deficiencies.api.postImage(db, storage)
  );

  // Create new user
  app.post(
    '/v0/users',
    authUser(db, auth),
    authUserCrud(auth),
    users.api.createPostUser(db, auth)
  );

  // Update User
  app.patch(
    '/v0/users/:userId',
    authUser(db, auth),
    users.api.createPatchUser(db, auth)
  );

  // Delete User
  app.delete(
    '/v0/users/:userId',
    authUser(db, auth),
    authUserCrud(auth),
    users.api.createDeleteUser(db, auth)
  );

  // Create job
  app.post(
    '/v0/properties/:propertyId/jobs',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.post(db)
  );

  // Update a job
  app.put(
    '/v0/properties/:propertyId/jobs/:jobId',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.put(db)
  );

  // Update a bid
  app.put(
    '/v0/properties/:propertyId/jobs/:jobId/bids/:bidId',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.putBid(db)
  );

  // Create bid
  app.post(
    '/v0/properties/:propertyId/jobs/:jobId/bids',
    authUser(db, auth, {
      admin: true,
      corporate: true,
      team: true,
      property: true,
    }),
    jobs.api.postBid(db)
  );

  // Create Team
  app.post('/v0/teams', authUser(db, auth, true), teams.api.post(db));

  // Update Team
  app.patch('/v0/teams/:teamId', authUser(db, auth, true), teams.api.patch(db));

  // Delete Team
  app.delete(
    '/v0/teams/:teamId',
    authUser(db, auth, true),
    teams.api.delete(db)
  );

  return app;
};
