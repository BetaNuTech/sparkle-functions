const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const integrationsModel = require('../../../models/integrations');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const deletePropertyIntegration = require('../../../clickup/api/delete-property-integration');

describe('ClickUp | API | DELETE Property Integration', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when property does not exist', done => {
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .delete('/properties/prop123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.equal('Property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when property has no ClickUp integration', done => {
    const mockProperty = {
      name: 'Test Property',
      address: '123 Main St'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });

    request(createApp())
      .delete('/properties/prop123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.equal('ClickUp integration not found');
        done();
      })
      .catch(done);
  });

  it('deletes property integration successfully', done => {
    const mockProperty = {
      name: 'Test Property',
      address: '123 Main St'
    };

    const existingIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies',
      jobsListId: 'list456',
      jobsListName: 'Jobs',
      createdAt: 1234567890,
      updatedAt: 1234567900
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    // Mock database deletion
    const mockDb = {
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({
          delete: sinon.stub().resolves()
        })
      })
    };

    const app = express();
    app.delete(
      '/properties/:propertyId',
      stubAuth,
      deletePropertyIntegration(mockDb)
    );

    request(app)
      .delete('/properties/prop123')
      .expect(204)
      .then(res => {
        expect(res.body).to.deep.equal({});
        done();
      })
      .catch(done);
  });

  it('cleans up system ClickUp references on deletion', async () => {
    const mockProperty = { name: 'Test Property' };
    const existingIntegration = { spaceId: 'space123', spaceName: 'Test Space' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    const deleteStub = sinon.stub().resolves();
    const mockDb = {
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({
          delete: deleteStub
        })
      })
    };

    const app = express();
    app.delete(
      '/properties/:propertyId',
      stubAuth,
      deletePropertyIntegration(mockDb)
    );

    await request(app)
      .delete('/properties/prop123')
      .expect(204);

    expect(deleteStub.called).to.equal(true);
    expect(mockDb.collection.calledWith('system')).to.equal(true);
  });

  it('supports incognito mode to skip notifications', done => {
    const mockProperty = { name: 'Test Property' };
    const existingIntegration = { spaceId: 'space123', spaceName: 'Test Space' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').resolves();
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({
          delete: sinon.stub().resolves()
        })
      })
    };

    const app = express();
    app.delete(
      '/properties/:propertyId',
      stubAuth,
      deletePropertyIntegration(mockDb)
    );

    request(app)
      .delete('/properties/prop123?incognitoMode=true')
      .expect(204)
      .then(res => {
        expect(notificationStub.called).to.equal(false);
        done();
      })
      .catch(done);
  });

  it('includes integration details in notification', done => {
    const mockProperty = { name: 'Test Property' };
    const existingIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies List',
      jobsListId: 'list456',
      jobsListName: 'Jobs List'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').resolves();
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({
          delete: sinon.stub().resolves()
        })
      })
    };

    const app = express();
    app.delete(
      '/properties/:propertyId',
      stubAuth,
      deletePropertyIntegration(mockDb)
    );

    request(app)
      .delete('/properties/prop123')
      .expect(204)
      .then(res => {
        expect(notificationStub.called).to.equal(true);
        const notificationData = notificationStub.firstCall.args[1];
        expect(notificationData.title).to.equal('ClickUp Integration Removed for Property');
        expect(notificationData.creator).to.equal('123');
        expect(notificationData.property).to.equal('prop123');
        done();
      })
      .catch(done);
  });

  it('handles database errors gracefully during property lookup', done => {
    sinon.stub(propertiesModel, 'findRecord').rejects(Error('Database error'));

    request(createApp())
      .delete('/properties/prop123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('unexpected error');
        done();
      })
      .catch(done);
  });

  it('handles database errors gracefully during integration deletion', done => {
    const mockProperty = { name: 'Test Property' };
    const existingIntegration = { spaceId: 'space123', spaceName: 'Test Space' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').rejects(Error('Delete failed'));

    request(createApp())
      .delete('/properties/prop123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('unexpected error');
        done();
      })
      .catch(done);
  });

  it('continues even if system cleanup fails', done => {
    const mockProperty = { name: 'Test Property' };
    const existingIntegration = { spaceId: 'space123', spaceName: 'Test Space' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'removeClickUpProperty').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({
          delete: sinon.stub().rejects(Error('System cleanup failed'))
        })
      })
    };

    const app = express();
    app.delete(
      '/properties/:propertyId',
      stubAuth,
      deletePropertyIntegration(mockDb)
    );

    request(app)
      .delete('/properties/prop123')
      .expect(204)
      .then(res => {
        expect(res.body).to.deep.equal({});
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.delete(
    '/properties/:propertyId',
    stubAuth,
    deletePropertyIntegration({
      collection: () => ({
        doc: () => ({
          delete: () => Promise.resolve()
        })
      })
    })
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { 
    id: '123', 
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  };
  next();
}