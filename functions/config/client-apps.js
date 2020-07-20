const functions = require('firebase-functions');

const firebaseConfig = functions.config() || {};

// Use any system or firebase AWS secrets
const CLIENT_DOMAIN =
  process.env.CLIENT_DOMAIN ||
  (firebaseConfig.web && firebaseConfig.web.clientdomain) ||
  '';

const config = {
  web: {
    deficientItemPath:
      'properties/{{propertyId}}/deficient-items/{{deficientItemId}}',

    inspectionPath:
      'properties/{{propertyId}}/update-inspection/{{inspectionId}}',

    get deficientItemURL() {
      return `${CLIENT_DOMAIN}/${this.deficientItemPath}`;
    },

    get inspectionURL() {
      return `${CLIENT_DOMAIN}/${this.inspectionPath}`;
    },
  },
};

module.exports = config;
