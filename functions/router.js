const cors = require('cors');
const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const inspections = require('./inspections');
const authUser = require('./utils/auth-firebase-user');

/**
 * Configure Express app with
 * all API endpoints
 * @param  {firebaseAdmin.database} db - Firebase Admin DB instance
 * @param  {firebaseAdmin.auth} auth - Firebase Admin auth instance
 * @param  {Object} settings
 * @return {Express}
 */
module.exports = (db, auth, settings) => {
  assert(Boolean(db), 'has firebase database instance');
  assert(Boolean(auth), 'has firebase auth instance');

  const app = express();
  const { inspectionUrl } = settings;

  // Inspection property
  // reassignment endpoint
  app.patch(
    '/v0/inspections/:inspectionId',
    cors(),
    bodyParser.json(),
    authUser(db, auth, true), // admin only
    inspections.api.createPatchProperty(db)
  );

  // Generate Inspection PDF report
  app.get(
    '/v0/inspections/:inspection/pdf-report',
    cors(),
    authUser(db, auth),
    inspections.api.createGetInspectionPDF(db, inspectionUrl)
  );

  return app;
};
