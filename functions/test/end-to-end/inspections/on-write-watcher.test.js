const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const inspectionData = require('../../../test-helpers/mocks/inspection');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Inspections | On Write Watcher', () => {
  afterEach(() => cleanDb(db, fs));

  it('should set an invalid score value to zero', async () => {
    const inspectionId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspectionId}`,
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
    const afterData = Object.assign({}, beforeData, { score: null });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db.ref(`/completedInspectionsList/${inspectionId}`).set(beforeData); // Add completedInspectionsList
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .set(beforeData); // Add propertyInspectionsList
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).update(afterData); // set invalid score
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const paths = [
      `/completedInspectionsList/${inspectionId}/score`,
      `/propertyInspectionsList/${propertyId}/inspections/${inspectionId}/score`,
    ];
    const results = await Promise.all(paths.map(p => db.ref(p).once('value')));

    // Assertions
    results.forEach((scoreSnap, i) => {
      const actual = scoreSnap.val();
      expect(actual).to.equal(0, `test for ${paths[i]} set score to 0`);
    });
  });

  it("should update inspections' proxy record with new data", async () => {
    const inspectionId = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspectionId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: true,
    };

    const afterData = Object.assign({}, beforeData, {
      templateName: `name${inspectionId}--rev2`,
      inspectorName: 'testor--rev2',
      score: 8,
      templateCategory: categoryId,
      deficienciesExist: true,
      updatedLastDate: now,
    });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // Add inspections' category
    await db.ref(`/completedInspectionsList/${inspectionId}`).set(beforeData); // Add completedInspections
    await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .set(beforeData); // Add propertyInspectionsList
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).update(afterData); // Remove inspection
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const propertyInspectionProxy = await db
      .ref(`/propertyInspectionsList/${propertyId}/inspections/${inspectionId}`)
      .once('value');
    const completedInspectionProxy = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');

    // Assertions
    const expected = Object.assign({}, afterData);
    delete expected.property;
    expect(propertyInspectionProxy.val()).to.deep.equal(
      expected,
      'updated /propertyInspectionsList proxy'
    );

    const expectedCompleted = Object.assign({}, afterData);
    delete expectedCompleted.itemsCompleted;
    delete expectedCompleted.totalItems;
    delete expectedCompleted.templateCategory;
    expect(completedInspectionProxy.val()).to.deep.equal(
      expectedCompleted,
      'updated /completedInspectionsList proxy'
    );
  });

  it("should update inspection's proxy record when inspection becomes completed", async () => {
    const inspectionId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspectionId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 9,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false,
    };

    const afterData = Object.assign({}, beforeData, {
      itemsCompleted: 10,
      updatedLastDate: now,
      inspectionCompleted: true,
    });

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: `name${propertyId}` }); // required
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).update(afterData); // Update inspection
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const result = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');
    const actual = result.val();

    // Assertions
    const expected = Object.assign({}, afterData);
    delete expected.itemsCompleted;
    delete expected.totalItems;
    expect(actual).to.deep.equal(expected);
  });

  it('should ensure an incomplete inspection does not have a completed proxy record', async () => {
    const inspectionId = uuid();
    const propertyId = uuid();
    const now = Date.now() / 1000;
    const beforeData = {
      templateName: `name${inspectionId}`,
      inspector: '23423423',
      inspectorName: 'testor',
      creationDate: now - 100000,
      score: 10,
      deficienciesExist: false,
      itemsCompleted: 10,
      totalItems: 10,
      property: propertyId,
      updatedLastDate: now - 1000,
      inspectionCompleted: false,
    };

    const afterData = Object.assign({}, beforeData, { updatedLastDate: now });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).update(afterData); // Update inspection
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const result = await db
      .ref(`/completedInspectionsList/${inspectionId}`)
      .once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it("should update property with any meta data from its' completed inspections", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const inspectionBase = {
      property: propertyId,
      inspectionCompleted: true,
    };
    const inspOne = mocking.createInspection(
      Object.assign(
        {
          creationDate: newest,
          score: 65,
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
        },
        inspectionBase
      )
    );
    const inspTwo = mocking.createInspection(
      Object.assign(
        {
          creationDate: oldest,
          score: 25,
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
        },
        inspectionBase
      )
    );
    const propertyData = { name: `name${propertyId}` };
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.creationDate,
      numOfDeficientItems: 2,
      numOfRequiredActionsForDeficientItems: 2,
    };

    // Setup database
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propertyData); // required
    await inspectionsModel.realtimeUpsertRecord(db, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.realtimeUpsertRecord(db, insp2Id, inspTwo); // Add inspection #2
    const snap = await inspectionsModel.findRecord(db, insp1Id); // Create snapshot

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
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

  it('should create a firestore inspection when an inspection is created', async () => {
    const inspectionId = uuid();
    const expected = JSON.parse(JSON.stringify(inspectionData));

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, expected); // Create Realtime
    const snap = await inspectionsModel.findRecord(db, inspectionId);

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test results
    const result = await inspectionsModel.firestoreFindRecord(fs, inspectionId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update an existing firestore inspection when an inspection is updated', async () => {
    const inspectionId = uuid();
    const data = JSON.parse(JSON.stringify(inspectionData));
    const expected = { ...data };
    expected.templateCategory = '';

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, data); // Create Realtime
    await inspectionsModel.firestoreUpsertRecord(fs, inspectionId, data); // Create Firestore
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, expected); // Update Realtime
    const snap = await inspectionsModel.findRecord(db, inspectionId);

    // Execute
    const changeSnap = test.makeChange(snap, snap);
    const wrapped = test.wrap(cloudFunctions.inspectionWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test results
    const result = await inspectionsModel.firestoreFindRecord(fs, inspectionId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
