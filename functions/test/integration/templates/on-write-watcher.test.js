const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const propertyTemplates = require('../../../property-templates');
const templateList = require('../../../templates/utils/list');
const createOnWriteHandler = require('../../../templates/on-write-watcher');

describe('Templates | On Write', () => {
  it('should initiate update of proxy records', async () => {
    const expected = uuid();

    let actual = '';
    sinon.stub(templateList, 'write').callsFake((db, fs, templateId) => {
      actual = templateId;
      return Promise.resolve();
    });

    sinon.stub(propertyTemplates, 'remove').resolves({});
    sinon.stub(propertyTemplates, 'upsert').resolves({});

    try {
      await createOnWriteHandler({}, {})(
        {
          before: { exists: () => true, val: () => null },
          after: { exists: () => false, val: () => null },
        },
        { params: { templateId: expected } }
      );
    } catch (err) {} // eslint-disable-line no-empty

    expect(actual).to.equal(expected);
  });
});
