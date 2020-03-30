const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertyData = require('../../../test-helpers/mocks/property');
const propertiesModel = require('../../../models/properties');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Properties | Write', () => {
  afterEach(() => cleanDb(db, fs));

  it("should remove a template's property proxies when a template is disassociated from property", async () => {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const propertyId = uuid();
    const expected = {
      [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}` },
    }; // only has template 1

    // Setup database
    // Add property with templates
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId1]: true, [tmplId2]: true } });
    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get before templates
    await db.ref(`/properties/${propertyId}/templates/${tmplId2}`).remove(); // Remove 2nd template
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`)
      .set(expected[tmplId1]);
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId2}`)
      .set({ name: `test${tmplId2}` });

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should upsert template property proxies when a property has template relationships', async () => {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const categoryId = uuid();
    const propertyId = uuid();
    const expected = {
      [tmplId1]: {
        name: `name${tmplId1}`,
        description: `desc${tmplId1}`,
        category: categoryId,
      },
      [tmplId2]: {
        name: `name${tmplId2}`,
        description: `desc${tmplId2}`,
        category: categoryId,
      },
    };

    // Setup database
    await db.ref('/templates').set(expected); // Add property's templates
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId1]: true } }); // Only has 1st template
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`)
      .set(expected[tmplId1]); // Add 1st template list proxy record
    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get before templates
    await db.ref(`/properties/${propertyId}/templates/${tmplId2}`).set(true); // Associate 2nd template w/ property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}`)
      .once('value'); // Get after templates

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should create a firestore property when a property is created', async () => {
    const propertyId = uuid();
    const expected = JSON.parse(JSON.stringify(propertyData));

    const beforeSnap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.realtimeUpsertRecord(db, propertyId, expected); // Create
    const afterSnap = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const result = await propertiesModel.firestoreFindRecord(fs, propertyId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update a firestore property when a property is created', async () => {
    const propertyId = uuid();
    const beforeData = JSON.parse(JSON.stringify(propertyData));
    const afterData = JSON.parse(JSON.stringify(propertyData));
    afterData.inspections = null; // trigger Realtime DB delete
    const expected = { ...afterData };
    delete expected.inspections; // Undefined in Firestore

    await propertiesModel.realtimeUpsertRecord(db, propertyId, beforeData); // Create Realtime
    await propertiesModel.firestoreUpsertRecord(fs, propertyId, beforeData); // Create Firestore
    const beforeSnap = await propertiesModel.findRecord(db, propertyId);
    await propertiesModel.realtimeUpsertRecord(db, propertyId, afterData); // Update
    const afterSnap = await propertiesModel.findRecord(db, propertyId);

    // Execute
    const changeSnap = test.makeChange(beforeSnap, afterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test results
    const result = await propertiesModel.firestoreFindRecord(fs, propertyId);
    const actual = result.data();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
