const co = require('co');
const { expect } = require('chai');
const uuid = require('../../test-helpers/uuid');
const { cleanDb } = require('../../test-helpers/firebase');
const { db, test, cloudFunctions } = require('./setup');

describe('Templates Sync', () => {
  afterEach(() => cleanDb(db));

  it('should create new proxy template records', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `name${tmpl3Id}`, category: categoryId }
    };
    const propertyData = { templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } };

    // Setup database
    yield db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    yield db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    yield db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const results = yield Promise.all([
      db.ref(`/propertyTemplates/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl3Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`).once('value')
    ]);

    // Assertions
    results.forEach((snapshot, i) => {
      const actual = snapshot.val();
      const expectedtmpl = expected[[tmpl1Id, tmpl2Id, tmpl3Id][i <= 1 ? 0 : i <= 3 ? 1 : 2]];
      expect(actual).to.deep.equal(expectedtmpl, `proxy record ${snapshot.key} synced at test ${i}`);
    });
  }));

  it('should update all existing proxy template\'s data', () => co(function *() {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `name${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `name${tmpl2Id}` },
      [tmpl3Id]: { description: `desc${tmpl3Id}`, name: `name${tmpl3Id}`, category: categoryId }
    };
    const propertyData = { templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true } };

    // Setup database
    yield db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    yield db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    yield db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set({
      [propertyId]: {
        [tmpl1Id]: { name: 'old' },
        [tmpl2Id]: { name: 'old', description: 'old' },
        [tmpl3Id]: { name: 'old', description: 'old', category: 'old' },
      }
    });
    yield db.ref('/propertyTemplatesList').set({
      [propertyId]: {
        [tmpl1Id]: { name: 'old' },
        [tmpl2Id]: { name: 'old', description: 'old' },
        [tmpl3Id]: { name: 'old', description: 'old', category: 'old' },
      }
    });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const results = yield Promise.all([
      db.ref(`/propertyTemplates/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`).once('value'),
      db.ref(`/propertyTemplates/${propertyId}/${tmpl3Id}`).once('value'),
      db.ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`).once('value')
    ]);

    // Assertions
    results.forEach((snapshot, i) => {
      const actual = snapshot.val();
      const expectedtmpl = expected[[tmpl1Id, tmpl2Id, tmpl3Id][i <= 1 ? 0 : i <= 3 ? 1 : 2]];
      expect(actual).to.deep.equal(expectedtmpl, `proxy record ${snapshot.key} synced at test ${i}`);
    })
  }));

  it('should remove a property\'s template proxies no longer associated with property', () => co(function *() {
    const oldTmplId = uuid();
    const currTmplId = uuid();
    const propertyId = uuid();
    const templateData = { name: `remove${oldTmplId}`, description: `remove${oldTmplId}` };
    const propertyData = { templates: { [currTmplId]: true } }; // not associated w/ oldTmplId
    const proxyTmplData = {
      [propertyId]: {
        [oldTmplId]: templateData, // must exist
        [currTmplId]: { name: 'current' }
      }
    };

    // Setup database
    yield db.ref(`/templates/${oldTmplId}`).set(templateData);
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref('/propertyTemplates').set(proxyTmplData);
    yield db.ref('/propertyTemplatesList').set(proxyTmplData);

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const removedtmpl = yield db.ref(`/propertyTemplates/${propertyId}/${oldTmplId}`).once('value');
    const removedtmplList = yield db.ref(`/propertyTemplatesList/${propertyId}/${oldTmplId}`).once('value');
    const currentTmpl = yield db.ref(`/propertyTemplates/${propertyId}/${currTmplId}`).once('value');
    const currentTmplList = yield db.ref(`/propertyTemplatesList/${propertyId}/${currTmplId}`).once('value');

    // Assertions
    expect(removedtmpl.exists()).to.equal(false, 'removed disassociated /propertyTemplates');
    expect(removedtmplList.exists()).to.equal(false, 'removed disassociated /propertyTemplatesList');
    expect(currentTmpl.exists()).to.equal(true, 'kept associated /propertyTemplates');
    expect(currentTmplList.exists()).to.equal(true, 'kept associated /propertyTemplatesList');
  }));

  it('should add missing records in /templatesList', () => co(function *() {
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
    yield db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    yield db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    yield db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should update existing records in /templatesList', () => co(function *() {
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
    yield db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]); // updated
    yield db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]); // updated
    yield db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]); // updated
    yield db.ref(`/properties/${propertyId}`).set(propertyData);
    yield db.ref(`/templateCategories/${categoryId}`).set({ name: `name${categoryId}` }); // sanity check
    yield db.ref(`/templatesList/${tmpl1Id}`).set({ name: 'old' });
    yield db.ref(`/templatesList/${tmpl2Id}`).set({ name: 'old', description: 'old' });
    yield db.ref(`/templatesList/${tmpl3Id}`).set({ name: 'old', description: 'old', category: 'old' });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList`).once('value');

    // Assertions
    expect(actual.val()).to.deep.equal(expected);
  }));

  it('should remove orphaned records in /templatesList', () => co(function *() {
    const tmplId = uuid();

    // Setup database
    yield db.ref(`/templatesList/${tmplId}`).set({ name: 'orphan', description: 'orphan' });

    // Execute
    yield test.wrap(cloudFunctions.templatesSync)();

    // Test results
    const actual = yield db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  }));
});
