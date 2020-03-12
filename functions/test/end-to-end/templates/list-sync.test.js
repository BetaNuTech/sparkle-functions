const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Templates | List Sync', () => {
  afterEach(() => cleanDb(db, fs));

  it('should add missing realtime records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `new${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `new${tmpl3Id}`,
        category: categoryId,
      },
    };
    const propertyData = { templates: { [tmpl1Id]: true } };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]);
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]);
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const snap = await db.ref('/templatesList').once('value');
    const actual = snap.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should add missing firestore records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = [
      { [tmpl1Id]: { name: `new${tmpl1Id}` } },
      { [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` } },
      {
        [tmpl3Id]: {
          description: `desc${tmpl3Id}`,
          name: `new${tmpl3Id}`,
          category: categoryId,
        },
      },
    ];
    const propertyData = { templates: { [tmpl1Id]: true } };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[0][tmpl1Id]);
    await db.ref(`/templates/${tmpl2Id}`).set(expected[1][tmpl2Id]);
    await db.ref(`/templates/${tmpl3Id}`).set(expected[2][tmpl3Id]);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/properties/${propertyId}`).set(propertyData);

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const actual = [];
    const colSnap = await fs.collection('templates').get();
    colSnap.docs.forEach(docSnap =>
      actual.push({ [docSnap.id]: docSnap.data() })
    );

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update existing realtime records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = {
      [tmpl1Id]: { name: `new${tmpl1Id}` },
      [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` },
      [tmpl3Id]: {
        description: `desc${tmpl3Id}`,
        name: `new${tmpl3Id}`,
        category: categoryId,
      },
    };
    const propertyData = {
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[tmpl1Id]); // updated
    await db.ref(`/templates/${tmpl2Id}`).set(expected[tmpl2Id]); // updated
    await db.ref(`/templates/${tmpl3Id}`).set(expected[tmpl3Id]); // updated
    await db.ref(`/properties/${propertyId}`).set(propertyData);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await db.ref(`/templatesList/${tmpl1Id}`).set({ name: 'old' });
    await db
      .ref(`/templatesList/${tmpl2Id}`)
      .set({ name: 'old', description: 'old' });
    await db
      .ref(`/templatesList/${tmpl3Id}`)
      .set({ name: 'old', description: 'old', category: 'old' });

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const snap = await db.ref('/templatesList').once('value');
    const actual = snap.val();

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should update existing firestore records', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const expected = [
      { [tmpl1Id]: { name: `new${tmpl1Id}` } },
      { [tmpl2Id]: { description: `desc${tmpl2Id}`, name: `new${tmpl2Id}` } },
      {
        [tmpl3Id]: {
          description: `desc${tmpl3Id}`,
          name: `new${tmpl3Id}`,
          category: categoryId,
        },
      },
    ];
    const propertyData = {
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    };

    // Setup database
    await db.ref(`/templates/${tmpl1Id}`).set(expected[0][tmpl1Id]); // updated
    await db.ref(`/templates/${tmpl2Id}`).set(expected[1][tmpl2Id]); // updated
    await db.ref(`/templates/${tmpl3Id}`).set(expected[2][tmpl3Id]); // updated
    await db.ref(`/properties/${propertyId}`).set(propertyData);
    await db
      .ref(`/templateCategories/${categoryId}`)
      .set({ name: `name${categoryId}` }); // sanity check
    await fs
      .collection('templates')
      .doc(tmpl1Id)
      .create({ name: 'old' });
    await fs
      .collection('templates')
      .doc(tmpl2Id)
      .create({ name: 'old', description: 'old' });
    await fs
      .collection('templates')
      .doc(tmpl3Id)
      .create({ name: 'old', description: 'old', category: 'old' });

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    const actual = [];
    const colSnap = await fs.collection('templates').get();
    colSnap.docs.forEach(docSnap =>
      actual.push({ [docSnap.id]: docSnap.data() })
    );

    // Assertions
    expect(actual).to.deep.equal(expected);
  });

  it('should remove orphaned realtime records', async () => {
    const tmplId = uuid();

    // Setup database
    await db
      .ref(`/templatesList/${tmplId}`)
      .set({ name: 'orphan', description: 'orphan' });

    // Execute
    await test.wrap(cloudFunctions.templatesListSync)();

    // Test results
    const actual = await db.ref(`/templatesList/${tmplId}`).once('value');

    // Assertions
    expect(actual.exists()).to.equal(false);
  });
});
