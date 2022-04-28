const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

const SLACK_CLIENT_SECRET =
  process.env.SLACK_CLIENT_SECRET ||
  (firebaseConfig.slack && firebaseConfig.slack.secret);

const SLACK_CLIENT_ID =
  process.env.SLACK_CLIENT_ID ||
  (firebaseConfig.slack && firebaseConfig.slack.clientid);

if (!SLACK_CLIENT_SECRET) {
  throw Error(
    '"SLACK_CLIENT_SECRET" not set in system or Firebase Environment'
  );
}

if (!SLACK_CLIENT_ID) {
  throw Error('"SLACK_CLIENT_ID" not set in system or Firebase Environment');
}

module.exports = {
  clientId: SLACK_CLIENT_ID,
  clientSecret: SLACK_CLIENT_SECRET,
};
