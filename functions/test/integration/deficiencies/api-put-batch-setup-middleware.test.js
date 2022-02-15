const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const log = require('../../../utils/logger');
const uuid = require('../../../test-helpers/uuid');
const stubs = require('../../../test-helpers/stubs');
const mocking = require('../../../test-helpers/mocking');
const deficiencyModel = require('../../../models/deficient-items');
const middleware = require('../../../deficient-items/api/put-batch-setup-middleware');

describe('Deficient Items | API | PUT Batch Setup Middlware', () => {
  afterEach(() => sinon.restore());

  it('rejects when first deficient item read fails', done => {
    sinon.stub(log, 'error').callsFake(() => true);
    sinon.stub(deficiencyModel, 'findRecord').rejects(Error('dang'));

    request(createApp())
      .put(`/t?id=${uuid()}`)
      .send({ update: true })
      .expect(500)
      .then(() => done())
      .catch(done);
  });

  it('updates the request params with the property identifier from the deficiency', done => {
    const expected = uuid();
    const deficiencyId = uuid();
    const deficiency = mocking.createDeficiency({
      state: 'requires-action',
      inspection: uuid(),
      property: expected,
      item: uuid(),
    });
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findRecord')
      .resolves(stubs.wrapSnapshot(deficiency));

    request(createApp())
      .put(`/t?id=${deficiencyId}`)
      .send({ state: 'requires-action' })
      .expect(200)
      .then(res => {
        const { propertyId: actual } = res.body;
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.put(
    '/t',
    bodyParser.json(),
    middleware({
      collection: () => {},
    }),
    // Send the "propertyId" request param as success payload
    (req, res) => res.status(200).send({ propertyId: req.propertyId })
  );
  return app;
}
