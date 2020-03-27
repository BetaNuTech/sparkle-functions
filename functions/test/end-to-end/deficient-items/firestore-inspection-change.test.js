const { expect } = require('chai');
// const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const diModel = require('../../../models/deficient-items');
const archiveModel = require('../../../models/_internal/archive');
const inspectionsModel = require('../../../models/inspections');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');

// const DEFICIENT_ITEM_PROXY_ATTRS =
//   config.deficientItems.inspectionItemProxyAttrs;
// const DEFICIENT_ITEM_ELIGIBLE = config.inspectionItems.deficientListEligible;
// const INSPECTION_ITEM_SCORES = config.inspectionItems.scores;
// const ITEM_VALUE_NAMES = config.inspectionItems.valueNames;

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

    // Setup database
    await inspectionsModel.realtimeUpsertRecord(db, inspectionId, beforeData); // Add inspection
    const diRef = await diModel.realtimeCreateRecord(
      db,
      propertyId,
      realtimeData
    ); // Add realtime DI for item
    await diModel.firestoreCreateRecord(fs, diRef.key, expected); // Add Firestore DI for item
    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
      .once('value'); // Create before
    await inspectionsModel.realtimeRemoveRecord(db, inspectionId); // remove inspection
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
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

    const active = activeDoc.exists;
    const archive = archiveDoc ? archiveDoc.data() : null;

    // Assertions
    expect(active).to.equal(false, 'removed firestore deficient item record');
    expect(archive).to.deep.equal(
      expected,
      'archived firestore deficient item'
    );
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

    const archivedDeficientItem = {
      state: 'requires-action',
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
    const diTwo = await diModel.realtimeCreateRecord(
      db,
      propertyId,
      archivedDeficientItem
    );
    await diModel.firestoreCreateRecord(fs, diTwo.key, {
      property: propertyId,
      ...archivedDeficientItem,
    });

    const beforeSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
      .once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // Mark 1st item as non-deficient
    );
    const afterSnap = await db
      .ref(`/inspections/${inspectionId}/updatedLastDate`)
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
    const active = diOfPropertySnap.size;
    const archive = archiveSnap ? archiveSnap.data() : null;

    // Assertions
    expect(active).to.equal(1, 'has one active firestore deficient item');
    expect(archive).to.deep.equal(
      archivedDeficientItem,
      'has one archived firestore deficient item'
    );
  });

  // it('should create new deficient items for each newly deficient inspection item', async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const item1Id = uuid();
  //   const item2Id = uuid();
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         // Create two NON-deficient items on inspection
  //         [item1Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           false
  //         ),
  //         [item2Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           false
  //         ),
  //       },
  //     },
  //   });
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
  //   const beforeSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
  //     mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
  //   );
  //   await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
  //     mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
  //   );
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create after
  //
  //   // Execute
  //   const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .once('value');
  //   const actualData = actualSnap.val() || {};
  //   const actual = Object.keys(actualData).map(id => actualData[id].item);
  //
  //   // Assertions
  //   expect(actual.includes(item1Id)).to.equal(
  //     true,
  //     'created deficient item for inspection item #1'
  //   );
  //   expect(actual.includes(item2Id)).to.equal(
  //     true,
  //     'created deficient item for inspection item #2'
  //   );
  // });

  // it('should merge any archived deficient item data matching a newly deficient inspection item', async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const item1Id = uuid();
  //   const item2Id = uuid();
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         // Create two NON-deficient items on inspection
  //         [item1Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           false
  //         ),
  //         [item2Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           false
  //         ),
  //       },
  //     },
  //   });
  //   const expected = Date.now() - 100000;
  //
  //   // Setup database
  //   const diArchiveRef = db
  //     .ref(`/archive/propertyInspectionDeficientItems/${propertyId}`)
  //     .push();
  //   const diArchivePath = diArchiveRef.path.toString();
  //   const diArchiveID = diArchivePath.split('/').pop();
  //   await diArchiveRef.set({
  //     inspection: inspectionId,
  //     item: item1Id,
  //     createdAt: expected,
  //   }); // Add archived DI for item #1
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
  //   const beforeSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
  //     mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
  //   );
  //   await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
  //     mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
  //   );
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create after
  //
  //   // Execute
  //   const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .once('value');
  //   const actualData = actualSnap.val() || {};
  //   const [active] = Object.keys(actualData)
  //     .filter(id => id !== diArchiveID)
  //     .map(id => actualData[id]);
  //   const [archive] = Object.keys(actualData)
  //     .filter(id => id === diArchiveID)
  //     .map(id => actualData[id]);
  //   const oldArchiveSnap = await db.ref(diArchivePath).once('value');
  //   const oldArchive = oldArchiveSnap.val();
  //
  //   // Assertions
  //   expect(active.createdAt).to.be.ok;
  //   expect(active.createdAt).to.not.equal(
  //     expected,
  //     'new deficient item not merged with archive'
  //   );
  //   expect(archive.createdAt).to.equal(
  //     expected,
  //     'repeatedly deficient item merged with archive'
  //   );
  //   expect(oldArchive).to.equal(null, 'removed deficient item from archive');
  // });
  //
  // it("should update deficient item proxy attributes that are out of sync with its' inspection item", async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const itemId = uuid();
  //   const itemTextValueId = uuid();
  //   const sectionId = uuid();
  //   const beforeData = Object.freeze(
  //     mocking.createInspection({
  //       deficienciesExist: true,
  //       inspectionCompleted: true,
  //       property: propertyId,
  //
  //       template: {
  //         trackDeficientItems: true,
  //         items: {
  //           // First item text input (sub title target)
  //           [itemTextValueId]: mocking.createItem({
  //             sectionId,
  //             itemType: 'text_input',
  //             index: 0, // required
  //             textInputValue: 'initial',
  //           }),
  //
  //           // Create single deficient item on inspection
  //           [itemId]: mocking.createCompletedMainInputItem(
  //             'fiveactions_onetofive',
  //             true,
  //             {
  //               mainInputSelection: 0, // Require deficient selection
  //               sectionId,
  //               index: 1, // required
  //             }
  //           ),
  //         },
  //         sections: { [sectionId]: { section_type: 'multi' } }, // required for sectionSubtitle
  //       },
  //     })
  //   );
  //
  //   const updates = Object.freeze({
  //     itemInspectorNotes: 'note',
  //     itemMainInputSelection: 1, // still a deficient item eligible score
  //     itemPhotosData: {
  //       1554325519707: { caption: 'test', downloadURL: 'https:google.com' },
  //     },
  //     itemAdminEdits: {
  //       [uuid()]: {
  //         action: 'selected B',
  //         admin_name: 'testor',
  //         admin_uid: uuid(),
  //         edit_date: 1554227737,
  //       },
  //     },
  //     sectionSubtitle: 'updated',
  //   });
  //
  //   // List of all proxy attrs synced to source item
  //   const diAttrNames = Object.keys(DEFICIENT_ITEM_PROXY_ATTRS);
  //
  //   // Test update of each proxy attribute
  //   for (let i = 0; i < diAttrNames.length; i++) {
  //     const diAttr = diAttrNames[i];
  //     const sourceAttr = DEFICIENT_ITEM_PROXY_ATTRS[diAttr];
  //     const expected = updates[diAttr];
  //     expect(expected, `test configured for DI proxy attribute ${diAttr}`).to.be
  //       .ok;
  //
  //     // Setup database
  //     await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
  //     const beforeSnap = await db
  //       .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //       .once('value'); // Create before
  //     const afterSnap = await db
  //       .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //       .once('value'); // Create after
  //
  //     // Execute for initial DI add
  //     const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //     const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //     await wrapped(changeSnap, { params: { inspectionId } });
  //
  //     if (diAttr === 'sectionSubtitle') {
  //       // Update 1st text input item's value in source item's multi-section
  //       await db
  //         .ref(
  //           `/inspections/${inspectionId}/template/items/${itemTextValueId}/${sourceAttr}`
  //         )
  //         .set(expected);
  //     } else {
  //       // Update source item's proxyable attribute
  //       await db
  //         .ref(
  //           `/inspections/${inspectionId}/template/items/${itemId}/${sourceAttr}`
  //         )
  //         .set(expected);
  //     }
  //
  //     const itemOneDiSnap = await db
  //       .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //       .orderByChild('item')
  //       .equalTo(itemId)
  //       .limitToFirst(1)
  //       .once('value');
  //     const itemOneDiIdentifier = Object.keys(itemOneDiSnap.val() || {})[0];
  //     const beforeUpdatedAtSnap = await db
  //       .ref(
  //         `/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/updatedAt`
  //       )
  //       .once('value');
  //
  //     // Execute again for DI update
  //     await wrapped(changeSnap, { params: { inspectionId } });
  //
  //     // Test result
  //     const results = await db
  //       .ref(
  //         `/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/${diAttr}`
  //       )
  //       .once('value');
  //     const actual = results.val();
  //     const afterUpdatedAtSnap = await db
  //       .ref(
  //         `/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/updatedAt`
  //       )
  //       .once('value');
  //
  //     // Assertions
  //     if (typeof expected === 'object') {
  //       expect(actual).to.deep.equal(
  //         expected,
  //         `updated DI proxy object attribute "${diAttr}"`
  //       );
  //     } else {
  //       expect(actual).to.equal(
  //         expected,
  //         `updated DI proxy attribute "${diAttr}"`
  //       );
  //     }
  //
  //     expect(afterUpdatedAtSnap.exists()).to.equal(true, 'set DI "updatedAt"');
  //     expect(beforeUpdatedAtSnap.val()).to.not.equal(
  //       afterUpdatedAtSnap.val(),
  //       'updated DI "updatedAt"'
  //     );
  //   }
  // });
  //
  // it("should update deficient item's last update date with any newest inspection item's admin edit timestamp", async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const itemId = uuid();
  //   const newer = Date.now() / 1000;
  //   const older = newer - 100000;
  //   const newerAdminEdit = {
  //     action: 'NEWER',
  //     admin_name: 'test',
  //     admin_uid: uuid(),
  //     edit_date: newer,
  //   };
  //   const olderAdminEdit = {
  //     action: 'OLDER',
  //     admin_name: 'test',
  //     admin_uid: uuid(),
  //     edit_date: older,
  //   };
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         // Create single deficient item on inspection
  //         [itemId]: mocking.createCompletedMainInputItem(
  //           'fiveactions_onetofive',
  //           true,
  //           { adminEdits: { [uuid()]: olderAdminEdit } }
  //         ),
  //       },
  //     },
  //   });
  //   const expected = newerAdminEdit.edit_date;
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
  //   const beforeSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create after
  //
  //   // Execute for initial DI add
  //   const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Update source item's proxyable attribute
  //   await db
  //     .ref(
  //       `/inspections/${inspectionId}/template/items/${itemId}/adminEdits/${uuid()}`
  //     )
  //     .set(newerAdminEdit); // Add source item update
  //
  //   // Execute again for DI update
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .orderByChild('item')
  //     .equalTo(itemId)
  //     .limitToFirst(1)
  //     .once('value');
  //   const actualData = actualSnap.exists() ? actualSnap.val() : {};
  //   const actualDI = Object.keys(actualData).map(id => actualData[id])[0];
  //   const actual = actualDI ? actualDI.itemDataLastUpdatedDate : 0;
  //
  //   // Assertions
  //   expect(actual).to.equal(expected);
  // });
  //
  // it('should add a newly deficient item to existing deficient items', async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const item1Id = uuid();
  //   const item2Id = uuid();
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     // Create two deficient items on inspection
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         [item1Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           true
  //         ),
  //         [item2Id]: mocking.createCompletedMainInputItem(
  //           'twoactions_checkmarkx',
  //           false
  //         ), // target to make deficient
  //       },
  //     },
  //   });
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
  //   await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .push()
  //     .set({
  //       state: 'requires-action',
  //       item: item1Id,
  //       inspection: inspectionId,
  //     });
  //   const beforeSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
  //     mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
  //   );
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // Create after
  //
  //   // Execute
  //   const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .orderByChild('item')
  //     .equalTo(item2Id)
  //     .limitToFirst(1)
  //     .once('value');
  //   const actualData = actualSnap.val() || {};
  //   const actual = Object.keys(actualData).map(id => actualData[id].item);
  //
  //   // Assertions
  //   expect(actual.includes(item2Id)).to.equal(
  //     true,
  //     'created deficient item for inspection item #2'
  //   );
  // });
  //
  // it('should lookup and set source items score on deficient item', async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const itemId = uuid();
  //   const itemType = 'fiveactions_onetofive';
  //   const itemSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
  //     true
  //   ); // get last deficient eligible index
  //   const selectedValueName = ITEM_VALUE_NAMES[itemSelectedIndex];
  //   const expected = 9999; // create custom inspection item value
  //   const itemConfig = {
  //     mainInputSelection: itemSelectedIndex,
  //     [selectedValueName]: expected,
  //   };
  //
  //   // creating a mock inspection initially adding two deficient items.
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     // Create one new deficient item
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         [itemId]: mocking.createCompletedMainInputItem(
  //           itemType,
  //           true,
  //           itemConfig
  //         ),
  //       },
  //     },
  //   });
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add intial inspection with two deficient item
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // dataSnapshot adding inspection
  //
  //   // Execute
  //   const changeSnap = test.makeChange({}, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .once('value');
  //   const actualData = actualSnap.val() || {};
  //   const [actual] = Object.keys(actualData).map(id => actualData[id]); // getting the actual  propertyInspectionDeficientItem
  //
  //   // Assertions
  //   expect(actual.itemScore).to.equal(expected); // ensure the items score is correctly set
  // });
  //
  // it('should updated a deficient items score with the latest selection from an inspection item', async () => {
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const itemId = uuid();
  //   const itemType = 'fiveactions_onetofive';
  //   const firstSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].indexOf(true); // Get first deficient index
  //   const secondSelectedIndex = DEFICIENT_ITEM_ELIGIBLE[itemType].lastIndexOf(
  //     true
  //   ); // Get last deficient index
  //   const expected = INSPECTION_ITEM_SCORES[itemType][secondSelectedIndex];
  //
  //   // creating a mock inspection initially adding two deficient items.
  //   const beforeData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     // Create one new deficient item
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         [itemId]: mocking.createCompletedMainInputItem(itemType, true, {
  //           mainInputSelection: firstSelectedIndex,
  //         }),
  //       },
  //     },
  //   });
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionId}`).set(beforeData);
  //   const beforeSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // dataSnapshot before updating inspection
  //
  //   // Make 2nd inspection item value selection
  //   await db
  //     .ref(
  //       `/inspections/${inspectionId}/template/items/${itemId}/mainInputSelection`
  //     )
  //     .set(secondSelectedIndex);
  //
  //   const afterSnap = await db
  //     .ref(`/inspections/${inspectionId}/updatedLastDate`)
  //     .once('value'); // dataSnapshot after updating inspection
  //
  //   // Execute
  //   const changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .once('value');
  //   const actualData = actualSnap.val() || {};
  //   const [actual] = Object.keys(actualData).map(id => actualData[id]); // find deficient item
  //
  //   // Assertions
  //   expect(actual.itemScore).to.equal(expected); // ensure the items' score is correctly set to new score
  // });
  //
  // it('should create new deficient items for matching source items of different inspectons', async () => {
  //   const propertyId = uuid();
  //   const inspectionOneId = uuid();
  //   const inspectionTwoId = uuid();
  //   const itemId = uuid();
  //   const inspectionData = mocking.createInspection({
  //     deficienciesExist: true,
  //     inspectionCompleted: true,
  //     property: propertyId,
  //
  //     template: {
  //       trackDeficientItems: true,
  //       items: {
  //         // Create single deficient item on inspection
  //         [itemId]: mocking.createCompletedMainInputItem(
  //           'fiveactions_onetofive',
  //           true
  //         ),
  //       },
  //     },
  //   });
  //
  //   // Setup database
  //   await db.ref(`/inspections/${inspectionOneId}`).set(inspectionData); // Add inspection
  //   let beforeSnap = await db
  //     .ref(`/inspections/${inspectionOneId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   let afterSnap = await db
  //     .ref(`/inspections/${inspectionOneId}/updatedLastDate`)
  //     .once('value'); // Create after
  //
  //   // Execute for 1st DI add
  //   let changeSnap = test.makeChange(beforeSnap, afterSnap);
  //   const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
  //   await wrapped(changeSnap, { params: { inspectionId: inspectionOneId } });
  //
  //   // Create 2nd inspection with the same source template
  //   await db.ref(`/inspections/${inspectionTwoId}`).set(inspectionData); // Add 2nd inspection w/ same item id
  //   beforeSnap = await db
  //     .ref(`/inspections/${inspectionTwoId}/updatedLastDate`)
  //     .once('value'); // Create before
  //   afterSnap = await db
  //     .ref(`/inspections/${inspectionTwoId}/updatedLastDate`)
  //     .once('value'); // Create after
  //   changeSnap = test.makeChange(beforeSnap, afterSnap);
  //
  //   // Execute again for DI update
  //   await wrapped(changeSnap, { params: { inspectionId: inspectionTwoId } });
  //
  //   // Test result
  //   const actualSnap = await db
  //     .ref(`/propertyInspectionDeficientItems/${propertyId}`)
  //     .once('value');
  //   const actual = Object.keys(actualSnap.val()).length;
  //
  //   // Assertions
  //   expect(actual).to.equal(2, 'created 2 distinct deficient items');
  // });
});
