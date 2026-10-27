const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const diModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const archiveModel = require('../../../models/_internal/archive');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('../../setup');

describe('Inspections | On Delete | V2', () => {
  afterEach(() => cleanDb(db));

  it('archives inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const propData = mocking.createProperty();
    const inspData = mocking.createInspection({ property: propertyId });

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propData);
    await inspectionsModel.createRecord(db, inspectionId, inspData);
    const snap = await inspectionsModel.findRecord(db, inspectionId);
    await inspectionsModel.destroyRecord(db, inspectionId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDeleteV2);
    await wrapped(snap, { params: { inspectionId } });

    // Test result
    const resultArchive = await archiveModel.inspection.findRecord(
      db,
      inspectionId
    );
    const resultActive = await inspectionsModel.findRecord(db, inspectionId);

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
      creationDate: newest - 1,
      completionDate: newest,
      score: 65,
    });
    const inspectionTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest - 1,
      completionDate: oldest,
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
    await propertiesModel.createRecord(db, propertyId, propData);
    await inspectionsModel.createRecord(db, insp1Id, inspectionOne);
    await inspectionsModel.createRecord(db, insp2Id, inspectionTwo);
    const snap = await inspectionsModel.findRecord(db, insp1Id);
    await inspectionsModel.destroyRecord(db, insp1Id);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDeleteV2);
    await wrapped(snap, { params: { inspectionId: insp1Id } });

    // Test result
    const propertyDoc = await propertiesModel.findRecord(db, propertyId);
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
        expected: inspectionTwo.completionDate,
        actual: result.lastInspectionDate,
        msg: "updated property's last inspection date",
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should archive all deficiencies associated with a deleted inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const propData = mocking.createProperty();
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
        },
      },
    });
    const deficiencyData = mocking.createDeficiency(
      {
        inspection: inspectionId,
        item: itemId,
        property: propertyId,
      },
      inspData
    );
    const archivedDefData = {
      ...deficiencyData,
      _collection: 'deficiencies',
      archive: true,
    };

    // Setup database
    await propertiesModel.createRecord(db, propertyId, propData);
    await inspectionsModel.createRecord(db, inspectionId, inspData);
    await diModel.createRecord(db, deficiencyId, deficiencyData);
    const snap = await inspectionsModel.findRecord(db, inspectionId);
    await inspectionsModel.removeRecord(db, inspectionId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.inspectionDeleteV2);
    await wrapped(snap, { params: { inspectionId } });

    // Test result
    const activeDeficiencySnap = await diModel.findRecord(db, deficiencyId);
    const archiveDeficiencySnap = await archiveModel.deficientItem.findRecord(
      db,
      deficiencyId
    );

    // Assertions
    [
      {
        actual: activeDeficiencySnap.exists,
        expected: false,
        msg: 'removed active deficiency',
      },
      {
        actual: archiveDeficiencySnap.exists,
        expected: true,
        msg: 'added archived deficiency',
      },
      {
        actual: archiveDeficiencySnap.data() || null,
        expected: archivedDefData,
        msg: 'archived deficiency is cloned from active',
        deep: true,
      },
    ].forEach(({ actual, expected, msg, deep }) => {
      if (deep) {
        expect(actual).to.deep.equal(expected, msg);
      } else {
        expect(actual).to.equal(expected, msg);
      }
    });
  });
});
