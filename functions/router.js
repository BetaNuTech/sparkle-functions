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
    authUser(db, auth),
    versions.api.getClientAppVersions(fs)
  );

  // Inspection property
  // reassignment endpoint
  app.patch(
    '/v0/inspections/:inspectionId',
    authUser(db, auth, true), // admin only
    inspections.api.createPatchProperty(db, fs)
  );

  // Generate Inspection PDF report
  app.get(
    '/v0/inspections/:inspection/pdf-report',
    authUser(db, auth),
    inspections.api.createGetInspectionPDF(db, fs, inspectionUrl)
  );

  // Request Property's residents from Yardi
  app.get(
    '/v1/properties/:propertyCode/latest-inspection',
    // TODO: auth?
    properties.api.getLatestCompletedInspection(fs)
  );

  // Request Property's residents from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/residents',
    authUser(db, auth),
    properties.middleware.propertyCode(fs),
    properties.middleware.yardiIntegration(db),
    properties.api.getPropertyYardiResidents(db)
  );

  // Request Property's work orders from Yardi
  app.get(
    '/v0/properties/:propertyId/yardi/work-orders',
    authUser(db, auth),
    properties.middleware.propertyCode(fs),
    properties.middleware.yardiIntegration(db),
    properties.api.getPropertyYardiWorkOrders(db)
  );

  // Authorize Slack API credentials
  app.post(
    '/v0/integrations/slack/authorization',
    authUser(db, auth, true),
    slack.api.postAuth(fs)
  );

  // Delete Slack App from a Slack Workspace
  app.delete(
    '/v0/integrations/slack/authorization',
    authUser(db, auth, true),
    slack.api.deleteAuth(fs)
  );

  // Slack POST events webook
  app.post('/v0/integrations/slack/events', slack.api.postEventsWebhook(fs));

  // Authorize Trello API credentials
  app.post(
    '/v0/integrations/trello/authorization',
    authUser(db, auth, true),
    trello.api.postAuth(fs)
  );

  // Fetch all Trello boards
  app.get(
    '/v0/integrations/trello/boards',
    authUser(db, auth, true),
    authTrelloReq(db),
    trello.api.getBoards(fs)
  );

  return app;
};
