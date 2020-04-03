const { expect } = require('chai');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const diModel = require('../../../models/deficient-items');
const archiveModel = require('../../../models/_internal/archive');
const inspectionsModel = require('../../../models/inspections');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');

const DEFICIENT_ITEM_PROXY_ATTRS =
  config.deficientItems.inspectionItemProxyAttrs;
const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;
const INSPECTION_ITEM_SCORES = config.inspectionItems.scores;
const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

describe('Deficient Items | Firestore Inspection Change', () => {
  afterEach(() => cleanDb(db, fs));

  it('should archive all deficient items associated with a deleted inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = mocking.createInspection({
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
    const realtimeData = {
      inspection: inspectionId,
      item: itemId,
      state: 'requires-action',
    };
    const expected = {
      property: propertyId,
      ...realtimeData,
    };
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, beforeData); // Add inspection
    const diRef = await diModel.realtimeCreateRecord(
      db,
      propertyId,
      realtimeData
    ); // Add realtime DI for item
    await diModel.firestoreCreateRecord(fs, diRef.key, expected); // Add Firestore DI for item
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    await inspectionsModel.realtimeRemoveRecord(db, inspectionId); // remove inspection
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const archiveDoc = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      {
        propertyId,
        inspectionId,
        itemId,
      }
    );
    const activeDoc = await diModel.firestoreFindRecord(fs, diRef.key);

    const actual = archiveDoc ? archiveDoc.data() : null;
    delete actual._collection; // Remove archive only attr

    // Assertions
    expect(activeDoc.exists).to.equal(false, 'removed firestore DI record');
    expect(actual).to.deep.equal(expected, 'archived firestore DI');
  });

  it('should archive each deficient item that belongs to an approved inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
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

    const expected = {
      state: 'requires-action',
      property: propertyId,
      inspection: inspectionId,
      item: item1Id,
      itemMainInputSelection: 1,
    };
    const unchangedDeficientItem = {
      state: 'requires-action',
      inspection: inspectionId,
      item: item2Id,
      itemMainInputSelection: 1,
    };
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, beforeData); // Add inspection
    const diOne = await diModel.realtimeCreateRecord(
      db,
      propertyId,
      unchangedDeficientItem
    );
    await diModel.firestoreCreateRecord(fs, diOne.key, {
      property: propertyId,
      ...unchangedDeficientItem,
    });
    const diTwo = await diModel.realtimeCreateRecord(db, propertyId, expected);
    await diModel.firestoreCreateRecord(fs, diTwo.key, {
      property: propertyId,
      ...expected,
    });

    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // Mark 1st item as non-deficient
    );
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const diOfPropertySnap = await diModel.firestoreQueryByProperty(
      fs,
      propertyId
    );
    const archiveSnap = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      {
        propertyId,
        inspectionId,
        itemId: item1Id,
      }
    );
    const actual = archiveSnap ? archiveSnap.data() : null;
    delete actual._collection; // Remove archive only attr

    // Assertions
    expect(diOfPropertySnap.size).to.equal(
      1,
      'has one active firestore deficient item'
    );
    expect(actual).to.deep.equal(
      expected,
      'has one archived firestore deficient item'
    );
  });

  it('should create new deficient items for each newly deficient inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
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
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, beforeData); // Add inspection
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    await db.ref(`${inspectionPath}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
    );
    await db.ref(`${inspectionPath}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsSnap = await diModel.firestoreQueryByProperty(fs, propertyId);
    const result = resultsSnap.docs.map(doc => doc.data().item);

    // Assertions
    [
      {
        actual: result.includes(item1Id),
        expected: true,
        msg: 'created deficient item for inspection item #1',
      },
      {
        actual: result.includes(item2Id),
        expected: true,
        msg: 'created DI for inspection item #2',
      },
    ].forEach(({ actual, expected, msg }) =>
      expect(actual).to.equal(expected, msg)
    );
  });

  it('should merge any archived deficient item data into a reoccuring deficient item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const deficientItemId = uuid();
    const beforeData = mocking.createInspection({
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
    const expected = Date.now() - 100000;
    const deficientItemData = {
      property: propertyId,
      inspection: inspectionId,
      item: item1Id,
      createdAt: expected,
    };
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await archiveModel.deficientItem.firestoreCreateRecord(
      fs,
      deficientItemId,
      deficientItemData
    );
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, beforeData); // Add inspection
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    await db.ref(`${inspectionPath}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
    );
    await db.ref(`${inspectionPath}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsSnap = await diModel.firestoreQueryByProperty(fs, propertyId);
    // const records = resultsSnap.docs.map(doc => doc.data());
    const [mergedRecordDoc] = resultsSnap.docs.filter(
      ({ id }) => id === deficientItemId
    );
    const mergedRecord = mergedRecordDoc ? mergedRecordDoc.data() : null;
    const [newRecordDoc] = resultsSnap.docs.filter(
      ({ id }) => id !== deficientItemId
    );
    const newRecord = newRecordDoc ? newRecordDoc.data() : null;
    const archive = await archiveModel.deficientItem.firestoreFindRecord(
      fs,
      deficientItemId
    );

    // Assertions
    expect(newRecord.createdAt).to.be.ok;
    expect(newRecord.createdAt).to.not.equal(
      expected,
      'new deficient item not merged with archive'
    );
    expect(mergedRecord.createdAt).to.equal(
      expected,
      'repeated DI merged with archive'
    );
    expect(archive).to.equal(null, 'removed deficient item from archive');
  });

  it("should update deficient item proxy attributes that are out of sync with its' inspection item", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemTextValueId = uuid();
    const sectionId = uuid();
    const beforeData = Object.freeze(
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
                mainInputSelection: 0, // Require deficient selection
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
      itemInspectorNotes: 'note',
      itemMainInputSelection: 1, // still a deficient item eligible score
      itemPhotosData: {
        1554325519707: { caption: 'test', downloadURL: 'https:google.com' },
      },
      itemAdminEdits: {
        [uuid()]: {
          action: 'selected B',
          admin_name: 'testor',
          admin_uid: uuid(),
          edit_date: 1554227737,
        },
      },
      sectionSubtitle: 'updated',
    });
    const inspectionPath = `/inspections/${inspectionId}`;

    // List of all proxy attrs synced to source item
    const diAttrNames = Object.keys(DEFICIENT_ITEM_PROXY_ATTRS);

    // Test update of each proxy attribute
    for (let i = 0; i < diAttrNames.length; i++) {
      const diAttr = diAttrNames[i];
      const sourceAttr = DEFICIENT_ITEM_PROXY_ATTRS[diAttr];
      const expected = updates[diAttr];
      expect(expected, `test configured for DI proxy attribute ${diAttr}`).to.be
        .ok;

      // Setup database
      await db.ref(inspectionPath).set(beforeData); // Add inspection
      const beforeSnap = await db
        .ref(`${inspectionPath}/updatedLastDate`)
        .once('value'); // Create before
      const afterSnap = await db
        .ref(`${inspectionPath}/updatedLastDate`)
        .once('value'); // Create after

      // Execute for initial DI add
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
      await wrapped(changeSnap, { params: { inspectionId } });

      // Update source inspection item's proxied value
      const inspUpdatePath = `${inspectionPath}/template/items/${
        diAttr === 'sectionSubtitle' ? itemTextValueId : itemId
      }/${sourceAttr}`;
      await db.ref(inspUpdatePath).set(expected);

      // Collect DI before data
      const itemOneDiDoc = await diModel.firestoreQuery(fs, {
        property: propertyId,
        item: itemId,
      });
      const [itemOneDi] = itemOneDiDoc.docs;
      const deficientItemId = itemOneDi.id;
      const { updatedAt: beforeUpdatedAt } = itemOneDi.data();

      // Execute again for DI update
      await wrapped(changeSnap, { params: { inspectionId } });

      // Test result
      const result = await diModel.firestoreFindRecord(fs, deficientItemId);
      const actual = result.data()[diAttr] || null;
      const { updatedAt: afterUpdatedAt } = result.data();

      // Assertions
      let testAssertion = expect(actual);
      if (typeof expected === 'object') {
        testAssertion = testAssertion.to.deep;
      } else {
        testAssertion = testAssertion.to;
      }
      testAssertion.equal(expected, `updated proxy attribute "${diAttr}"`);
      expect(beforeUpdatedAt).to.not.equal(afterUpdatedAt, 'set updated at');
    }
  });

  it("should update deficient item's last update date with any newest inspection item's admin edit timestamp", async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const expected = Math.round(Date.now() - 5000 / 1000);
    const older = expected - 100000;
    const newerAdminEdit = {
      action: 'NEWER',
      admin_name: 'test',
      admin_uid: uuid(),
      edit_date: expected,
    };
    const olderAdminEdit = {
      action: 'OLDER',
      admin_name: 'test',
      admin_uid: uuid(),
      edit_date: older,
    };
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'fiveactions_onetofive',
            true,
            { adminEdits: { [uuid()]: olderAdminEdit } }
          ),
        },
      },
    });
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await db.ref(inspectionPath).set(beforeData); // Add inspection
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute for initial DI add
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Update source item's proxyable attribute
    await db
      .ref(`${inspectionPath}/template/items/${itemId}/adminEdits/${uuid()}`)
      .set(newerAdminEdit); // Add source item update

    // Execute again for DI update
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsDoc = await diModel.firestoreQuery(fs, {
      property: propertyId,
      item: itemId,
    });
    const [actualData] = resultsDoc.docs;
    const actual = actualData ? actualData.data().itemDataLastUpdatedDate : 0;

    // Assertions
    expect(resultsDoc.size).to.be.ok;
    expect(actual).to.equal(expected);
  });

  it('should add a newly deficient item to existing deficient items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        trackDeficientItems: true,
        items: {
          [item1Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            true
          ),
          [item2Id]: mocking.createCompletedMainInputItem(
            'twoactions_checkmarkx',
            false
          ), // target to make deficient
        },
      },
    });
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await db.ref(inspectionPath).set(beforeData); // Add inspection
    await diModel.firestoreCreateRecord(fs, uuid(), {
      state: 'requires-action',
      property: propertyId,
      item: item1Id,
      inspection: inspectionId,
    });
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create before
    await db.ref(`${inspectionPath}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsDoc = await diModel.firestoreQuery(fs, {
      property: propertyId,
      item: item2Id,
    });
    const actual = resultsDoc.size > 0;

    // Assertions
    expect(actual).to.equal(true, 'created DI for inspection item #2');
  });

  it('should lookup and set source items score on deficient item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemType = 'fiveactions_onetofive';
    const itemSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
      true
    ); // get last deficient eligible index
    const selectedValueName = ITEM_VALUE_NAMES[itemSelectedIndex];
    const expected = 9999; // create custom inspection item value
    const itemConfig = {
      mainInputSelection: itemSelectedIndex,
      [selectedValueName]: expected,
    };

    // Inspection w/ one deficient item
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            itemType,
            true,
            itemConfig
          ),
        },
      },
    });
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await db.ref(inspectionPath).set(beforeData); // Add intial inspection with two deficient item
    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // dataSnapshot adding inspection

    // Execute
    const changeSnap = test.makeChange({}, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsDoc = await diModel.firestoreQuery(fs, {
      property: propertyId,
      item: itemId,
    });
    const [actualData] = resultsDoc.docs;
    const actual = actualData ? actualData.data().itemScore : 0;

    // Assertions
    expect(actual).to.equal(expected); // ensure the items score is correctly set
  });

  it('should updated a deficient items score with the latest selection from an inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemType = 'fiveactions_onetofive';
    const firstSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(true); // Get first deficient index
    const secondSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
      true
    ); // Get last deficient index
    const expected = INSPECTION_ITEM_SCORES[itemType][secondSelectedIndex];

    // Inspection w/ one deficient item
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem(itemType, true, {
            mainInputSelection: firstSelectedIndex,
          }),
        },
      },
    });
    const inspectionPath = `/inspections/${inspectionId}`;

    // Setup database
    await db.ref(inspectionPath).set(beforeData);
    const beforeSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // dataSnapshot before updating inspection

    // Make 2nd inspection item value selection
    await db
      .ref(`${inspectionPath}/template/items/${itemId}/mainInputSelection`)
      .set(secondSelectedIndex);

    const afterSnap = await db
      .ref(`${inspectionPath}/updatedLastDate`)
      .once('value'); // dataSnapshot after updating inspection

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const resultsDoc = await diModel.firestoreQuery(fs, {
      property: propertyId,
      item: itemId,
    });
    const [actualData] = resultsDoc.docs;
    const actual = actualData ? actualData.data().itemScore : 0;

    // Assertions
    expect(actual).to.equal(expected); // ensure the items' score is correctly set to new score
  });

  it('should create new deficient items for matching source items of different inspectons', async () => {
    const propertyId = uuid();
    const inspectionOneId = uuid();
    const inspectionTwoId = uuid();
    const itemId = uuid();
    const inspectionData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,
      template: {
        trackDeficientItems: true,
        items: {
          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'fiveactions_onetofive',
            true
          ),
        },
      },
    });
    const expected = 2;
    const inspOnePath = `/inspections/${inspectionOneId}`;
    const inspTwoPath = `/inspections/${inspectionTwoId}`;

    // Setup database
    await db.ref(inspOnePath).set(inspectionData); // Add inspection
    let beforeSnap = await db
      .ref(`${inspOnePath}/updatedLastDate`)
      .once('value'); // Create before
    let afterSnap = await db
      .ref(`${inspOnePath}/updatedLastDate`)
      .once('value'); // Create after

    // Execute for 1st DI add
    let changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId: inspectionOneId } });

    // Create 2nd inspection with the same source template
    await db.ref(inspTwoPath).set(inspectionData); // Add 2nd inspection w/ same item id
    beforeSnap = await db.ref(inspTwoPath).once('value'); // Create before
    afterSnap = await db.ref(`${inspTwoPath}/updatedLastDate`).once('value'); // Create after
    changeSnap = test.makeChange(beforeSnap, afterSnap);

    // Execute again for DI update
    await wrapped(changeSnap, { params: { inspectionId: inspectionTwoId } });

    // Test result
    const resultsDoc = await diModel.firestoreQueryByProperty(fs, propertyId);
    const actual = resultsDoc.size;

    // Assertions
    expect(actual).to.equal(expected, 'created 2 deficient items');
  });
});
