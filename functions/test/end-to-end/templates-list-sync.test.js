const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Templates List Sync', () => {
  afterEach(() => cleanDb(db));

  it('should add missing records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `new${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `new${tmpl3Id}`, category: categoryId }
    };
    const propertyData = { templates: { [tmpl1Id]: true } };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    await db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const actual = await db.ref(`/templatesList`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  });

  it('should update existing records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `new${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `new${tmpl3Id}`, category: categoryId }
    };
    const propertyData = { templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]); // updated
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]); // updated
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]); // updated
    await db.ref(`/properties/${propertyId}`).set(propertyData);
    await db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/templatesList/${tmpl1Id}`).set({ name: 'old' });
    await db.ref(`/templatesList/${tmpl2Id}`).set({ name: 'old', description: 'old' });
    await db.ref(`/templatesList/${tmpl3Id}`).set({ name: 'old', description: 'old', category: 'old' });

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const actual = await db.ref(`/templatesList`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  });

  it('should remove orphaned records', async () => {
    const tmplId = uuid();

    // Setup database
    await db.ref(`/templatesList/${tmplId}`).set({ name: 'orphan', description: 'orphan' });

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const actual = await db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  });
});
