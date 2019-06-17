const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

const { assign } = Object;

describe('Inspections Migration Date Write', () => {
  afterEach(() => cleanDb(db));

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
    const propertyInspection = await db
      .ref(`/propertyInspections/${propertyId}/inspections/${inspectionId}`)
      .once('value');
    const propertyInspectionList = await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .once('value');
    const completedInspection = await db
      .ref(`/completedInspections/${inspectionId}`)
      .once('value');
    const completedInspectionList = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');

    // Assertions
    const expected = assign({}, inspectionData);
    delete expected.property;
    delete expected.migrationDate;
    expect(propertyInspection.val()).to.deep.equal(
      expected,
      'updated /propertyInspections proxy'
    );
    expect(propertyInspectionList.val()).to.deep.equal(
      expected,
      'updated /propertyInspectionsList proxy'
    );

    const expectedCompleted = assign({}, inspectionData);
    delete expectedCompleted.migrationDate;
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    delete expectedCompleted.templateCategory;
    expect(completedInspection.val()).to.deep.equal(
      expectedCompleted,
      'updated /completedInspections proxy'
    );
    expect(completedInspectionList.val()).to.deep.equal(
      expectedCompleted,
      'updated /completedInspectionsList proxy'
    );
  });

  it("should update property with any meta data from its' completed inspections", async () => {
    const inspection1Id = uuid();
    const inspection2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const inspectionOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      score: 65,
    });
    const inspectionTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const expected = {
      numOfInspections: 2,
      lastInspectionScore: inspectionOne.score,
      lastInspectionDate: inspectionOne.creationDate,
      numOfDeficientItems: 0,
      numOfRequiredActionsForDeficientItems: 0,
    };

    // Setup database
    await db.ref(`/inspections/${inspection1Id}`).set(inspectionOne); // Add inspection #1
    await db.ref(`/inspections/${inspection2Id}`).set(inspectionTwo); // Add inspection #2
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    const beforeSnap = await db
      .ref(`/inspections/${inspection1Id}/updatedLastDate`)
      .once('value');
    await db.ref(`/inspections/${inspection1Id}/updatedLastDate`).set(newest);
    const afterSnap = await db
      .ref(`/inspections/${inspection1Id}/updatedLastDate`)
      .once('value');

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionMigrationDateWrite);
    await wrapped(changeSnap, { params: { inspectionId: inspection1Id } });

    // Test results
    const propertySnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value');
    const actual = propertySnap.val();

    // Assertions
    expect(actual.numOfInspections).to.equal(
      expected.numOfInspections,
      "updated property's `numOfInspections`"
    );
    expect(actual.lastInspectionScore).to.equal(
      expected.lastInspectionScore,
      "updated property's `lastInspectionScore`"
    );
    expect(actual.lastInspectionDate).to.equal(
      expected.lastInspectionDate,
      "updated property's `lastInspectionDate`"
    );
    expect(actual.numOfDeficientItems).to.equal(
      expected.numOfDeficientItems,
      "updated property's `numOfDeficientItems`"
    );
    expect(actual.numOfRequiredActionsForDeficientItems).to.equal(
      expected.numOfRequiredActionsForDeficientItems,
      "updated property's `numOfRequiredActionsForDeficientItems`"
    );
  });
});
