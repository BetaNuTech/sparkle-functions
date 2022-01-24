const express = require('express');
const PubSub = require('@google-cloud/pubsub');
const { fs: db, auth, storage } = require('./setup'); // eslint-disable-line
const config = require('../config');
const router = require('../router');

const { firebase: firebaseConfig } = config;
const port = process.env.PORT || 6000;
const pubsubClient = new PubSub({
  projectId: firebaseConfig ? firebaseConfig.projectId : '',
});

const routes = router(
  db,
  auth,
  {
    inspectionUrl: config.clientApps.web.inspectionURL,
  },
  storage,
  pubsubClient
);

// Make similar to production
const api = express();
api.use('/api', routes);

api.listen(port, '0.0.0.0');
console.log(`api: localhost:${port}/api`); // eslint-disable-line no-console
console.log(`docs: localhost:${port}/api/docs`); // eslint-disable-line no-console
