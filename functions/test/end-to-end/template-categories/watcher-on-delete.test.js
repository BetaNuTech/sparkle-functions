const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const { cleanDb } = require('../../../test-helpers/firebase');
const templatesModel = require('../../../models/templates');
const templateCategories = require('../../../models/template-categories');
const { db, test, cloudFunctions } = require('../../setup');

describe('Template Categories | Watchers | On Delete', () => {
  afterEach(() => cleanDb(db));

  it('should disassociate all templates belonging to a category', async () => {
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
    await templatesModel.createRecord(db, tmpl1Id, tmpl1Data); // add template #1
    await templatesModel.createRecord(db, tmpl2Id, tmpl2Data); // add template #2
    await templatesModel.createRecord(db, tmpl3Id, tmpl3Data); // add template #3
    await templateCategories.createRecord(db, categoryId, catData); // add category
    const snap = await templateCategories.findRecord(db, categoryId);
    await templateCategories.removeRecord(db, categoryId);

    // Execute
    const wrapped = test.wrap(cloudFunctions.templateCategoryDelete);
    await wrapped(snap, { params: { categoryId } });

    // Test result
    const template1 = await templatesModel.findRecord(db, tmpl1Id);
    const template2 = await templatesModel.findRecord(db, tmpl2Id);
    const template3 = await templatesModel.findRecord(db, tmpl3Id);
    const actualTmpl1Cat = (template1.data() || {}).category || null;
    const actualTmpl2Cat = (template2.data() || {}).category || null;
    const actualTmpl3Cat = (template3.data() || {}).category || null;

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
});
