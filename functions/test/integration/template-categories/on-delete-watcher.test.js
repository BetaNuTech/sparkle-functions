const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const templatesModel = require('../../../models/templates');
const propertyTemplates = require('../../../property-templates');
const templateList = require('../../../templates/utils/list');
const onDeleteHandler = require('../../../template-categories/on-delete-watcher');

describe('Template Categories | On Delete', () => {
  afterEach(() => sinon.restore());

  it('should lookup all templates associated with template category', async () => {
    const expected = uuid();
    let actual = '';

    sinon
      .stub(templatesModel, 'realtimeQueryByCategory')
      .callsFake((_, categoryId) => {
        actual = categoryId;
        return Promise.resolve({ exists: () => false });
      });

    try {
      await onDeleteHandler({ ref: () => {} }, { collection: () => {} })(
        {},
        {
          params: { categoryId: expected },
        }
      );
    } catch (err) {} // eslint-disable-line no-empty

    expect(actual).to.equal(expected);
  });

  it('should remove category association from all related templates', async () => {
    const categoryId = uuid();
    const template1Id = uuid();
    const template2Id = uuid();
    const expected = {
      [`/${template1Id}/category`]: null,
      [`/${template2Id}/category`]: null,
    };
    let actual = null;

    sinon.stub(templatesModel, 'realtimeQueryByCategory').resolves({
      exists: () => true,
      val: () => ({
        [template1Id]: { category: categoryId },
        [template2Id]: { category: categoryId },
      }),
    });
    sinon.stub(propertyTemplates, 'remove').resolves();
    sinon.stub(templateList, 'removeCategory').resolves();

    sinon.stub(templatesModel, 'realtimeBatchUpdate').callsFake((_, update) => {
      actual = JSON.parse(JSON.stringify(update));
    });

    try {
      await onDeleteHandler({ ref: () => {} }, { collection: () => {} })(
        {},
        {
          params: { categoryId },
        }
      );
    } catch (err) {} // eslint-disable-line no-empty

    expect(actual).to.deep.equal(expected);
  });

  it('should remove category association from all related template proxies', async () => {
    const expected = uuid();
    let actual = '';

    sinon.stub(templatesModel, 'realtimeQueryByCategory').resolves({
      exists: () => true,
      val: () => ({
        [uuid()]: { category: expected },
      }),
    });
    sinon.stub(templatesModel, 'realtimeBatchUpdate').resolves();
    sinon.stub(propertyTemplates, 'remove').resolves();
    sinon.stub(templateList, 'removeCategory').callsFake((db, categoryId) => {
      actual = categoryId;
      return Promise.resolve();
    });

    try {
      await onDeleteHandler({ ref: () => {} }, { collection: () => {} })(
        {},
        {
          params: { categoryId: expected },
        }
      );
    } catch (err) {} // eslint-disable-line no-empty

    expect(actual).to.equal(expected);
  });
});
