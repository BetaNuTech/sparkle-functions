const { expect } = require('chai');
const sinon = require('sinon');
const propertyTemplates = require('../../../property-templates');
const createOnWriteHandler = require('../../../properties/on-write-watcher');

describe('Properties | On Write', function() {
  afterEach(() => sinon.restore());

  it('should not update property templates list when property deleted', async () => {
    const expected = false;
    const syncTemplates = sinon
      .stub(propertyTemplates, 'processWrite')
      .resolves({});

    await createOnWriteHandler({})(
      {
        before: { exists: () => true, val: () => ({ name: 'test' }) },
        after: { exists: () => false },
      },
      { params: { propertyId: '1' } }
    );

    const actual = syncTemplates.called;
    expect(actual).to.equal(expected);
  });

  it('should update property templates list when property updated', async () => {
    const expected = true;
    const syncTemplates = sinon
      .stub(propertyTemplates, 'processWrite')
      .resolves({});

    await createOnWriteHandler({})(
      {
        before: { exists: () => true, val: () => ({ name: 'old' }) },
        after: { exists: () => true, val: () => ({ name: 'new' }) },
      },
      { params: { propertyId: '1' } }
    );

    const actual = syncTemplates.called;
    expect(actual).to.equal(expected);
  });
});
