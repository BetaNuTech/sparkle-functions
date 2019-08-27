const path = require('path');
const dotenv = require('dotenv');

try {
  const cwd = process.cwd();

  // Consume any `.env` in cwd and/or 2 parent directories
  dotenv.config();
  dotenv.config({ path: path.resolve(`${cwd}/..`, '.env') });
  dotenv.config({ path: path.resolve(`${cwd}/../..`, '.env') });
} catch (err) {} // eslint-disable-line no-empty

const [, , propertyId, deficientItemId] = process.argv; // eslint-disable-line
if (!propertyId) throw Error('Property ID not provided');
if (!deficientItemId) throw Error('Deficient Item ID not provided');

const appConfig = require('../config'); // eslint-disable-line

const { firebase: config } = appConfig;

const admin = require('firebase-admin'); // eslint-disable-line
const defaultApp = admin.initializeApp(config, 'script');
const db = defaultApp.database(config.stagingDatabaseURL);
const test = require('firebase-functions-test')(config); // eslint-disable-line
const cloudFunctions = require('../index');

(async () => {
  const beforeSnap = await db
    .ref(
      `/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}/state`
    )
    .once('value'); // Create before
  const afterSnap = await db
    .ref(
      `/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}/state`
    )
    .once('value'); // Create after

  // Execute
  const changeSnap = test.makeChange(beforeSnap, afterSnap);
  const wrapped = test.wrap(
    cloudFunctions.deficientItemsPropertyMetaSyncStaging
  );
  await wrapped(changeSnap, {
    params: {
      propertyId,
      itemId: deficientItemId,
    },
  });
})();
