const cors = require('cors');
const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const slack = require('./slack');
const trello = require('./trello');
const properties = require('./properties');
const inspections = require('./inspections');
const versions = require('./versions');
const authUser = require('./utils/auth-firebase-user');
const authTrelloReq = require('./utils/auth-trello-request');

/**
 * Configure Express app with
 * all API endpoints
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @param  {Object} settings
 * @return {Express}
 */
module.exports = (db, fs, auth, settings) => {
  assert(Boolean(db), 'has firebase database instance');
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
    properties.api.getPropertyYardiWorkOrders(db)
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

  return app;
};
