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
      [property1Id]: {
        numOfInspections: 2,
        lastInspectionScore: newerScore,
        lastInspectionDate: newerDate,
        numOfDeficientItems: 2,
        numOfRequiredActionsForDeficientItems: 2
      },
      [property2Id]: {
        numOfInspections: 2,
        lastInspectionScore: newerScore,
        lastInspectionDate: newerDate,
        numOfDeficientItems: 0,
        numOfRequiredActionsForDeficientItems: 0
      }
    };

    // Setup database
    await db.ref(`/properties/${property1Id}`).set({ name: `name${property1Id}` }); // required
    await db.ref(`/properties/${property2Id}`).set({ name: `name${property2Id}` }); // required
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({
      property: property1Id,
      inspectionCompleted: true,
      creationDate: newerDate,
      score: newerScore,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: { [uuid()]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) }
      }
    })); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({
      property: property1Id,
      inspectionCompleted: true,
      creationDate: olderDate,
      score: olderScore,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: { [uuid()]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) }
      }
    })); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property2Id, inspectionCompleted: true, creationDate: newerDate, score: newerScore })); // Add property #2 inspection
    await db.ref(`/inspections/${uuid()}`).set(mocking.createInspection({ property: property2Id, inspectionCompleted: true, creationDate: olderDate, score: olderScore })); // Add property #2 inspection

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test result
    const propertiesSnap = await db.ref(`/properties`).once('value');
    const results = propertiesSnap.val();

    // Assertions
    Object.keys(results).forEach((propertyId, i) => {
      const actual = results[propertyId];
      const {
        numOfInspections,
        lastInspectionScore,
        lastInspectionDate,
        numOfDeficientItems,
        numOfRequiredActionsForDeficientItems
      } = expected[propertyId];
      expect(actual.numOfInspections).to.equal(
        numOfInspections,
        'updated property\'s `numOfInspections`'
      );
      expect(actual.lastInspectionScore).to.equal(
        lastInspectionScore,
        'updated property\'s `lastInspectionScore`'
      );
      expect(actual.lastInspectionDate).to.equal(
        lastInspectionDate,
        'updated property\'s `lastInspectionDate`'
      );
      expect(actual.numOfDeficientItems).to.equal(
        numOfDeficientItems,
        'updated property\'s `numOfDeficientItems`'
      );
      expect(actual.numOfRequiredActionsForDeficientItems).to.equal(
        numOfRequiredActionsForDeficientItems,
        'updated property\'s `numOfRequiredActionsForDeficientItems`'
      );
    });
  });

  it('should update property meta data with latest state from its\' deficient items record', async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = (Date.now() / 1000);
    const oldest = (Date.now() / 1000) - 100000;
    const defItem1Id = uuid();
    const inspectionOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: { [defItem1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) }
      }
    });
    const defItem2Id = uuid();
    const inspectionTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: { [defItem2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) }
      }
    });
    const expected = {
      numOfRequiredActionsForDeficientItems: 1 // updated via latest state from `/propertyInspectionDeficientItems`
    };

    // Setup database
    await db.ref(`/properties/${propertyId}`).set({ name: `name${propertyId}` }); // required
    await db.ref(`/inspections/${insp1Id}`).set(inspectionOne); // Add inspection #1
    await db.ref(`/inspections/${insp2Id}`).set(inspectionTwo); // Add inspection #2
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${insp1Id}/${defItem1Id}`).set(mocking.createDeficientItem({ state: 'go-back' })); // non-default required action state
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${insp2Id}/${defItem2Id}`).set(mocking.createDeficientItem({ state: 'pending' })); // remove required action state
    const snap = await db.ref(`/inspections/${insp1Id}`).once('value'); // Create snapshot

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test result
    const propertySnap = await db.ref(`/properties/${propertyId}`).once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(actual.numOfRequiredActionsForDeficientItems).to.equal(
      expected.numOfRequiredActionsForDeficientItems,
      'updated property\'s `numOfRequiredActionsForDeficientItems`'
    );
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
    await test.wrap(cloudFunctions.propertyMetaSync)();

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
