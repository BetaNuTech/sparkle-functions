const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const archiveModel = require('../../../models/_internal/archive');
const { cleanDb } = require('../../../test-helpers/firebase');
const { fs, test, cloudFunctions } = require('../../setup');

describe('Inspections | On Delete | V2', () => {
  afterEach(() => cleanDb(null, fs));

  it('archives inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const propData = mocking.createProperty();
    const inspData = mocking.createInspection({ property: propertyId });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propData);
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const snap = await inspectionsModel.firestoreFindRecord(fs, inspectionId);
    await inspectionsModel.firestoreDestroyRecord(fs, inspectionId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDeleteV2);
    await wrapped(snap, { params: { inspectionId } });

    // Test result
    const resultArchive = await archiveModel.inspection.firestoreFindRecord(
      fs,
      inspectionId
    );
    const resultActive = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Assertions
    [
      {
        actual: resultArchive.exists,
        expected: true,
        msg: 'archived inspection',
      },
      {
        actual: resultActive.exists,
        expected: false,
        msg: 'active inspect stays deleted',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should update property meta data when completed inspection is removed', async () => {
    const propertyId = uuid();
    const insp1Id = uuid();
    const insp2Id = uuid();
    const newest = Math.round(Date.now() / 1000);
    const oldest = Math.round(Date.now() / 1000 - 100000);
    const propData = mocking.createProperty({
      inspections: [insp1Id, insp2Id],
    });
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
      template: {
        trackDeficientItems: true,
        items: {
          [uuid()]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });

    // Setup database
    await propertiesModel.firestoreCreateRecord(fs, propertyId, propData);
    await inspectionsModel.firestoreCreateRecord(fs, insp1Id, inspectionOne);
    await inspectionsModel.firestoreCreateRecord(fs, insp2Id, inspectionTwo);
    const snap = await inspectionsModel.firestoreFindRecord(fs, insp1Id);
    await inspectionsModel.firestoreDestroyRecord(fs, insp1Id);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDeleteV2);
    await wrapped(snap, { params: { inspectionId: insp1Id } });

    // Test result
    const propertyDoc = await propertiesModel.firestoreFindRecord(
      fs,
      propertyId
    );
    const result = propertyDoc.data();

    // Assertions
    [
      {
        expected: 1,
        actual: result.numOfInspections,
        msg: "updated property's number of inspections",
      },
      {
        expected: inspectionTwo.score,
        actual: result.lastInspectionScore,
        msg: "updated property's last inspection score",
      },
      {
        expected: inspectionTwo.creationDate,
        actual: result.lastInspectionDate,
        msg: "updated property's last inspection date",
      },
      {
        expected: 1,
        actual: result.numOfDeficientItems,
        msg: "updated property's number of deficient items",
      },
      {
        expected: 1,
        actual: result.numOfRequiredActionsForDeficientItems,
        msg: "updated property's number of required actions",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
