const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

// Use any system or firebase AWS secrets
const COBALT_DOMAIN =
  process.env.COBALT_DOMAIN ||
  (firebaseConfig.cobalt && firebaseConfig.cobalt.domain);

module.exports = {
  domain: COBALT_DOMAIN,
};
