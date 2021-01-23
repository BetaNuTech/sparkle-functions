const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const stubs = require('../../../test-helpers/stubs');
const mocking = require('../../../test-helpers/mocking');
const deficiencyModel = require('../../../models/deficient-items');
const putBatch = require('../../../deficient-items/api/put-batch');

describe('Deficiencies | API | PUT Batch', () => {
  afterEach(() => sinon.restore());

  it('rejects request missing any deficient item ids', done => {
    request(createApp())
      .put(`/t`)
      .send({ update: true })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: One or more deficient item ids must be provided as query params'
        );
        done();
      })
      .catch(done);
  });

  it('rejects request to update more than 10 deficient items', done => {
    const query = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      .map(id => `id=${id}`)
      .join('&');
    request(createApp())
      .put(`/t?${query}`)
      .send({ update: true })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: you may only update 10 deficient items at a time'
        );
        done();
      })
      .catch(done);
  });

  it('rejects request missing update payload', done => {
    request(createApp())
      .put(`/t?id=1`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: deficient item update body required'
        );
        done();
      })
      .catch(done);
  });

  it('rejects when any deficient item is not found', done => {
    const validDeficiencyId = uuid();
    const invalidDeficiencyId1 = uuid();
    const invalidDeficiencyId2 = uuid();
    const deficiency = mocking.createDeficiency({
      inspection: uuid(),
      property: uuid(),
      item: uuid(),
    });
    deficiency.id = validDeficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));

    request(createApp())
      .put(
        `/t?id=${validDeficiencyId}&id=${invalidDeficiencyId1}&id=${invalidDeficiencyId2}`
      )
      .send({ update: true })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const [error] = res.body.errors;
        expect(error.source ? error.source.pointer || '' : '').to.contain(
          `${invalidDeficiencyId1},${invalidDeficiencyId2}`
        );
        expect(error.detail).to.contain('could not find 2 deficient items');
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
    stubAuth,
    putBatch({ collection: () => {} })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}
