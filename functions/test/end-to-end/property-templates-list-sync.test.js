const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Property Templates List Sync', () => {
  afterEach(() => cleanDb(db));

  it('should create new proxy records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `name${tmpl3Id}`,
        category: categoryId,
      },
    };
    const propertyData = {
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    await test.wrap(cloudFunctions.propertyTemplatesListSync)();

    // Test results
    const results = await Promise.all([
      db.ref(`/propertyTemplates/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl3Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`).once('value'),
    ]);

    // Assertions
    results.forEach((snapshot, i) => {
      const actual = snapshot.val();
      const expectedtmpl =
        expected[[tmpl1Id, tmpl2Id, tmpl3Id][i <= 1 ? 0 : i <= 3 ? 1 : 2]];
      expect(actual).to.deep.equal(
        expectedtmpl,
        `proxy record ${snapshot.key} synced at test ${i}`
      );
    });
  });

  it('should update all existing proxy records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `name${tmpl3Id}`,
        category: categoryId,
      },
    };
    const propertyData = {
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/properties/${propertyId}`).set(propertyData);
    await db.ref('/propertyTemplates').set({
      [propertyId]: {
        [tmpl1Id]: { name: 'old' },
        [tmpl2Id]: { name: 'old', description: 'old' },
        [tmpl3Id]: { name: 'old', description: 'old', category: 'old' },
      },
    });
    await db.ref('/propertyTemplatesList').set({
      [propertyId]: {
        [tmpl1Id]: { name: 'old' },
        [tmpl2Id]: { name: 'old', description: 'old' },
        [tmpl3Id]: { name: 'old', description: 'old', category: 'old' },
      },
    });

    // Execute
    await test.wrap(cloudFunctions.propertyTemplatesListSync)();

    // Test results
    const results = await Promise.all([
      db.ref(`/propertyTemplates/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl3Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`).once('value'),
    ]);

    // Assertions
    results.forEach((snapshot, i) => {
      const actual = snapshot.val();
      const expectedtmpl =
        expected[[tmpl1Id, tmpl2Id, tmpl3Id][i <= 1 ? 0 : i <= 3 ? 1 : 2]];
      expect(actual).to.deep.equal(
        expectedtmpl,
        `proxy record ${snapshot.key} synced at test ${i}`
      );
    });
  });

  it('should remove proxies no longer associated with a property', async () => {
    const oldTmplId = uuid();
    const currTmplId = uuid();
    const propertyId = uuid();
    const templateData = {
      name: `remove${oldTmplId}`,
      description: `remove${oldTmplId}`,
    };
    const propertyData = { templates: { [currTmplId]: true } }; // not associated w/ oldTmplId
    const proxyTmplData = {
      [propertyId]: {
        [oldTmplId]: templateData, // must exist
        [currTmplId]: { name: 'current' },
      },
    };

    // Setup database
    await db.ref(`/templates/${oldTmplId}`).set(templateData);
    await db.ref(`/properties/${propertyId}`).set(propertyData);
    await db.ref('/propertyTemplates').set(proxyTmplData);
    await db.ref('/propertyTemplatesList').set(proxyTmplData);

    // Execute
    await test.wrap(cloudFunctions.propertyTemplatesListSync)();

    // Test results
    const removedtmpl = await db
      .ref(`/propertyTemplates/${propertyId}/${oldTmplId}`)
      .once('value');
    const removedtmplList = await db
      .ref(`/propertyTemplatesList/${propertyId}/${oldTmplId}`)
      .once('value');
    const currentTmpl = await db
      .ref(`/propertyTemplates/${propertyId}/${currTmplId}`)
      .once('value');
    const currentTmplList = await db
      .ref(`/propertyTemplatesList/${propertyId}/${currTmplId}`)
      .once('value');

    // Assertions
    expect(removedtmpl.exists()).to.equal(
      false,
      'removed disassociated /propertyTemplates'
    );
    expect(removedtmplList.exists()).to.equal(
      false,
      'removed disassociated /propertyTemplatesList'
    );
    expect(currentTmpl.exists()).to.equal(
      true,
      'kept associated /propertyTemplates'
    );
    expect(currentTmplList.exists()).to.equal(
      true,
      'kept associated /propertyTemplatesList'
    );
  });
});
