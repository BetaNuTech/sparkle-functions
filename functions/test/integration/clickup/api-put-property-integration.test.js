const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const integrationsModel = require('../../../models/integrations');
const propertiesModel = require('../../../models/properties');
const notificationsModel = require('../../../models/notifications');
const putPropertyIntegration = require('../../../clickup/api/put-property-integration');

describe('ClickUp | API | PUT Property Integration', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when body is missing', done => {
    const expected = 'update body required';

    request(createApp())
      .put('/properties/prop123')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain(expected);
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when payload has invalid attributes', done => {
    const invalidPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      invalidAttribute: 'should not be allowed'
    };

    request(createApp())
      .put('/properties/prop123')
      .send(invalidPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('invalid payload attribute');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when payload has invalid values', done => {
    const invalidPayload = {
      spaceId: 123, // should be string
      spaceName: 'Test Space'
    };

    request(createApp())
      .put('/properties/prop123')
      .send(invalidPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('must be a string');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when required fields are missing', done => {
    const invalidPayload = {
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    request(createApp())
      .put('/properties/prop123')
      .send(invalidPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('spaceId and spaceName are required');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when no lists are configured', done => {
    const invalidPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space'
    };

    request(createApp())
      .put('/properties/prop123')
      .send(invalidPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('At least one list');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when property does not exist', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        const actual = res.body.errors[0].title;
        expect(actual).to.equal('Property not found');
        done();
      })
      .catch(done);
  });

  it('creates new property integration successfully', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };

    const mockProperty = {
      name: 'Test Property',
      address: '123 Main St'
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.id).to.equal('clickup-prop123');
        expect(res.body.data.type).to.equal('integration');
        expect(res.body.data.attributes.spaceId).to.equal('space123');
        expect(res.body.data.attributes.spaceName).to.equal('Test Space');
        expect(res.body.data.attributes.deficienciesListId).to.equal('list123');
        expect(res.body.data.attributes.jobsListId).to.equal('list456');
        done();
      })
      .catch(done);
  });

  it('updates existing property integration successfully', done => {
    const validPayload = {
      spaceId: 'space456',
      spaceName: 'Updated Space',
      deficienciesListId: 'list789',
      deficienciesListName: 'Updated Deficiencies'
    };

    const mockProperty = {
      name: 'Test Property',
      address: '123 Main St'
    };

    const existingIntegration = {
      spaceId: 'space123',
      spaceName: 'Old Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Old Deficiencies',
      createdAt: 1234567890
    };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => existingIntegration });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.spaceId).to.equal('space456');
        expect(res.body.data.attributes.spaceName).to.equal('Updated Space');
        expect(res.body.data.attributes.deficienciesListId).to.equal('list789');
        expect(res.body.data.attributes.createdAt).to.equal(1234567890); // preserved
        done();
      })
      .catch(done);
  });

  it('supports deficiencies-only configuration', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    const mockProperty = { name: 'Test Property' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.deficienciesListId).to.equal('list123');
        expect(res.body.data.attributes.jobsListId).to.be.undefined;
        done();
      })
      .catch(done);
  });

  it('supports jobs-only configuration', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      jobsListId: 'list456',
      jobsListName: 'Jobs'
    };

    const mockProperty = { name: 'Test Property' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.jobsListId).to.equal('list456');
        expect(res.body.data.attributes.deficienciesListId).to.be.undefined;
        done();
      })
      .catch(done);
  });

  it('supports folder configuration for deficiencies', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies',
      deficienciesFolderId: 'folder123',
      deficienciesFolderName: 'Deficiencies Folder'
    };

    const mockProperty = { name: 'Test Property' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.attributes.deficienciesFolderId).to.equal('folder123');
        expect(res.body.data.attributes.deficienciesFolderName).to.equal('Deficiencies Folder');
        done();
      })
      .catch(done);
  });

  it('supports incognito mode to skip notifications', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    const mockProperty = { name: 'Test Property' };

    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });
    sinon.stub(integrationsModel, 'setClickUpPropertyRecord').resolves();
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    request(createApp())
      .put('/properties/prop123?incognitoMode=true')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(notificationStub.called).to.equal(false);
        done();
      })
      .catch(done);
  });

  it('handles database errors gracefully', done => {
    const validPayload = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    sinon.stub(propertiesModel, 'findRecord').rejects(Error('Database error'));

    request(createApp())
      .put('/properties/prop123')
      .send(validPayload)
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('unexpected error');
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.put(
    '/properties/:propertyId',
    stubAuth,
    putPropertyIntegration({
      collection: () => {},
      batch: () => ({ commit: () => Promise.resolve() }),
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