const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const propertiesModel = require('../../../models/properties');
const templatesModel = require('../../../models/templates');
const templateCategories = require('../../../models/template-categories');
const { db, fs, test, cloudFunctions } = require('../../setup');

describe('Template Categories | Delete', () => {
  afterEach(() => cleanDb(db, fs));

  it('should disassociate all realtime templates belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated
    const catData = { name: `category${categoryId}` };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmpl1Id, tmpl1Data); // add template #1
    await templatesModel.realtimeUpsertRecord(db, tmpl2Id, tmpl2Data); // add template #2
    await templatesModel.realtimeUpsertRecord(db, tmpl3Id, tmpl3Data); // add template #3
    await templateCategories.realtimeUpsertRecord(db, categoryId, catData); // add category
    const snap = await templateCategories.realtimeFindRecord(db, categoryId);
    await templateCategories.realtimeRemoveRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const template1 = await templatesModel.realtimeFindRecord(db, tmpl1Id);
    const template2 = await templatesModel.realtimeFindRecord(db, tmpl2Id);
    const template3 = await templatesModel.realtimeFindRecord(db, tmpl3Id);
    const actualTmpl1Cat = (template1.val() || {}).category || null;
    const actualTmpl2Cat = (template2.val() || {}).category || null;
    const actualTmpl3Cat = (template3.val() || {}).category || null;

    // Assertions
    [
      {
        actual: actualTmpl1Cat,
        expected: null,
        msg: 'removed template 1 relationship',
      },
      {
        actual: actualTmpl2Cat,
        expected: null,
        msg: 'removed template 2 relationship',
      },
      {
        actual: actualTmpl3Cat,
        expected: tmpl3Data.category,
        msg: 'template 3 relationship unchanged',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should disassociate all realtime template lists belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated
    const catData = { name: `category${categoryId}` };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmpl1Id, tmpl1Data); // add template #1
    await templatesModel.realtimeUpsertListRecord(db, tmpl1Id, tmpl1Data); // add template #1 proxy
    await templatesModel.realtimeUpsertRecord(db, tmpl2Id, tmpl2Data); // add template #2
    await templatesModel.realtimeUpsertListRecord(db, tmpl2Id, tmpl2Data); // add template #2 proxy
    await templatesModel.realtimeUpsertRecord(db, tmpl3Id, tmpl3Data); // add template #3
    await templatesModel.realtimeUpsertListRecord(db, tmpl3Id, tmpl3Data); // add template #3 proxy
    await templateCategories.realtimeUpsertRecord(db, categoryId, catData); // add category
    const snap = await templateCategories.realtimeFindRecord(db, categoryId);
    await templateCategories.realtimeRemoveRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const actualTmpl1Cat = await db
      .ref(`/templatesList/${tmpl1Id}/category`)
      .once('value');
    const actualTmpl2Cat = await db
      .ref(`/templatesList/${tmpl2Id}/category`)
      .once('value');
    const actualTmpl3Cat = await db
      .ref(`/templatesList/${tmpl3Id}/category`)
      .once('value');
    const actualTmpl1 = await db.ref(`/templatesList/${tmpl1Id}`).once('value');

    // Assertions
    [
      {
        actual: actualTmpl1Cat.val(),
        expected: null,
        msg: 'removed template 1 proxy relationship',
      },
      {
        actual: actualTmpl2Cat.val(),
        expected: null,
        msg: 'removed template 2 proxy relationship',
      },
      {
        actual: actualTmpl3Cat.val(),
        expected: tmpl3Data.category,
        msg: 'template 3 proxy relationship unchanged',
      },
      {
        actual: (actualTmpl1.val() || {}).name,
        expected: tmpl1Data.name,
        msg: 'non-category attributes unchanged',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should disassociate all firestore templates belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated
    const catData = { name: `category${categoryId}` };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmpl1Id, tmpl1Data); // add template #1
    await templatesModel.firestoreUpsertRecord(fs, tmpl1Id, tmpl1Data); // add firestore template #1
    await templatesModel.realtimeUpsertRecord(db, tmpl2Id, tmpl2Data); // add template #2
    await templatesModel.firestoreUpsertRecord(fs, tmpl2Id, tmpl2Data); // add firestore template #2
    await templatesModel.realtimeUpsertRecord(db, tmpl3Id, tmpl3Data); // add template #3
    await templatesModel.firestoreUpsertRecord(fs, tmpl3Id, tmpl3Data); // add firestore template #2
    await templateCategories.realtimeUpsertRecord(db, categoryId, catData); // add category
    const snap = await templateCategories.realtimeFindRecord(db, categoryId);
    await templateCategories.realtimeRemoveRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const docSnaps = await templatesModel.firestoreFindAll(fs);

    // Assertions
    [
      {
        value: docSnaps.find(doc => doc.id === tmpl1Id),
        expected: undefined,
        msg: 'removed template 1 category relationship',
      },
      {
        value: docSnaps.find(doc => doc.id === tmpl2Id),
        expected: undefined,
        msg: 'removed template 2 category relationship',
      },
      {
        value: docSnaps.find(doc => doc.id === tmpl3Id),
        expected: tmpl3Data.category,
        msg: 'template 3 category relationship unchanged',
      },
    ].forEach(({ value, expected, msg }) => {
      const actual = value.data().category;
      expect(actual).to.equal(expected, msg);
    });
  });

  it('should remove matching firestore record', async () => {
    const expected = false;
    const categoryId = uuid();
    const catData = { name: `category${categoryId}` };

    // Setup database
    await templateCategories.realtimeUpsertRecord(db, categoryId, catData); // add category
    await templateCategories.firestoreUpsertRecord(fs, categoryId, catData); // add category
    const snap = await templateCategories.realtimeFindRecord(db, categoryId);
    await templateCategories.realtimeRemoveRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const result = await templateCategories.firestoreFindRecord(fs, categoryId);
    const actual = result.exists;

    // Assertions
    expect(actual).to.equal(expected);
  });

  it('should disassociate all property templates lists belonging to a category', async () => {
    const tmpl1Id = uuid();
    const tmpl2Id = uuid();
    const tmpl3Id = uuid();
    const propertyId = uuid();
    const categoryId = uuid();
    const tmpl1Data = {
      name: `test${tmpl1Id}`,
      description: `desc${tmpl1Id}`,
      category: categoryId,
    }; // related
    const tmpl2Data = {
      name: `test${tmpl2Id}`,
      description: `desc${tmpl2Id}`,
      category: categoryId,
    }; // related
    const tmpl3Data = {
      name: `test${tmpl3Id}`,
      description: `desc${tmpl3Id}`,
      category: uuid(),
    }; // unrelated
    const propData = {
      templates: { [tmpl1Id]: true, [tmpl2Id]: true, [tmpl3Id]: true },
    };
    const catData = { name: `category${categoryId}` };

    // Setup database
    await templatesModel.realtimeUpsertRecord(db, tmpl1Id, tmpl1Data); // add template #1
    await propertiesModel.realtimeUpsertRecord(db, propertyId, propData); // required
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`)
      .set(tmpl1Data); // add template #1 proxy
    await templatesModel.realtimeUpsertRecord(db, tmpl2Id, tmpl2Data); // add template #2
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}`)
      .set(tmpl2Data); // add template #2 proxy
    await templatesModel.realtimeUpsertRecord(db, tmpl3Id, tmpl3Data); // add template #3
    await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}`)
      .set(tmpl3Data); // add template #2 proxy
    await templateCategories.realtimeUpsertRecord(db, categoryId, catData); // add category
    const snap = await templateCategories.realtimeFindRecord(db, categoryId);
    await templateCategories.realtimeRemoveRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const actualTmpl1Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}/category`)
      .once('value');
    const actualTmpl2Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl2Id}/category`)
      .once('value');
    const actualTmpl3Cat = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl3Id}/category`)
      .once('value');
    const actualTmpl1 = await db
      .ref(`/propertyTemplatesList/${propertyId}/${tmpl1Id}`)
      .once('value');

    // Assertions
    [
      {
        actual: actualTmpl1Cat.val(),
        expected: null,
        msg: 'removed property template 1 proxy category',
      },
      {
        actual: actualTmpl2Cat.val(),
        expected: null,
        msg: 'removed property template 2 proxy category',
      },
      {
        actual: actualTmpl3Cat.val(),
        expected: tmpl3Data.category,
        msg: 'property template 3 proxy category unchanged',
      },
      {
        actual: actualTmpl1.val().name,
        expected: tmpl1Data.name,
        msg: 'non-category attributes unchanged',
      },
    ].forEach(({ actual, expected, msg }) => {
      expect(actual).to.equal(expected, msg);
    });
  });
});
