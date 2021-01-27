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
const updateDeficiency = require('../../../deficient-items/utils/update-deficient-item');
const putBatch = require('../../../deficient-items/api/put-batch');

const USER_ID = '123';

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

  it('rejects when any deficient item cannot be batch updated', done => {
    const deficiencyId = uuid();
    const deficiency = mocking.createDeficiency({
      state: 'requires-action',
      inspection: uuid(),
      property: uuid(),
      item: uuid(),
    });
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));
    sinon.stub(deficiencyModel, 'firestoreUpdateRecord').rejects(Error('fail'));
    const logStub = sinon.stub(log, 'error').callsFake(() => {});

    request(createApp())
      .put(`/t?id=${deficiencyId}`)
      .send({ state: 'closed' }) // valid update request
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(() => {
        const [actual] = logStub.args[0];
        expect(actual).to.contain(
          deficiencyId,
          'logged error about failing deficiency'
        );
        done();
      })
      .catch(done);
  });

  it('sends a warning for every deficiency that was not modified by user update', done => {
    const deficiencyId = uuid();
    const deficiency = mocking.createDeficiency({
      state: 'requires-action',
      inspection: uuid(),
      property: uuid(),
      item: uuid(),
    });
    const expected = {
      id: deficiencyId,
      type: 'deficient-item',
      detail: 'update not applicable and no changes persisted for record',
    };
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));
    sinon.stub(log, 'warn').callsFake(() => {}); // silence
    const updateRecord = sinon
      .stub(deficiencyModel, 'firestoreUpdateRecord')
      .resolves();

    request(createApp())
      .put(`/t?id=${deficiencyId}`)
      .send({ state: 'requires-action' }) // non-sense update
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const { meta = {} } = res.body;
        const [warning] = meta.warnings || [];
        const actual = warning || {};
        expect(updateRecord.called).to.equal(
          false,
          'did not invoke update record'
        );
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('resolves JSON-API response payload of sucessful update(s)', done => {
    const deficiencyId = uuid();
    const changes = { state: 'closed' }; // valid request
    const deficiency = mocking.createDeficiency({
      state: 'requires-action',
      inspection: uuid(),
      property: uuid(),
      item: uuid(),
    });
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));
    sinon.stub(deficiencyModel, 'firestoreUpdateRecord').resolves();

    const updatedAt = Math.round(Date.now() / 1000);
    const expected = {
      id: deficiencyId,
      type: 'deficient-item',
      attributes: updateDeficiency(deficiency, changes, USER_ID, updatedAt),
    };

    request(createApp())
      .put(`/t?id=${deficiencyId}&updatedAt=${updatedAt}`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(({ body }) => {
        const [actual] = body.data;

        // Munge state history ID, can be different
        if (actual && actual.attributes && actual.attributes.stateHistory) {
          const [oldId] = Object.keys(actual.attributes.stateHistory);
          const [newId] = Object.keys(expected.attributes.stateHistory);
          actual.attributes.stateHistory[newId] =
            actual.attributes.stateHistory[oldId];
          delete actual.attributes.stateHistory[oldId];
        }

        expect(actual).to.deep.equal(expected);
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
    putBatch({
      collection: () => {},
      batch: () => ({
        update: () => {},
        commit: () => Promise.resolve(),
      }),
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: USER_ID };
  next();
}
