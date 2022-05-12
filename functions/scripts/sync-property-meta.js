const log = require('../utils/logger');
const { db } = require('./setup'); // eslint-disable-line
const propertiesModel = require('../models/properties');

(async () => {
  let propertiesSnap = null;

  try {
    propertiesSnap = await propertiesModel.findAll(db);
  } catch (err) {
    console.error(`Failed to lookup all properties | ${err}`); // eslint-disable-line
    throw err;
  }

  for (let i = 0; i < propertiesSnap.docs.length; i++) {
    const propertySnap = propertiesSnap.docs[i];

    try {
      await propertiesModel.updateMetaData(db, propertySnap.id);
      console.log(`successfully synced property: "${propertySnap.id}"`); // eslint-disable-line
      console.log(`${i + 1} of ${propertiesSnap.docs.length} done`); // eslint-disable-line
    } catch (err) {
      /* eslint-disable */
      console.error(
        `Failed to sync property "${propertySnap.id}" metadata | ${err}`
      );
      /* eslint-enable */
    }
  }

  log.info('Completed property metadata sync successfully');
  process.exit();
})();
