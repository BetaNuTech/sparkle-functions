const { db, cloudFunctions, test } = require('./setup'); // eslint-disable-line
const [, , propertyId, deficientItemId] = process.argv; // eslint-disable-line
if (!propertyId) throw Error('Property ID not provided');
if (!deficientItemId) throw Error('Deficient Item ID not provided');

(async () => {
  const beforeSnap = await db
    .ref(
      `/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}/state`
    )
    .once('value'); // Create before
  const afterSnap = await db
    .ref(
      `/propertyInspectionDeficientItems/${propertyId}/${deficientItemId}/state`
    )
    .once('value'); // Create after

  // Execute
  const changeSnap = test.makeChange(beforeSnap, afterSnap);
  const wrapped = test.wrap(
    cloudFunctions.deficientItemsPropertyMetaSyncStaging
  );
  await wrapped(changeSnap, {
    params: {
      propertyId,
      itemId: deficientItemId,
    },
  });
})();
