const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Inspections | On Write | V2', () => {
  afterEach(() => cleanDb(null, fs));

  it('should not update property meta when non-whitelist attribute changed', async () => {
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
    const inspUpdate = { updatedAt: newest };
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [insp1Id, insp2Id],
      numOfInspections: 0,
      lastInspectionScore: 0,
      lastInspectionDate: 0,
    });
    const final = {
      numOfInspections: 0,
      lastInspectionScore: 0,
      lastInspectionDate: 0,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propData); // Required
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspTwo); // Add inspection #2
    const beforeSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);
    await inspectionsModel.firestoreUpdateRecord(fs, insp2Id, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId: insp1Id } });

    // Test results
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const result = propertyDoc.data();

    // Assertions
    [
      {
        actual: result.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated property's num of inspections",
      },
      {
        actual: result.lastInspectionScore,
        expected: final.lastInspectionScore,
        msg: "updated property's last inspection score",
      },
      {
        actual: result.lastInspectionDate,
        expected: final.lastInspectionDate,
        msg: "updated property's last inspection date",
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it("should update property meta data when inspection's updated last date changes", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Math.round(Date.now() / 1000);
    const oldest = Math.round(Date.now() / 1000) - 1000000;
    const inspOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      updatedLastDate: oldest,
      score: 65,
    });
    const inspUpdate = { updatedLastDate: newest };
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [insp1Id, insp2Id],
    });
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.creationDate,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propData); // Required
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspTwo); // Add inspection #2
    const beforeSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);
    await inspectionsModel.firestoreUpdateRecord(fs, insp1Id, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId: insp1Id } });

    // Test results
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const result = propertyDoc.data();

    // Assertions
    [
      {
        actual: result.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated property's num of inspections",
      },
      {
        actual: result.lastInspectionScore,
        expected: final.lastInspectionScore,
        msg: "updated property's last inspection score",
      },
      {
        actual: result.lastInspectionDate,
        expected: final.lastInspectionDate,
        msg: "updated property's last inspection date",
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it("should update property meta data when inspection's migration date changes", async () => {
    const insp1Id = uuid();
    const insp2Id = uuid();
    const propertyId = uuid();
    const newest = Date.now() / 1000;
    const oldest = Date.now() / 1000 - 100000;
    const inspOne = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: newest,
      migrationDate: oldest,
      score: 65,
    });
    const inspUpdate = { migrationDate: newest };
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest,
      score: 25,
    });
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [insp1Id, insp2Id],
    });
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.creationDate,
    };

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propData); // Required
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspOne); // Add inspection #1
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspTwo); // Add inspection #2
    const beforeSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);
    await inspectionsModel.firestoreUpdateRecord(fs, insp1Id, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId: insp1Id } });

    // Test results
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const result = propertyDoc.data();

    // Assertions
    [
      {
        actual: result.numOfInspections,
        expected: final.numOfInspections,
        msg: "updated property's num of inspections",
      },
      {
        actual: result.lastInspectionScore,
        expected: final.lastInspectionScore,
        msg: "updated property's last inspection score",
      },
      {
        actual: result.lastInspectionDate,
        expected: final.lastInspectionDate,
        msg: "updated property's last inspection date",
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });
});
