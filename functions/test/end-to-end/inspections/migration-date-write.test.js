const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { db, fs, test, cloudFunctions } = require('../../setup');

const { assign } = Object;

describe('Inspections | Migration Date Write', () => {
  afterEach(() => cleanDb(db, fs));

  it("should migrate all an inspections' outdated proxy records", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const inspectionData = {
      templateName: `name${inspectionId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      templateCategory: categoryId,
      updatedLastDate: now,
      inspectionCompleted: true,
      migrationDate: now,
    };

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db
      .ref(`/inspections/${inspectionId}`)
      .set(assign({}, inspectionData, { migrationDate: now - 1000 })); // Add inspection with old migration
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}/migrationDate`)
      .once('value');
    await db.ref(`/inspections/${inspectionId}/migrationDate`).set(now);
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}/migrationDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionMigrationDateWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test Results
    const propertyInspectionProxy = await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .once('value');
    const completedInspectionProxy = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');

    // Assertions
    const expected = assign({}, inspectionData);
    delete expected.property;
    delete expected.migrationDate;
    expect(propertyInspectionProxy.val()).to.deep.equal(
      expected,
      'updated /propertyInspectionsList proxy'
    );

    const expectedCompleted = assign({}, inspectionData);
    delete expectedCompleted.migrationDate;
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    delete expectedCompleted.templateCategory;
    expect(completedInspectionProxy.val()).to.deep.equal(
      expectedCompleted,
      'updated /completedInspectionsList proxy'
    );
  });

  it("should propagate all Inspection data to its' matching Firestore Inspection", async () => {
    const inspId = uuid();
    const propertyId = uuid();
    const now = Math.round(Date.now() / 1000);
    const data = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: now - 100000,
      score: 65,
    });

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, {
      name: 'test',
    }); // Required
    await inspectionsModel.realtimeUpsertRecord(db, inspId, data); // Add inspection #1
    const beforeSnap = await db
      .ref(`/inspections/${inspId}/migrationDate`)
      .once('value');
    await db.ref(`/inspections/${inspId}/migrationDate`).set(now);
    const afterSnap = await db
      .ref(`/inspections/${inspId}/migrationDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionUpdatedLastDateWrite);
    await wrapped(changeSnap, { params: { inspectionId: inspId } });

    // Test results
    const inspSnap = await inspectionsModel.findRecord(db, inspId);
    const inspDoc = await inspectionsModel.firestoreFindRecord(fs, inspId);
    const expected = inspSnap.val();
    const actual = inspDoc.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it("should update property with any meta data from its' completed inspections", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const inspOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
    });
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const propertyData = { name: `name${propertyId}` };
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.creationDate,
      numOfDeficientItems: 0,
      numOfRequiredActionsForDeficientItems: 0,
    };

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspTwo); // Add inspection #2
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData); // Required
    const beforeSnap = await db
      .ref(`/inspections/${insp1Id}/migrationDate`)
      .once('value');
    await db.ref(`/inspections/${insp1Id}/migrationDate`).set(newest);
    const afterSnap = await db
      .ref(`/inspections/${insp1Id}/migrationDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionMigrationDateWrite);
    await wrapped(changeSnap, { params: { inspectionId: insp1Id } });

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
        actual: realtime.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated realtime property's num of inspections",
      },
      {
        actual: firestore.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated firestore property's num of inspections",
      },
      {
        actual: realtime.lastInspectionScore,
        expected: final.lastInspectionScore,
        msg: "updated realtime property's last inspection score",
      },
      {
        actual: firestore.lastInspectionScore,
        expected: final.lastInspectionScore,
        msg: "updated firestore property's last inspection score",
      },
      {
        actual: realtime.lastInspectionDate,
        expected: final.lastInspectionDate,
        msg: "updated realtime property's last inspection date",
      },
      {
        actual: firestore.lastInspectionDate,
        expected: final.lastInspectionDate,
        msg: "updated firestore property's last inspection date",
      },
      {
        actual: realtime.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated realtime property's number of Deficient Items",
      },
      {
        actual: firestore.numOfDeficientItems,
        expected: final.numOfDeficientItems,
        msg: "updated firestore property's number of Deficient Items",
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
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });
});
