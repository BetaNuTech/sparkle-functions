const { db } = require('../test/end-to-end/setup'); // eslint-disable-line
const { cleanDb } = require('../test-helpers/firebase');

(async () => {
  await cleanDb(db);

  // End
  process.exit();
})();
