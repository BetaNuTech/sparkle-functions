const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationsModel = require('../../../models/integrations');
const deleteAuth = require('../../../clickup/api/delete-auth');

describe('ClickUp | API | DELETE Authorization', () => {
  afterEach(() => sinon.restore());

  it('returns JSON-API formatted error message when system credentials failed to delete', done => {
    const expected = 'Failed to remove ClickUp integration';

    sinon.stub(systemModel, 'removeClickUp').rejects(Error('failed'));

    request(createApp())
      .delete('/c')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns JSON-API formatted error message when integration details failed to delete', done => {
    const expected = 'Failed to remove ClickUp integration';

    sinon.stub(systemModel, 'removeClickUp').resolves();
    sinon.stub(systemModel, 'removeAllClickUpProperties').resolves();
    sinon
      .stub(integrationsModel, 'removeClickUp')
      .rejects(Error('failed'));

    request(createApp())
      .delete('/c')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns empty success response when ClickUp auth successfully deleted', done => {
    sinon.stub(systemModel, 'removeClickUp').resolves();
    sinon.stub(systemModel, 'removeAllClickUpProperties').resolves();
    sinon.stub(integrationsModel, 'removeClickUp').resolves();

    request(createApp())
      .delete('/c')
      .send()
      .expect(204)
      .then(() => done())
      .catch(done);
  });

  it('successfully removes system ClickUp credentials', async () => {
    const removeClickUpStub = sinon.stub(systemModel, 'removeClickUp').resolves();
    sinon.stub(systemModel, 'removeAllClickUpProperties').resolves();
    sinon.stub(integrationsModel, 'removeClickUp').resolves();

    await request(createApp())
      .delete('/c')
      .send()
      .expect(204);

    expect(removeClickUpStub.calledOnce).to.equal(true);
  });

  it('successfully removes all property ClickUp integrations', async () => {
    sinon.stub(systemModel, 'removeClickUp').resolves();
    const removeAllIntegrationsStub = sinon
      .stub(systemModel, 'removeAllClickUpProperties')
      .resolves();
    sinon.stub(integrationsModel, 'removeClickUp').resolves();

    await request(createApp())
      .delete('/c')
      .send()
      .expect(204);

    expect(removeAllIntegrationsStub.calledOnce).to.equal(true);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/c',
    stubAuth,
    deleteAuth({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}