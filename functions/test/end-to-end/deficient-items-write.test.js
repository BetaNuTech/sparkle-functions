const { expect } = require('chai');
const config = require('../../config');
const uuid = require('../../test-helpers/uuid');
const mocking = require('../../test-helpers/mocking');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

const DEFICIENT_ITEM_PROXY_ATTRS = config.deficientItems.inspectionItemProxyAttrs;

describe('Deficient Items Create and Delete', () => {
  afterEach(() => cleanDb(db));

  it('should remove all deficient items associated with a deleted inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const otherInspItemId = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      property: propertyId,

      // Create single deficient item on inspection
      template: {
        trackDeficientItems: true,
        items: {
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).push().set({
      inspection: inspectionId,
      item: itemId,
      state: 'requires-action'
    });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).remove(); // remove inspection
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(null, 'removed all inspection\'s deficient items');
  });

  it('should remove each deficient item that belongs to an approved inspection items', async () => {
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
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true, { mainInputSelection: 1 }), // target to make non-deficient
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true, { mainInputSelection: 1 })
        }
      }
    });

    const removedDeficientItem = { state: 'requires-action', inspection: inspectionId, item: item1Id, itemMainInputSelection: 1 };
    const unchangedDeficientItem = { state: 'requires-action', inspection: inspectionId, item: item2Id, itemMainInputSelection: 1 };

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).push().set(unchangedDeficientItem); // Setup expected DI
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).push().set(removedDeficientItem);
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // Mark 1st item as non-deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).once('value');
    const actual = Object.keys(actualSnap.val()).length;

    // Assertions
    expect(actual).to.equal(1, 'has only one remaining deficient item');
  });

  it('should create deficient items for a newly deficient inspection', async () => {
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
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false),
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false)
        }
      }
    });

    const expected = [item1Id, item2Id];

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item1Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 1st item as deficient
    );
    await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).once('value');
    const actualData = actualSnap.val() || {};
    const actual = Object.keys(actualData).map(id => actualData[id].item);

    // Assertions
    expect(actual.includes(item1Id)).to.equal(true, 'created deficient item for inspection item #1');
    expect(actual.includes(item2Id)).to.equal(true, 'created deficient item for inspection item #2');
  });

  it('should update deficient item proxy attributes that are out of sync with its\' inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const itemTextValueId = uuid();
    const sectionId = uuid();
    const beforeData = Object.freeze(mocking.createInspection({
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
            textInputValue: 'initial'
          }),

          // Create single deficient item on inspection
          [itemId]: mocking.createCompletedMainInputItem(
            'fiveactions_onetofive',
            true,
            {
              mainInputSelection: 0, // Require deficient selection
              sectionId,
              index: 1 // required
            }
          ),
        },
        sections: { [sectionId]: { section_type: 'multi' } } // required for sectionSubtitle
      }
    }));

    const updates = Object.freeze({
      itemInspectorNotes: 'note',
      itemMainInputSelection: 1, // still a deficient item eligible score
      itemPhotosData: { '1554325519707': { caption: 'test', downloadURL: 'https:google.com' } },
      itemAdminEdits: { [uuid()]: { action: 'selected B', admin_name: 'testor', admin_uid: uuid(), edit_date: 1554227737 } },
      sectionSubtitle: 'updated'
    });

    // List of all proxy attrs synced to source item
    const diAttrNames = Object.keys(DEFICIENT_ITEM_PROXY_ATTRS);

    // Test update of each proxy attribute
    for (let i = 0; i < diAttrNames.length; i++) {
      const diAttr = diAttrNames[i];
      const sourceAttr = DEFICIENT_ITEM_PROXY_ATTRS[diAttr];
      const expected = updates[diAttr];
      expect(expected, `test configured for DI proxy attribute ${diAttr}`).to.be.ok;

      // Setup database
      await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
      const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
      const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

      // Execute for initial DI add
      const changeSnap = test.makeChange(beforeSnap, afterSnap);
      const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
      await wrapped(changeSnap, { params: { inspectionId } });

      if (diAttr === 'sectionSubtitle') {
        // Update 1st text input item's value in source item's multi-section
        await db.ref(`/inspections/${inspectionId}/template/items/${itemTextValueId}/${sourceAttr}`).set(expected);
      } else {
        // Update source item's proxyable attribute
        await db.ref(`/inspections/${inspectionId}/template/items/${itemId}/${sourceAttr}`).set(expected);
      }

      const itemOneDiSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).orderByChild('item').equalTo(itemId).limitToFirst(1).once('value');
      const itemOneDiIdentifier = Object.keys(itemOneDiSnap.val() || {})[0];
      const beforeUpdatedAtSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/updatedAt`).once('value');

      // Execute again for DI update
      await wrapped(changeSnap, { params: { inspectionId } });

      // Test result
      const results = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/${diAttr}`).once('value');
      const actual = results.val();
      const afterUpdatedAtSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${itemOneDiIdentifier}/updatedAt`).once('value');

      // Assertions
      if (typeof expected === 'object') {
        expect(actual).to.deep.equal(expected, `updated DI proxy object attribute ${diAttr}`);
      } else {
        expect(actual).to.equal(expected, `updated DI proxy attribute ${diAttr}`);
      }

      expect(afterUpdatedAtSnap.exists()).to.equal(true, 'set DI "updatedAt"');
      expect(beforeUpdatedAtSnap.val()).to.not.equal(afterUpdatedAtSnap.val(), 'updated DI "updatedAt"');
    }
  });

  it('should update deficient item\'s last update date with any newest inspection item\'s admin edit timestamp', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const newer = Date.now() / 1000;
    const older = newer - 100000;
    const newerAdminEdit = { action: 'NEWER', admin_name: 'test', admin_uid: uuid(), edit_date: newer };
    const olderAdminEdit = { action: 'OLDER', admin_name: 'test', admin_uid: uuid(), edit_date: older };
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
          )
        }
      }
    });
    const expected = newerAdminEdit.edit_date;

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute for initial DI add
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Update source item's proxyable attribute
    await db.ref(`/inspections/${inspectionId}/template/items/${itemId}/adminEdits/${uuid()}`).set(newerAdminEdit); // Add source item update

    // Execute again for DI update
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).orderByChild('item').equalTo(itemId).limitToFirst(1).once('value');
    const actualData = (actualSnap.exists() ? actualSnap.val() : {})
    const actualDI = Object.keys(actualData).map(id => actualData[id])[0];
    const actual = actualDI ? actualDI.itemDataLastUpdatedDate : 0;

    // Assertions
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
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true),
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // target to make deficient
        }
      }
    });

    const expected = [item1Id, item2Id];

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).push().set({
      state: 'requires-action',
      item: item1Id,
      inspection: inspectionId
    });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}/template/items/${item2Id}`).set(
      mocking.createCompletedMainInputItem('twoactions_checkmarkx', true) // Mark 2nd item as deficient
    );
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).orderByChild('item').equalTo(item2Id).limitToFirst(1).once('value');
    const actualData = actualSnap.val() || {};
    const actual = Object.keys(actualData).map(id => actualData[id].item);

    // Assertions
    expect(actual.includes(item2Id)).to.equal(true, 'created deficient item for inspection item #2');
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
          [itemId]: mocking.createCompletedMainInputItem( 'fiveactions_onetofive', true)
        }
      }
    });

    // Setup database
    await db.ref(`/inspections/${inspectionOneId}`).set(inspectionData); // Add inspection
    let beforeSnap = await db.ref(`/inspections/${inspectionOneId}/updatedLastDate`).once('value'); // Create before
    let afterSnap = await db.ref(`/inspections/${inspectionOneId}/updatedLastDate`).once('value'); // Create after

    // Execute for 1st DI add
    let changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId: inspectionOneId } });

    // Create 2nd inspection with the same source template
    await db.ref(`/inspections/${inspectionTwoId}`).set(inspectionData); // Add 2nd inspection w/ same item id
    beforeSnap = await db.ref(`/inspections/${inspectionTwoId}/updatedLastDate`).once('value'); // Create before
    afterSnap = await db.ref(`/inspections/${inspectionTwoId}/updatedLastDate`).once('value'); // Create after
    changeSnap = test.makeChange(beforeSnap, afterSnap)

    // Execute again for DI update
    await wrapped(changeSnap, { params: { inspectionId: inspectionTwoId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}`).once('value');
    const actual = Object.keys(actualSnap.val()).length;

    // Assertions
    expect(actual).to.equal(2, 'created 2 distinct deficient items');
  });
});
