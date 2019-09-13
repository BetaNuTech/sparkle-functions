const { db, cloudFunctions, test } = require('./setup'); // eslint-disable-line
const [, , inspectionId] = process.argv; // eslint-disable-line
if (!inspectionId) throw Error('Inspection ID not provided');

(async () => {
  const beforeSnap = await db
    .ref(`/inspections/${inspectionId}/updatedLastDate`)
    .once('value'); // Create before
  const afterSnap = await db
    .ref(`/inspections/${inspectionId}/updatedLastDate`)
    .once('value'); // Create after

  // Execute
  const changeSnap = test.makeChange(beforeSnap, afterSnap);
  const wrapped = test.wrap(cloudFunctions.deficientItemsWriteStaging);
  await wrapped(changeSnap, {
    params: { inspectionId },
  });

  process.exit();
})();
