const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Properties | Meta Sync', () => {
  afterEach(() => cleanDb(db, fs));

  it('should update properties from their completed inspections', async () => {
    const property1Id = uuid();
    const property2Id = uuid();
    const newerDate = Date.now() / 1000;
    const olderDate = Date.now() / 1000 - 100000;
    const newerScore = 65;
    const olderScore = 25;
    const final = {
      [property1Id]: {
        numOfInspections: 2,
        lastInspectionScore: newerScore,
        lastInspectionDate: newerDate,
        numOfDeficientItems: 2,
        numOfRequiredActionsForDeficientItems: 2,
      },
      [property2Id]: {
        numOfInspections: 2,
        lastInspectionScore: newerScore,
        lastInspectionDate: newerDate,
        numOfDeficientItems: 0,
        numOfRequiredActionsForDeficientItems: 0,
      },
    };

    // Setup database
    await db
      .ref(`/properties/${property1Id}`)
      .set({ name: `name${property1Id}` }); // required
    await db
      .ref(`/properties/${property2Id}`)
      .set({ name: `name${property2Id}` }); // required
    await db.ref(`/inspections/${uuid()}`).set(
      mocking.createInspection({
        property: property1Id,
        inspectionCompleted: true,
        creationDate: newerDate,
        score: newerScore,
        template: {
          trackDeficientItems: true,

          // Create template w/ 1 deficient item
          items: {
            [uuid()]: mocking.createCompletedMainInputItem(
              'twoactions_checkmarkx',
              true
            ),
          },
        },
      })
    ); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(
      mocking.createInspection({
        property: property1Id,
        inspectionCompleted: true,
        creationDate: olderDate,
        score: olderScore,
        template: {
          trackDeficientItems: true,

          // Create template w/ 1 deficient item
          items: {
            [uuid()]: mocking.createCompletedMainInputItem(
              'twoactions_checkmarkx',
              true
            ),
          },
        },
      })
    ); // Add property #1 inspection
    await db.ref(`/inspections/${uuid()}`).set(
      mocking.createInspection({
        property: property2Id,
        inspectionCompleted: true,
        creationDate: newerDate,
        score: newerScore,
      })
    ); // Add property #2 inspection
    await db.ref(`/inspections/${uuid()}`).set(
      mocking.createInspection({
        property: property2Id,
        inspectionCompleted: true,
        creationDate: olderDate,
        score: olderScore,
      })
    ); // Add property #2 inspection

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const property1Snap = await propertiesModel.findRecord(db, property1Id);
    const property2Snap = await propertiesModel.findRecord(db, property2Id);
    const property1Doc = await propertiesModel.firestoreFindRecord(
      fs,
      property1Id
    );
    const property2Doc = await propertiesModel.firestoreFindRecord(
      fs,
      property2Id
    );
    const realtime1 = property1Snap.val();
    const realtime2 = property2Snap.val();
    const firestore1 = property1Doc.data();
    const firestore2 = property2Doc.data();

    // Assertions
    [
      {
        actual: realtime1.numOfInspections,
        expected: final[property1Id].numOfInspections,
        msg: 'updated realtime property one num of inspections',
      },
      {
        actual: realtime2.numOfInspections,
        expected: final[property2Id].numOfInspections,
        msg: 'updated realtime property two num of inspections',
      },
      {
        actual: firestore1.numOfInspections,
        expected: final[property1Id].numOfInspections,
        msg: 'updated firestore property one num of inspections',
      },
      {
        actual: firestore2.numOfInspections,
        expected: final[property2Id].numOfInspections,
        msg: 'updated firestore property two num of inspections',
      },
      {
        actual: realtime1.lastInspectionScore,
        expected: final[property1Id].lastInspectionScore,
        msg: 'updated realtime property one last inspection score',
      },
      {
        actual: realtime2.lastInspectionScore,
        expected: final[property2Id].lastInspectionScore,
        msg: 'updated realtime property two last inspection score',
      },
      {
        actual: firestore1.lastInspectionScore,
        expected: final[property1Id].lastInspectionScore,
        msg: 'updated firestore property one last inspection score',
      },
      {
        actual: firestore2.lastInspectionScore,
        expected: final[property2Id].lastInspectionScore,
        msg: 'updated firestore property two last inspection score',
      },
      {
        actual: realtime1.lastInspectionDate,
        expected: final[property1Id].lastInspectionDate,
        msg: 'updated realtime property one last inspection date',
      },
      {
        actual: realtime2.lastInspectionDate,
        expected: final[property2Id].lastInspectionDate,
        msg: 'updated realtime property two last inspection date',
      },
      {
        actual: firestore1.lastInspectionDate,
        expected: final[property1Id].lastInspectionDate,
        msg: 'updated firestore property one last inspection date',
      },
      {
        actual: firestore2.lastInspectionDate,
        expected: final[property2Id].lastInspectionDate,
        msg: 'updated firestore property two last inspection date',
      },
      {
        actual: realtime1.numOfDeficientItems,
        expected: final[property1Id].numOfDeficientItems,
        msg: 'updated realtime property one number of Deficient Items',
      },
      {
        actual: realtime2.numOfDeficientItems,
        expected: final[property2Id].numOfDeficientItems,
        msg: 'updated realtime property two number of Deficient Items',
      },
      {
        actual: firestore1.numOfDeficientItems,
        expected: final[property1Id].numOfDeficientItems,
        msg: 'updated firestore property one number of Deficient Items',
      },
      {
        actual: firestore2.numOfDeficientItems,
        expected: final[property2Id].numOfDeficientItems,
        msg: 'updated firestore property two number of Deficient Items',
      },
      {
        actual: realtime1.numOfRequiredActionsForDeficientItems,
        expected: final[property1Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated realtime property one number of required actions',
      },
      {
        actual: realtime2.numOfRequiredActionsForDeficientItems,
        expected: final[property2Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated realtime property two number of required actions',
      },
      {
        actual: firestore1.numOfRequiredActionsForDeficientItems,
        expected: final[property1Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated firestore property one number of required actions',
      },
      {
        actual: firestore2.numOfRequiredActionsForDeficientItems,
        expected: final[property2Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated firestore property two number of required actions',
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it("should update property meta data with latest state from its' deficient items record", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const defItem1Id = uuid();
    const defItem2Id = uuid();
    const defItem3Id = uuid();
    const inspOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
      template: {
        trackDeficientItems: true,

        // Create template w/ 1 deficient item
        items: {
          [defItem1Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
      template: {
        trackDeficientItems: true,

        // Create template w/ 2 deficient items
        items: {
          [defItem2Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
          [defItem3Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });
    const propertyData = { name: `name${propertyId}` };
    const final = {
      numOfDeficientItems: 3,
      numOfRequiredActionsForDeficientItems: 1,
      numOfFollowUpActionsForDeficientItems: 1,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData); // Required
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspTwo); // Add inspection #2

    await db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push()
      .set(
        mocking.createDeficientItem(insp1Id, defItem1Id, { state: 'go-back' })
      ); // non-default required action state
    await db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push()
      .set(
        mocking.createDeficientItem(insp2Id, defItem2Id, { state: 'pending' })
      ); // remove required action state
    await db
      .ref(`/propertyInspectionDeficientItems/${propertyId}`)
      .push()
      .set(
        mocking.createDeficientItem(insp2Id, defItem3Id, { state: 'completed' })
      ); // follow up action state

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const propertySnap = await propertiesModel.findRecord(db, propertyId);
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const realtime = propertySnap.val();
    const firestore = propertyDoc.data();

    // Assertions
    [
      {
        actual: realtime.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated realtime property's num of deficient items",
      },
      {
        actual: firestore.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated firestore property's num of deficient items",
      },
      {
        actual: realtime.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated realtime property's number of required actions",
      },
      {
        actual: firestore.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated firestore property's number of required actions",
      },
      {
        actual: realtime.numOfFollowUpActionsForDeficientItems,
        expected: final.numOfFollowUpActionsForDeficientItems,
        msg: "updated realtime property's number of follow up actions",
      },
      {
        actual: firestore.numOfFollowUpActionsForDeficientItems,
        expected: final.numOfFollowUpActionsForDeficientItems,
        msg: "updated firestore property's number of follow up actions",
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
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
      inspectionCompleted: true,
    };

    // Setup database
    await db.ref(`/inspections/${inspId}`).set(inspectionData);

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test result
    const actual = await Promise.all([
      db.ref(`/properties/${propertyId}/numOfInspections`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionScore`).once('value'),
      db.ref(`/properties/${propertyId}/lastInspectionDate`).once('value'),
    ]);

    // Assertions
    expect(actual.map(attr => attr.val())).to.deep.equal([null, null, null]);
  });
});
