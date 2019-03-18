const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Property Meta Sync', () => {
  afterEach(() => cleanDb(db));

  it('should update properties from their completed inspections', async () => {
    const property1Id = uuid();
    const property2Id = uuid();
    const newerDate = (Date.now() / 1000);
    const olderDate = (Date.now() / 1000) - 100000;
    const newerScore = 65;
    const olderScore = 25;
    const expected = {
      numOfInspections: 2,
      lastInspectionScore: newerScore,
      lastInspectionDate: newerDate
    };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: `name${property1Id}` }); // required
    await db.ref(`/properties/${property2Id}`).set({ name: `name${property2Id}` }); // required
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property1Id, inspectionCompleted: true, creationDate: newerDate, score: newerScore })); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property1Id, inspectionCompleted: true, creationDate: olderDate, score: olderScore })); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property2Id, inspectionCompleted: true, creationDate: newerDate, score: newerScore })); // Add property #2 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property2Id, inspectionCompleted: true, creationDate: olderDate, score: olderScore })); // Add property #2 inspection

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyMetaSync);
    await wrapped();

    // Test result
    const propertiesSnap = await db.ref(`/properties`).once('value');
    const results = propertiesSnap.val();

    // Assertions
    Object.keys(results).forEach(actual => {
      expect(actual.numOfInspections).to.equal(
        expected.numOfInspections,
        'updated property\'s `numOfInspections`'
      );
      expect(actual.lastInspectionScore).to.equal(
        expected.lastInspectionScore,
        'updated property\'s `lastInspectionScore`'
      );
      expect(actual.lastInspectionDate).to.equal(
        expected.lastInspectionDate,
        'updated property\'s `lastInspectionDate`'
      );
    });
  });

  it('should not update deleted properties when their inspections still exist', async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const inspectionData = {
      templateName: `name${inspId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now,
      inspectionCompleted: true
    };

    // Setup database
    await db.ref(`/inspections/${inspId}`).set(inspectionData);

    // Execute
    const wrapped = test.wrap(cloudFunctions.propertyMetaSync);
    await wrapped();

    // Test result
    const actual = await Promise.all([
      db.ref(`/properties/${propertyId}/numOfInspections`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionScore`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionDate`).once('value')
    ]);

    // Assertions
    expect(actual.map(attr => attr.val())).to.deep.equal([null, null, null]);
  });
});
