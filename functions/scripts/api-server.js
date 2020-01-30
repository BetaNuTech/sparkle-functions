const { db, auth } = require('./setup'); // eslint-disable-line
const config = require('../config');
const router = require('../router');

const port = process.env.PORT || 6000;
console.log(`listening on ${port}`); // eslint-disable-line no-console

router(db, auth, {
  inspectionUrl: config.clientApps.web.inspectionURL,
}).listen(port, '0.0.0.0');
