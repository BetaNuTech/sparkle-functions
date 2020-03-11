const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const templatesModel = require('../../../models/templates');
const propertyTemplates = require('../../../property-templates');
const templateList = require('../../../templates/utils/list');
const onDeleteHandler = require('../../../template-categories/on-delete-watcher');

describe('Template Categories', () => {
  describe('On delete handler', () => {
    afterEach(() => sinon.restore());

    it('should lookup all templates associated with template category', async () => {
      const expected = uuid();

      const query = sinon
        .stub(templatesModel, 'realtimeQueryByCategory')
        .callsFake((_, actual) => {
          expect(actual).to.equal(expected);
          return Promise.resolve({ exists: () => false });
        });

      try {
        await onDeleteHandler({}, {})(
          {},
          {
            params: { categoryId: expected },
          }
        );
      } catch (err) {} // eslint-disable-line no-empty

      expect(query.called).to.equal(true, 'called query');
    });

    it('should remove category association from all related templates', async () => {
      const categoryId = uuid();
      const template1Id = uuid();
      const template2Id = uuid();
      const expected = {
        [`/${template1Id}/category`]: null,
        [`/${template2Id}/category`]: null,
      };

      sinon.stub(templatesModel, 'realtimeQueryByCategory').resolves({
        exists: () => true,
        val: () => ({
          [template1Id]: { category: categoryId },
          [template2Id]: { category: categoryId },
        }),
      });
      sinon.stub(propertyTemplates, 'remove').resolves();
      sinon.stub(templateList, 'removeCategory').resolves();

      const update = sinon
        .stub(templatesModel, 'realtimeBatchUpdate')
        .callsFake((_, actual) => {
          expect(actual).to.deep.equal(expected);
        });

      try {
        await onDeleteHandler({}, {})(
          {},
          {
            params: { categoryId },
          }
        );
      } catch (err) {} // eslint-disable-line no-empty

      expect(update.called).to.equal(true, 'called template batch update');
    });

    it('should remove category association from all related template proxies', async () => {
      const expected = uuid();

      sinon.stub(templatesModel, 'realtimeQueryByCategory').resolves({
        exists: () => true,
        val: () => ({
          [uuid()]: { category: expected },
        }),
      });
      sinon.stub(templatesModel, 'realtimeBatchUpdate').resolves();
      sinon.stub(propertyTemplates, 'remove').resolves();
      const updateProxies = sinon
        .stub(templateList, 'removeCategory')
        .callsFake((db, fs, actual) => {
          expect(actual).to.equal(expected);
          return Promise.resolve();
        });

      try {
        await onDeleteHandler({}, {})(
          {},
          {
            params: { categoryId: expected },
          }
        );
      } catch (err) {} // eslint-disable-line no-empty

      expect(updateProxies.called).to.equal(true, 'called update proxies');
    });
  });
});
