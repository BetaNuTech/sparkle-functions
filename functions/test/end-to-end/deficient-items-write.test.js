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
      trackDeficientItems: true,
      property: propertyId,

      // Create single deficient item on inspection
      template: {
        items: {
          [itemId]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true)
        }
      }
    });

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}`).set({ state: 'requires-action' });
    const beforeSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create before
    await db.ref(`/inspections/${inspectionId}`).remove(); // remove inspection
    const afterSnap = await db.ref(`/inspections/${inspectionId}/updatedLastDate`).once('value'); // Create after

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.deficientItemsWrite);
    await wrapped(changeSnap, { params: { inspectionId } });

    // Test result
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.equal(null, 'removed all inspection deficient items');
  });

  it('should remove each deficient item that belongs to an approved inspection items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        items: {
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true, { mainInputSelection: 1 }), // target to make non-deficient
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true, { mainInputSelection: 1 })
        }
      }
    });

    const expected = { [item2Id]: { state: 'requires-action', itemMainInputSelection: 1 } };
    const removedDeficientItem = { state: 'requires-action', itemMainInputSelection: 1 };

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).set(expected); // Setup expected DI
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item1Id}`).set(removedDeficientItem);
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
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = actualSnap.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should create deficient items for a newly deficient inspection', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two NON-deficient items on inspection
      template: {
        items: {
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
    const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}`).once('value');
    const actual = Object.keys(actualSnap.val() || {});

    // Assertions
    expect(actual.includes(item1Id)).to.equal(true, 'created deficient item #1');
    expect(actual.includes(item2Id)).to.equal(true, 'created deficient item #2');
  });

  it('should update deficient item proxy attributes that are out of sync with its\' inspection item', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const itemId = uuid();
    const beforeData = Object.freeze(mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create single deficient item on inspection
      template: {
        items: {
          [itemId]: mocking.createCompletedMainInputItem(
            'fiveactions_onetofive',
            true,
            { mainInputSelection: 0 } // Require deficient selection
          )
        }
      }
    }));

    const updates = Object.freeze({
      itemInspectorNotes: 'note',
      itemMainInputSelection: 1, // still a deficient item eligible score
      itemPhotosData: { '1554325519707': { caption: 'test', downloadURL: 'https:google.com' } },
      itemAdminEdits: { [uuid()]: { action: 'selected B', admin_name: 'testor', admin_uid: uuid(), edit_date: 1554227737 } }
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

      // Update source item's proxyable attribute
      await db.ref(`/inspections/${inspectionId}/template/items/${itemId}/${sourceAttr}`).set(expected); // Add source item update

      // Execute again for DI update
      await wrapped(changeSnap, { params: { inspectionId } });

      // Test result
      const actualSnap = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${itemId}/${diAttr}`).once('value');
      const actual = actualSnap.val();

      // Assertions
      if (typeof expected === 'object') {
        expect(actual).to.deep.equal(expected, `updated DI proxy object attribute ${diAttr}`);
      } else {
        expect(actual).to.equal(expected, `updated DI proxy attribute ${diAttr}`);
      }
    }
  });

  it('should add a newly deficient item to existing deficient items', async () => {
    const propertyId = uuid();
    const inspectionId = uuid();
    const item1Id = uuid();
    const item2Id = uuid();
    const beforeData = mocking.createInspection({
      deficienciesExist: true,
      inspectionCompleted: true,
      trackDeficientItems: true,
      property: propertyId,

      // Create two deficient items on inspection
      template: {
        items: {
          [item1Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', true),
          [item2Id]: mocking.createCompletedMainInputItem('twoactions_checkmarkx', false) // target to make deficient
        }
      }
    });

    const expected = [item1Id, item2Id];

    // Setup database
    await db.ref(`/inspections/${inspectionId}`).set(beforeData); // Add inspection
    await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item1Id}`).set({ state: 'requires-action' });
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
    const actual = await db.ref(`/propertyInspectionDeficientItems/${propertyId}/${inspectionId}/${item2Id}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(true, 'created deficient item #2');
  });
});
