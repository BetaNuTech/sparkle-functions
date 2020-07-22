const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const diModel = require('../../../models/deficient-items');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Properties | Meta Sync', () => {
  afterEach(() => cleanDb(db, fs));

  it('should update properties from their completed inspections', async () => {
    const property1Id = uuid();
    const property2Id = uuid();
    const insp1Id = uuid();
    const insp2Id = uuid();
    const insp3Id = uuid();
    const insp4Id = uuid();
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
    const prop1Data = { name: `name${property1Id}` };
    const prop2Data = { name: `name${property2Id}` };
    const insp1Data = mocking.createInspection({
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
    });
    const insp2Data = mocking.createInspection({
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
    });
    const insp3Data = mocking.createInspection({
      property: property2Id,
      inspectionCompleted: true,
      creationDate: newerDate,
      score: newerScore,
    });
    const insp4Data = mocking.createInspection({
      property: property2Id,
      inspectionCompleted: true,
      creationDate: olderDate,
      score: olderScore,
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, property1Id, prop1Data);
    await propertiesModel.realtimeUpsertRecord(db, property1Id, prop1Data);
    await propertiesModel.firestoreCreateRecord(fs, property2Id, prop2Data);
    await propertiesModel.realtimeUpsertRecord(db, property2Id, prop2Data);
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, insp1Data); // for property #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, insp2Data); // for property #1
    await inspectionsModel.firestoreCreateRecord(fs, insp3Id, insp3Data); // for property #2
    await inspectionsModel.firestoreCreateRecord(fs, insp4Id, insp4Data); // for property #2
    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const property1Doc = await propertiesModel.firestoreFindRecord(
      fs,
      property1Id
    );
    const property2Doc = await propertiesModel.firestoreFindRecord(
      fs,
      property2Id
    );
    const firestore1 = property1Doc.data();
    const firestore2 = property2Doc.data();

    // Assertions
    [
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

  it('should update any realtime properties from their completed inspections', async () => {
    const property1Id = uuid();
    const property2Id = uuid();
    const insp1Id = uuid();
    const insp2Id = uuid();
    const insp3Id = uuid();
    const insp4Id = uuid();
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
    const prop1Data = { name: `name${property1Id}` };
    const prop2Data = { name: `name${property2Id}` };
    const insp1Data = mocking.createInspection({
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
    });
    const insp2Data = mocking.createInspection({
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
    });
    const insp3Data = mocking.createInspection({
      property: property2Id,
      inspectionCompleted: true,
      creationDate: newerDate,
      score: newerScore,
    });
    const insp4Data = mocking.createInspection({
      property: property2Id,
      inspectionCompleted: true,
      creationDate: olderDate,
      score: olderScore,
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, property1Id, prop1Data);
    await propertiesModel.realtimeUpsertRecord(db, property1Id, prop1Data);
    await propertiesModel.firestoreCreateRecord(fs, property2Id, prop2Data);
    await propertiesModel.realtimeUpsertRecord(db, property2Id, prop2Data);
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, insp1Data); // for property #1
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, insp1Data); // for property #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, insp2Data); // for property #1
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, insp2Data); // for property #1
    await inspectionsModel.firestoreCreateRecord(fs, insp3Id, insp3Data); // for property #2
    await inspectionsModel.realtimeUpsertRecord(db, insp3Id, insp3Data); // for property #2
    await inspectionsModel.firestoreCreateRecord(fs, insp4Id, insp4Data); // for property #2
    await inspectionsModel.realtimeUpsertRecord(db, insp4Id, insp4Data); // for property #2
    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const property1Snap = await propertiesModel.findRecord(db, property1Id);
    const property2Snap = await propertiesModel.findRecord(db, property2Id);
    const realtime1 = property1Snap.val();
    const realtime2 = property2Snap.val();

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
        actual: realtime1.numOfRequiredActionsForDeficientItems,
        expected: final[property1Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated realtime property one number of required actions',
      },
      {
        actual: realtime2.numOfRequiredActionsForDeficientItems,
        expected: final[property2Id].numOfRequiredActionsForDeficientItems,
        msg: 'updated realtime property two number of required actions',
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it("should update property meta data with latest state from its' deficiencies", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const di1Id = uuid();
    const di2Id = uuid();
    const di3Id = uuid();
    const propertyId = uuid();
    const newest = Math.round(Date.now() / 1000);
    const oldest = newest - 100000;
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
    const di1Data = mocking.createDeficientItem(insp1Id, defItem1Id, {
      state: 'go-back', // non-default required action state
      property: propertyId,
    });
    const di2Data = mocking.createDeficientItem(insp2Id, defItem2Id, {
      state: 'pending',
      property: propertyId,
    }); // remove required action state
    const di3Data = mocking.createDeficientItem(insp2Id, defItem3Id, {
      state: 'completed',
      property: propertyId,
    }); // follow up action state

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData); // Required
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData); // Required
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspTwo); // Add inspection #2
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspTwo); // Add inspection #2
    await diModel.firestoreCreateRecord(fs, di1Id, di1Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di1Id, di1Data);
    await diModel.firestoreCreateRecord(fs, di2Id, di2Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di2Id, di2Data);
    await diModel.firestoreCreateRecord(fs, di3Id, di3Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di3Id, di3Data);

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const firestore = propertyDoc.data();

    // Assertions
    [
      {
        actual: firestore.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated firestore property's num of deficient items",
      },
      {
        actual: firestore.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated firestore property's number of required actions",
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

  it("should update any realtime property meta data with latest state from its' deficiencies", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const di1Id = uuid();
    const di2Id = uuid();
    const di3Id = uuid();
    const propertyId = uuid();
    const newest = Math.round(Date.now() / 1000);
    const oldest = newest - 100000;
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
    const di1Data = mocking.createDeficientItem(insp1Id, defItem1Id, {
      state: 'go-back', // non-default required action state
      property: propertyId,
    });
    const di2Data = mocking.createDeficientItem(insp2Id, defItem2Id, {
      state: 'pending',
      property: propertyId,
    }); // remove required action state
    const di3Data = mocking.createDeficientItem(insp2Id, defItem3Id, {
      state: 'completed',
      property: propertyId,
    }); // follow up action state

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propertyData); // Required
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData); // Required
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspTwo); // Add inspection #2
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspTwo); // Add inspection #2
    await diModel.firestoreCreateRecord(fs, di1Id, di1Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di1Id, di1Data);
    await diModel.firestoreCreateRecord(fs, di2Id, di2Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di2Id, di2Data);
    await diModel.firestoreCreateRecord(fs, di3Id, di3Data);
    await diModel.realtimeUpsertRecord(db, propertyId, di3Id, di3Data);

    // Execute
    await test.wrap(cloudFunctions.propertyMetaSync)();

    // Test results
    const propertySnap = await propertiesModel.findRecord(db, propertyId);
    const realtime = propertySnap.val();

    // Assertions
    [
      {
        actual: realtime.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated realtime property's num of deficient items",
      },
      {
        actual: realtime.numOfRequiredActionsForDeficientItems,
        expected: final.numOfRequiredActionsForDeficientItems,
        msg: "updated realtime property's number of required actions",
      },
      {
        actual: realtime.numOfFollowUpActionsForDeficientItems,
        expected: final.numOfFollowUpActionsForDeficientItems,
        msg: "updated realtime property's number of follow up actions",
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
