const cors = require('cors');
const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const slack = require('./slack');
const trello = require('./trello');
const deficiencies = require('./deficient-items');
const properties = require('./properties');
const inspections = require('./inspections');
const users = require('./users');
const versions = require('./versions');
const authUser = require('./utils/auth-firebase-user');
const authUserCrud = require('./middleware/auth-user-crud');
const authTrelloReq = require('./utils/auth-trello-request');

/**
 * Configure Express app with
 * all API endpoints
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {admin.auth} auth - Firebase Admin auth instance
 * @param  {Object} settings
 * @return {Express}
 */
module.exports = (fs, auth, settings) => {
  assert(Boolean(fs), 'has firestore database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  const app = express();
  const { inspectionUrl } = settings;
  app.use(bodyParser.json(), cors({ origin: true, credentials: true }));

  app.get(
    '/v0/versions',
    authUser(fs, auth),
    versions.api.getClientAppVersions(fs)
  );

  // Inspection property
  // reassignment endpoint
  app.patch(
    '/v0/inspections/:inspectionId',
    authUser(fs, auth, true), // admin only
    inspections.api.createPatchProperty(fs)
  );

  // Generate Inspection PDF report
  app.get(
    '/v0/inspections/:inspection/pdf-report',
    authUser(fs, auth),
    inspections.api.createGetInspectionPDF(fs, inspectionUrl)
  );
  app.patch(
    '/v0/inspections/:inspectionId/report-pdf',
    authUser(fs, auth),
    inspections.api.createPatchReportPDF(fs)
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/inspections/latest-completed',
    // TODO: auth?
    inspections.api.getLatestCompletedInspection(fs)
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

  // Create Trello Card for deficiency
  app.post(
    '/v0/deficiencies/:deficiencyId/trello/card',
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
  app.put(
    '/v0/deficiencies',
    authUser(fs, auth, {
      admin: true,
      corporate: true,
    }),
    deficiencies.api.putBatch(fs)
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

  return app;
};
