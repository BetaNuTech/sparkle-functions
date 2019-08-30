const { db, cloudFunctions, test } = require('./setup'); // eslint-disable-line
const [, , propertyId, deficientItemId, state] = process.argv; // eslint-disable-line
if (!propertyId) throw Error('Property ID not provided');
if (!deficientItemId) throw Error('Deficient Item ID not provided');
if (!state) throw Error('DI state not provided');

(async () => {
  const pubSubMessage = {
    data: Buffer.from(`${propertyId}/${deficientItemId}/state/${state}`),
  };

  await test.wrap(cloudFunctions.trelloCommentsForDefItemStateUpdatesStaging)(
    pubSubMessage
  );

  process.exit();
})();
