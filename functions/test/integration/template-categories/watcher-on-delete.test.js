const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const templatesModel = require('../../../models/templates');
const handler = require('../../../template-categories/watchers/on-delete');
const {
  createFirestore,
  createSnapshot,
} = require('../../../test-helpers/stubs');

describe('Template Categories | Delete Template Categories', () => {
  afterEach(() => sinon.restore());

  it('should delete template categories', async () => {
    const categoryId = uuid();
    const expected = categoryId;
    const categoryData = { name: `category${categoryId}` };

    // Stub requests
    const removeCategory = sinon
      .stub(templatesModel, 'firestoreRemoveCategory')
      .resolves();

    // Execute
    handler(createFirestore())(createSnapshot(categoryId, categoryData), {
      params: { categoryId },
    });

    // Assertions
    const result = removeCategory.firstCall || { args: [] };
    const actual = result.args[1] || '';
    expect(actual).to.equal(expected);
  });
});
