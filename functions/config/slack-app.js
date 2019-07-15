const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

// Use any system or firebase Slack secret
const SLACK_CLIENT_SECRET =
  process.env.SLACK_CLIENT_SECRET ||
  (firebaseConfig.slack && firebaseConfig.slack.secret);

if (!SLACK_CLIENT_SECRET) {
  throw Error(
    '"SLACK_CLIENT_SECRET" not set in system or Firebase Environment'
  );
}

module.exports = {
  clientId: '148699982064.678105000770',
  clientSecret: SLACK_CLIENT_SECRET,
};
