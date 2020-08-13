const { expect } = require('chai');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const diModel = require('../../../models/deficient-items');
const archiveModel = require('../../../models/_internal/archive');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const { fs, test, cloudFunctions } = require('../../setup');

const DEFICIENT_ITEM_PROXY_ATTRS =
  config.deficientItems.inspectionItemProxyAttrsV2;
const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

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
      creationDate: newest - 1,
      completionDate: newest,
      updatedLastDate: oldest,
      score: 65,
    });
    const inspUpdate = { updatedLastDate: newest };
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest - 1,
      completionDate: oldest,
      score: 25,
    });
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [insp1Id, insp2Id],
    });
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.completionDate,
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
      creationDate: newest - 1,
      completionDate: newest,
      migrationDate: oldest,
      score: 65,
    });
    const inspUpdate = { migrationDate: newest };
    const inspTwo = mocking.createInspection({
      property: propertyId,
      inspectionCompleted: true,
      creationDate: oldest - 1,
      completionDate: oldest,
      score: 25,
    });
    const propData = mocking.createProperty({
      name: `name${propertyId}`,
      inspections: [insp1Id, insp2Id],
    });
    const final = {
      numOfInspections: 2,
      lastInspectionScore: inspOne.score,
      lastInspectionDate: inspOne.completionDate,
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

  it('should archive each deficient item that belongs to an approved inspection items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const def1Id = uuid();
    const def2Id = uuid();
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        trackDeficientItems: true,
        items: {
          [item1Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true,
            { mainInputSelection: 1 }
          ), // target to make non-deficient
          [item2Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true,
            { mainInputSelection: 1 }
          ),
        },
      },
    });
    const unchangedDeficiency = mocking.createDeficiency(
      {
        state: 'requires-action',
        property: propertyId,
        inspection: inspectionId,
        item: item2Id,
        itemMainInputSelection: 1,
      },
      inspData
    );
    const archivedDeficiency = mocking.createDeficiency(
      {
        state: 'requires-action',
        property: propertyId,
        inspection: inspectionId,
        item: item1Id,
        itemMainInputSelection: 1,
      },
      inspData
    );
    const inspUpdate = {
      // Mark 1st item as non-deficient
      [`template.items.${item1Id}`]: mocking.createCompletedMainInputItem(
        'twoactions_checkmarkx',
        false
      ),
    };

    // Setup database
    await diModel.firestoreCreateRecord(fs, def1Id, unchangedDeficiency);
    await diModel.firestoreCreateRecord(fs, def2Id, archivedDeficiency);
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const propertyDefSnap = await diModel.firestoreQueryByProperty(
      fs,
      propertyId
    );
    const archiveDefSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      def2Id
    );
    const archiveData = archiveDefSnap.data() || {};
    delete archiveData._collection;
    delete archiveData.archive;

    // Assertions
    [
      {
        actual: propertyDefSnap.size,
        expected: 1,
        msg: 'property only has 1 active deficiency',
      },
      {
        actual: archiveDefSnap.exists,
        expected: true,
        msg: 'added archived deficiency',
      },
      {
        actual: archiveData,
        expected: archivedDeficiency,
        msg: 'archived deficiency is cloned from active',
        deep: true,
      },
    ].forEach(({ actual, expected, msg, deep = false }) => {
      if (deep) {
        expect(actual).to.deep.equal(expected, msg);
      } else {
        expect(actual).to.equal(expected, msg);
      }
    });
  });

  it('should create new deficient items for a newly deficient inspection items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      template: {
        trackDeficientItems: true,
        items: {
          // Create two NON-deficient items on inspection
          [item1Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
          [item2Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
        },
      },
    });
    const inspUpdate = {
      // Mark 1st & 2nd item as deficient
      'template.items': {
        [item1Id]: mocking.createCompletedMainInputItem(
          'twoactions_checkmarkx',
          true
        ),
        [item2Id]: mocking.createCompletedMainInputItem(
          'twoactions_checkmarkx',
          true
        ),
      },
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const result = await diModel.firestoreQueryByProperty(fs, propertyId);

    // Assertions
    [
      {
        actual: Boolean(
          result.docs.filter(doc => doc.exists && doc.data().item === item1Id)
            .length
        ),
        expected: true,
        msg: 'created inspection item 1 deficiency',
      },
      {
        actual: Boolean(
          result.docs.filter(doc => doc.exists && doc.data().item === item2Id)
            .length
        ),
        expected: true,
        msg: 'created inspection item 2 deficiency',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should restore an archived deficiency for an inspection item made deficient a 2nd time', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const defId = uuid();
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create two NON-deficient items on inspection
          [item1Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
          [item2Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ),
        },
      },
    });
    const defInspItem = mocking.createCompletedMainInputItem(
      'twoactions_checkmarkx',
      true
    );
    const defData = mocking.createDeficiency(
      {
        createdAt: Math.round(Date.now() / 1000) - 100000,
        property: propertyId,
        inspection: inspectionId,
        item: item1Id,
        itemMainInputSelection: 1,
      },
      null,
      defInspItem
    );
    defData.archive = true;
    const inspUpdate = {
      // Mark 1st & 2nd item as deficient
      'template.items': {
        [item1Id]: defInspItem,
        [item2Id]: defInspItem,
      },
    };

    // Setup database
    await archiveModel.deficientItem.firestoreCreateRecord(fs, defId, defData);
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const archivedDoc = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      defId
    );
    const propertyDeficiencies = await diModel.firestoreQueryByProperty(
      fs,
      propertyId
    );
    const [restoredDeficiencyDoc] = propertyDeficiencies.docs.filter(
      ({ id }) => id === defId
    );
    const [newDeficiencyDoc] = propertyDeficiencies.docs.filter(
      ({ id }) => id !== defId
    );

    // Assertions
    [
      {
        actual: archivedDoc.exists,
        expected: false,
        msg: 'Removed archived deficiency',
      },
      {
        actual: (newDeficiencyDoc.data() || {}).item || '',
        expected: item2Id,
        msg: 'created new active deficiency for 2nd item',
      },
      {
        actual: restoredDeficiencyDoc.exists,
        expected: true,
        msg: 'Restored archived deficiency to active',
      },
      {
        actual: restoredDeficiencyDoc.data(),
        expected: defData,
        msg: 'Restored active deficiency data was cloned from archive',
        deep: true,
      },
    ].forEach(({ actual, expected, msg, deep = false }) => {
      if (deep) {
        expect(actual).to.deep.equal(expected, msg);
      } else {
        expect(actual).to.equal(expected, msg);
      }
    });
  });

  it('should update deficiency proxy attributes out of sync with their inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemTextValueId = uuid();
    const sectionId = uuid();
    const inspData = Object.freeze(
      mocking.createInspection({
        deficienciesExist: true,
        inspectionCompleted: true,
        property: propertyId,

        template: {
          trackDeficientItems: true,
          items: {
            // First item text input (sub title target)
            [itemTextValueId]: mocking.createItem({
              sectionId,
              itemType: 'text_input',
              index: 0, // required
              textInputValue: 'initial',
            }),

            // Create single deficient item on inspection
            [itemId]: mocking.createCompletedMainInputItem(
              'fiveactions_onetofive',
              true,
              {
                mainInputSelection: 0, // Deficient selection
                sectionId,
                index: 1, // required
              }
            ),
          },
          sections: { [sectionId]: { section_type: 'multi' } }, // required for sectionSubtitle
        },
      })
    );
    const updates = Object.freeze({
      sectionSubtitle: 'updated',
      itemMainInputSelection: 1, // New deficient item eligible score
    });

    // List of all proxy attrs synced to source item
    const diAttrNames = Object.keys(DEFICIENT_ITEM_PROXY_ATTRS);

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute to add deficiency
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Lookup created deficiency id
    const deficienciesSnap = await diModel.firestoreQuery(fs, {
      property: ['==', propertyId],
      inspection: ['==', inspectionId],
      item: ['==', itemId],
    });
    const [originalDeficiencyDoc] = deficienciesSnap.docs.filter(Boolean);
    expect(originalDeficiencyDoc.exists).to.equal(
      true,
      'created new deficiency'
    );
    const deficiencyId = originalDeficiencyDoc.id;
    let lastUpdatedAt = originalDeficiencyDoc.data().updatedAt - 1;

    // Test update of each proxy attribute
    for (let i = 0; i < diAttrNames.length; i++) {
      const diAttr = diAttrNames[i];
      const sourceAttr = DEFICIENT_ITEM_PROXY_ATTRS[diAttr];
      const expected = updates[diAttr];
      expect(
        expected,
        `test configured for Deficiency proxy attribute ${diAttr}`
      ).to.be.ok;

      const inspUpdate = {};
      if (diAttr === 'sectionSubtitle') {
        // Update 1st text input item's value in source item's multi-section
        inspUpdate[
          `template.items.${itemTextValueId}.${sourceAttr}`
        ] = expected;
      } else {
        // Update source item's proxyable attribute
        inspUpdate[`template.items.${itemId}.${sourceAttr}`] = expected;
      }

      const beforeUpdateSnap = await inspectionsModel.firestoreFindRecord(
        fs,
        inspectionId
      );
      await inspectionsModel.firestoreUpdateRecord(
        fs,
        inspectionId,
        inspUpdate
      );
      const afterUpdateSnap = await inspectionsModel.firestoreFindRecord(
        fs,
        inspectionId
      );

      // Execute again for update
      const updateChangeSnap = test.makeChange(
        beforeUpdateSnap,
        afterUpdateSnap
      );
      const wrappedUpdate = test.wrap(cloudFunctions.inspectionWriteV2);
      await wrappedUpdate(updateChangeSnap, { params: { inspectionId } });

      // Test result
      const updatedSnap = await diModel.firestoreFindRecord(fs, deficiencyId);
      const actual = (updatedSnap.data() || {})[diAttr];
      const newUpdatedAt = (updatedSnap.data() || {}).updatedAt || 0;

      // Assertions
      expect(actual).to.equal(expected, `updated proxy attribute "${diAttr}"`);
      expect(newUpdatedAt > lastUpdatedAt).to.equal(true, 'set new updated at');
      lastUpdatedAt = newUpdatedAt - 1;
    }
  });

  it("should create a deficiency score from it's source items' score", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemType = 'fiveactions_onetofive';
    const expected = 9999; // create custom inspection item value
    const sufficientSelectionIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(
      false
    );
    const deficientSelectionIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(
      true
    );
    const customScoreName = ITEM_VALUE_NAMES[deficientSelectionIndex];
    const itemConfig = {
      mainInputSelection: sufficientSelectionIndex,
      [customScoreName]: expected, // customize item score
    };
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            itemType,
            false, // Create non-deficient item
            itemConfig // Created with sufficient selection
          ),
        },
      },
    });
    // Make inspection item deficient w/ custom score
    const inspUpdate = {
      [`template.items.${itemId}.mainInputSelection`]: deficientSelectionIndex,
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const deficientDocs = await diModel.firestoreQuery(fs, {
      property: ['==', propertyId],
    });
    const [deficientDoc] = deficientDocs.docs.filter(Boolean);
    const actual = (deficientDoc.data() || {}).itemScore || 0;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it("should update deficiency score with it's source items' new score", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const itemType = 'fiveactions_onetofive';
    const itemUpdatedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
      true
    ); // get last deficient eligible index
    const customScoreName = ITEM_VALUE_NAMES[itemUpdatedIndex];
    const expected = 9999; // create custom inspection item value
    const itemInitIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(true);
    const itemConfig = {
      mainInputSelection: itemInitIndex,
      [customScoreName]: expected, // customize item score
    };
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            itemType,
            true, // Create one new deficient item
            itemConfig
          ),
        },
      },
    });
    const deficientData = mocking.createDeficiency(
      {
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
      },
      inspData
    );
    const inspUpdate = {
      [`template.items.${itemId}.mainInputSelection`]: itemUpdatedIndex,
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficientData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultDoc = await diModel.firestoreFindRecord(fs, deficiencyId);
    const actual = (resultDoc.data() || {}).itemScore || 0;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should update existing deficiency with new item selection not create a new deficiency', async () => {
    const expected = 1;
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const deficiencyId = uuid();
    const itemType = 'fiveactions_onetofive';
    const itemUpdatedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
      true
    ); // get last deficient eligible index
    const itemInitIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(true);
    const itemConfig = { mainInputSelection: itemInitIndex };
    const inspData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            itemType,
            true, // Create one new deficient item
            itemConfig
          ),
        },
      },
    });
    const deficientData = mocking.createDeficiency(
      {
        property: propertyId,
        inspection: inspectionId,
        item: itemId,
      },
      inspData
    );
    const inspUpdate = {
      [`template.items.${itemId}.mainInputSelection`]: itemUpdatedIndex,
    };

    // Setup database
    await inspectionsModel.firestoreCreateRecord(fs, inspectionId, inspData);
    await diModel.firestoreCreateRecord(fs, deficiencyId, deficientData);
    const beforeSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );
    await inspectionsModel.firestoreUpdateRecord(fs, inspectionId, inspUpdate);
    const afterSnap = await inspectionsModel.firestoreFindRecord(
      fs,
      inspectionId
    );

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.inspectionWriteV2);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const inspDeficiencyDocs = await diModel.firestoreQuery(fs, {
      inspection: ['==', inspectionId],
    });
    const actual = inspDeficiencyDocs.size;

    // Assertions
    expect(actual).to.equal(expected);
  });
});
