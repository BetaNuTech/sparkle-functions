const assert = require('assert');
const express = require('express');
const cors = require('cors');
const authUser = require('../../utils/auth-firebase-user');
const getInspectionPDFHandler = require('./get-pdf-handler');

/**
 * Factory for inspection PDF generator endpoint
 * @param  {admin.database} db - Firebase Admin DB instance
 * @param  {admin.firestore} fs - Firestore Admin DB instance
 * @param  {admin.auth?} auth - Firebase Admin auth service instance (optional for testing)
 * @param  {String} inspectionUrl - template for an inspection's URL
 * @return {Function} - onRequest handler
 */
module.exports = function createOnGetPDFReportHandler(
  db,
  fs,
  auth,
  inspectionUrl
) {
  assert(db && typeof db.ref === 'function', 'has realtime db');
  assert(fs && typeof fs.collection === 'function', 'has firestore db');
  assert(
    inspectionUrl && typeof inspectionUrl === 'string',
    'has inspection URL template'
  );

  if (process.env.NODE_ENV !== 'test')
    assert(Boolean(auth), 'has firebase auth instance');

  // Create express app with single endpoint
  // that configures required url params
  const app = express();
  app.use(cors());
  const middleware = [
    auth ? authUser(db, auth) : null,
    getInspectionPDFHandler(db, fs, inspectionUrl),
  ].filter(Boolean);
  app.get('/:property/:inspection', ...middleware);
  return app;
};
