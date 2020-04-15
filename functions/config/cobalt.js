const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

// Lookup optional Cobalt Domain
const COBALT_DOMAIN =
  process.env.COBALT_DOMAIN ||
  (firebaseConfig.cobalt && firebaseConfig.cobalt.domain) ||
  '';

module.exports = {
  domain: COBALT_DOMAIN,
};
