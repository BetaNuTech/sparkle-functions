const express = require('express');
const { fs, auth, storage } = require('./setup'); // eslint-disable-line
const config = require('../config');
const router = require('../router');

const port = process.env.PORT || 6000;

const routes = router(
  fs,
  auth,
  {
    inspectionUrl: config.clientApps.web.inspectionURL,
  },
  storage
);

// Make similar to production
const api = express();
api.use('/api', routes);

api.listen(port, '0.0.0.0');
console.log(`api: localhost:${port}/api`); // eslint-disable-line no-console
console.log(`docs: localhost:${port}/api/docs`); // eslint-disable-line no-console
