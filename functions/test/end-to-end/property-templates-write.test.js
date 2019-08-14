const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Property Templates Write', () => {
  afterEach(() => cleanDb(db));

  it('should remove all property template proxies when a property removes all templates', async () => {
    const tmplId = uuid();
    const propertyId = uuid();

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId]: true } }); // Add property with a template
    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get before templates
    await db.ref(`/properties/${propertyId}/templates`).remove(); // Remove templates
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get after templates
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId}`)
      .set({ name: `test${tmplId}` });

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.exists();

    // Assertions
    expect(actual).to.equal(false);
  });

  it("should remove a template's property proxies when it is disassociated from a property", async () => {
    const tmplId1 = uuid();
    const tmplId2 = uuid();
    const propertyId = uuid();
    const expected = {
      [tmplId1]: { name: `name${tmplId1}`, description: `desc${tmplId1}` },
    }; // only has template 1

    // Setup database
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId1]: true, [tmplId2]: true } });
    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get before templates
    await db.ref(`/properties/${propertyId}/templates/${tmplId2}`).remove(); // Remove 2nd template
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get after templates
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`)
      .set(expected[tmplId1]);
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId2}`)
      .set({ name: `test${tmplId2}` });

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update property template proxies when a template is added to a property', async () => {
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
    await db.ref('/templates').set(expected); // Add template
    await db
      .ref(`/properties/${propertyId}`)
      .set({ name: 'test', templates: { [tmplId1]: true } }); // Only has 1st template
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    const propertyBeforeSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get before templates
    await db.ref(`/properties/${propertyId}/templates/${tmplId2}`).set(true); // Associate 2nd template w/ property
    const propertyAfterSnap = await db
      .ref(`/properties/${propertyId}/templates`)
      .once('value'); // Get after templates
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmplId1}`)
      .set(expected[tmplId1]); // Add 1st template list proxy record

    // Execute
    const changeSnap = test.makeChange(propertyBeforeSnap, propertyAfterSnap);
    const wrapped = test.wrap(cloudFunctions.propertyTemplatesWrite);
    await wrapped(changeSnap, { params: { propertyId } });

    // Test result
    const result = await db
      .ref(`/propertyTemplatesList/${propertyId}`)
      .once('value');
    const actual = result.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });
});
