const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Deficient Items Create and Delete', () => {
  afterEach(() => cleanDb(db));

  it('should remove all deficient items associated with a deleted inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const otherInspItemId = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create single deficient item on inspection
      template: {
        [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
      }
    });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'required-action' });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).remove(); // remove inspection
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsCreateDelete);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(null, 'removed all inspection deficient items');
  });
});
