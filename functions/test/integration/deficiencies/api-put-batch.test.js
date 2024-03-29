const express = require('express');
const bodyParser = require('body-parser');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const log = require('../../../utils/logger');
const uuid = require('../../../test-helpers/uuid');
const stubs = require('../../../test-helpers/stubs');
const mocking = require('../../../test-helpers/mocking');
const propertyModel = require('../../../models/properties');
const deficiencyModel = require('../../../models/deficient-items');
const notificationsModel = require('../../../models/notifications');
const updateDeficiency = require('../../../deficient-items/utils/update-deficient-item');
const unflatten = require('../../../utils/unflatten-string-attrs');
const putBatch = require('../../../deficient-items/api/put-batch');

const USER_ID = '123';

describe('Deficient Items | API | PUT Batch', () => {
  afterEach(() => sinon.restore());

  it('rejects request missing any deficient item ids', done => {
    request(createApp())
      .put('/t')
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

  it('rejects request with invalid update payload', done => {
    request(createApp())
      .put('/t?id=1')
      .send({ state: false })
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: Update is not valid'
        );
        done();
      })
      .catch(done);
  });

  it('rejects request missing update payload', done => {
    request(createApp())
      .put('/t?id=1')
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
    sinon.stub(deficiencyModel, 'updateRecord').rejects(Error('fail'));
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
    const updateRecord = sinon.stub(deficiencyModel, 'updateRecord').resolves();

    request(createApp())
      .put(`/t?id=${deficiencyId}`)
      .send({ state: 'requires-action' }) // non-sense update
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
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

  it('sends an error when no deficiency was modified by user update', done => {
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
    sinon.stub(log, 'warn').callsFake(() => {}); // silence
    sinon.stub(deficiencyModel, 'updateRecord').resolves();

    request(createApp())
      .put(`/t?id=${deficiencyId}`)
      .send({ state: 'requires-action' }) // non-sense update
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const [error] = res.body.errors;
        expect(error.title).to.equal('No Change');
        done();
      })
      .catch(done);
  });

  it('reject forbidden request to transition deficient item without necessary permission', done => {
    const deficiencyId = uuid();
    const changes = {
      state: 'deferred', // permissioned transition
      // 4 days from now
      currentDeferredDate: Math.round(Date.now() * 1000) + 4 * 86400,
      currentPlanToFix: 'fasd',
      currentResponsibilityGroup: 'site_level_in-house',
    };
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
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    const unpermissionedUser = mocking.createUser({
      admin: false,
      corporate: false,
    });

    request(createApp(unpermissionedUser))
      .put(`/t?id=${deficiencyId}`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(403)
      .then(() => done())
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
    sinon.stub(deficiencyModel, 'updateRecord').resolves();

    const updatedAt = Math.round(Date.now() / 1000);
    const expected = {
      id: deficiencyId,
      type: 'deficient-item',
      attributes: unflatten(
        updateDeficiency(deficiency, changes, USER_ID, updatedAt)
      ),
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

  it('creates global notifications for all progress note updates', async () => {
    const expected = 'Progress Note just added';
    const deficiencyId = uuid();
    const changes = { progressNote: 'progress' };
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'pending',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
    });
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(stubs.wrapSnapshot(property));
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    const updatedAt = Math.round(Date.now() / 1000);

    await request(createApp())
      .put(`/t?id=${deficiencyId}&updatedAt=${updatedAt}&notify=true`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { summary: '' }).summary;

    expect(actual).to.contain(expected);
  });

  it('creates global notifications for all state change updates', async () => {
    const expected = 'Deficient Item moved';
    const deficiencyId = uuid();
    const changes = { state: 'go-back' };
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'incomplete',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
    });
    const updatedDeficiency = mocking.createDeficiency({
      state: 'go-back',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
    });
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .onFirstCall()
      .resolves(stubs.wrapSnapshot([deficiency]))
      .onSecondCall()
      .resolves(stubs.wrapSnapshot([updatedDeficiency]));
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(stubs.wrapSnapshot(property));
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    const updatedAt = Math.round(Date.now() / 1000);

    await request(createApp())
      .put(`/t?id=${deficiencyId}&updatedAt=${updatedAt}&notify=true`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { markdownBody: '' }).markdownBody;

    expect(actual).to.contain(expected);
  });

  it('creates global notifications for all non-state updates', async () => {
    const expected = '*Deficient Item Updated*';
    const deficiencyId = uuid();
    const changes = { currentResponsibilityGroup: 'site_level_in-house' };
    const propertyId = uuid();
    const property = mocking.createProperty({ id: propertyId });
    const deficiency = mocking.createDeficiency({
      state: 'requires-action',
      inspection: uuid(),
      property: propertyId,
      item: uuid(),
    });
    delete deficiency.currentDueDate; // needed for state change
    deficiency.id = deficiencyId;
    sinon
      .stub(deficiencyModel, 'findMany')
      .resolves(stubs.wrapSnapshot([deficiency]));
    sinon
      .stub(propertyModel, 'findRecord')
      .resolves(stubs.wrapSnapshot(property));
    sinon.stub(deficiencyModel, 'updateRecord').resolves();
    const addNotification = sinon
      .stub(notificationsModel, 'addRecord')
      .resolves();

    const updatedAt = Math.round(Date.now() / 1000);

    await request(createApp())
      .put(`/t?id=${deficiencyId}&updatedAt=${updatedAt}&notify=true`)
      .send(changes)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200);

    const result = addNotification.firstCall || { args: [] };
    const actual = (result.args[1] || { markdownBody: '' }).markdownBody;

    expect(actual).to.contain(expected);
  });
});

function createApp(user = {}) {
  const app = express();
  app.put(
    '/t',
    bodyParser.json(),
    stubAuth(user),
    putBatch(
      {
        collection: () => {},
        batch: () => ({
          update: () => {},
          commit: () => Promise.resolve(),
        }),
      },
      true // enable progress note notifications
    )
  );
  return app;
}

function stubAuth(user = {}) {
  return (req, res, next) => {
    req.user = Object.assign({ id: USER_ID }, user);
    next();
  };
}
