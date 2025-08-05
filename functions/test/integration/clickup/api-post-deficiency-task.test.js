const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const deficiencyModel = require('../../../models/deficient-items');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const integrationsModel = require('../../../models/integrations');
const systemModel = require('../../../models/system');
const notificationsModel = require('../../../models/notifications');
const clickupService = require('../../../services/clickup');
const postDeficiencyTask = require('../../../clickup/api/post-deficiency-task');

describe('ClickUp | API | POST Deficiency Task', () => {
  afterEach(() => sinon.restore());

  it('returns a helpful error when deficiency does not exist', done => {
    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('property or deficiency could not be found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when deficiency has no property association', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      // Missing property field
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('property or deficiency could not be found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when property does not exist', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123'
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain("Deficiency's property could not be found");
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp task already exists', done => {
    const mockDeficiency = { itemTitle: 'Test Deficiency', state: 'requires-action', property: 'prop123' };
    const mockProperty = { name: 'Test Property' };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves('existing-task-id');

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('already has published ClickUp Task');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp integration is not configured', done => {
    const mockDeficiency = { itemTitle: 'Test Deficiency', state: 'requires-action', property: 'prop123' };
    const mockProperty = { name: 'Test Property' };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => null });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('ClickUp integration details for property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when deficiencies list is not configured', done => {
    const mockDeficiency = { itemTitle: 'Test Deficiency', state: 'requires-action', property: 'prop123' };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      // Missing deficienciesListId
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('ClickUp integration details for property not found');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when inspection does not exist', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123'
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => null });

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('Inspection of Deficiency does not exist');
        done();
      })
      .catch(done);
  });

  it('returns a helpful error when ClickUp list cannot be accessed', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123'
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };
    const mockInspection = {
      template: {
        items: {
          item123: {
            title: 'Test Item',
            mainInputSelection: 2
          }
        }
      }
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => mockInspection });
    sinon.stub(clickupService, 'fetchList').rejects(Error('API error'));

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(409)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('Could not access ClickUp deficiencies list');
        done();
      })
      .catch(done);
  });

  it('creates ClickUp task successfully for deficiency', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123',
      itemScore: 3,
      itemInspectorNotes: 'Needs attention',
      currentPlanToFix: 'Fix immediately',
      sectionTitle: 'Kitchen',
      sectionSubtitle: 'Appliances',
      currentResponsibilityGroup: 'Property Manager',
      currentDueDateDay: '2024-12-31',
      createdAt: 1234567890
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };
    const mockInspection = {
      template: {
        items: {
          item123: {
            title: 'Test Item',
            mainInputSelection: 4,
            mainInputThreeSelection: 3
          }
        }
      }
    };
    const mockListDetails = {
      statuses: [
        { status: 'TO DO', type: 'open', color: '#d3d3d3' },
        { status: 'IN PROGRESS', type: 'custom', color: '#4194f6' }
      ]
    };
    const mockClickUpTask = {
      id: 'task123',
      name: 'Test Deficiency',
      status: { status: 'TO DO' },
      url: 'https://app.clickup.com/t/task123'
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => mockInspection });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/deficiencies/:deficiencyId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postDeficiencyTask(mockDb)
    );

    request(app)
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201)
      .then(res => {
        expect(res.body.data.id).to.equal('task123');
        expect(res.body.data.type).to.equal('clickup-task');
        expect(res.body.data.attributes.name).to.equal('Test Deficiency');
        expect(res.body.data.attributes.status).to.equal('TO DO');
        expect(res.body.data.relationships.deficiency.data.id).to.equal('def123');
        done();
      })
      .catch(done);
  });

  it('handles ClickUp task creation failure gracefully', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123'
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };
    const mockInspection = {
      template: {
        items: {
          item123: { title: 'Test Item', mainInputSelection: 2 }
        }
      }
    };
    const mockListDetails = {
      statuses: [{ status: 'TO DO', type: 'open' }]
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => mockInspection });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').rejects(Error('ClickUp API failed'));

    request(createApp())
      .post('/deficiencies/def123/clickup/task')
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(500)
      .then(res => {
        const actual = res.body.errors[0].detail;
        expect(actual).to.contain('Failed to create ClickUp task');
        done();
      })
      .catch(done);
  });

  it('supports notification creation when notify=true', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123',
      sectionTitle: 'Kitchen',
      sectionSubtitle: 'Appliances'
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };
    const mockInspection = {
      template: {
        items: {
          item123: { title: 'Test Item', mainInputSelection: 2 }
        }
      }
    };
    const mockListDetails = { statuses: [{ status: 'TO DO', type: 'open' }] };
    const mockClickUpTask = {
      id: 'task123',
      name: 'Test Deficiency',
      status: { status: 'TO DO' }
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => mockInspection });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/deficiencies/:deficiencyId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postDeficiencyTask(mockDb)
    );

    request(app)
      .post('/deficiencies/def123/clickup/task?notify=true')
      .expect(201)
      .then(res => {
        expect(notificationStub.called).to.equal(true);
        const notificationData = notificationStub.firstCall.args[1];
        expect(notificationData.title).to.equal('ClickUp Task Created');
        expect(notificationData.creator).to.equal('123');
        expect(notificationData.property).to.equal('prop123');
        done();
      })
      .catch(done);
  });

  it('skips notifications in incognito mode', done => {
    const mockDeficiency = {
      itemTitle: 'Test Deficiency',
      state: 'requires-action',
      property: 'prop123',
      inspection: 'insp123',
      item: 'item123'
    };
    const mockProperty = { name: 'Test Property' };
    const mockIntegration = {
      spaceId: 'space123',
      spaceName: 'Test Space',
      deficienciesListId: 'list123',
      deficienciesListName: 'Deficiencies'
    };
    const mockInspection = {
      template: {
        items: {
          item123: { title: 'Test Item', mainInputSelection: 2 }
        }
      }
    };
    const mockListDetails = { statuses: [{ status: 'TO DO', type: 'open' }] };
    const mockClickUpTask = {
      id: 'task123',
      name: 'Test Deficiency',
      status: { status: 'TO DO' }
    };

    sinon.stub(deficiencyModel, 'findRecord').resolves({ data: () => mockDeficiency });
    sinon.stub(propertiesModel, 'findRecord').resolves({ data: () => mockProperty });
    sinon.stub(systemModel, 'findClickUpTaskId').resolves(null);
    sinon.stub(integrationsModel, 'findClickUpProperty').resolves({ data: () => mockIntegration });
    sinon.stub(inspectionsModel, 'findRecord').resolves({ data: () => mockInspection });
    sinon.stub(clickupService, 'fetchList').resolves(mockListDetails);
    sinon.stub(clickupService, 'createTask').resolves(mockClickUpTask);
    sinon.stub(systemModel, 'upsertPropertyClickUp').resolves();
    const notificationStub = sinon.stub(notificationsModel, 'addRecord').resolves();

    const mockDb = {
      batch: () => ({
        update: sinon.stub(),
        commit: sinon.stub().resolves()
      }),
      collection: sinon.stub().returns({
        doc: sinon.stub().returns({})
      })
    };

    const app = express();
    app.use(express.json());
    app.post(
      '/deficiencies/:deficiencyId/clickup/task',
      stubAuth,
      stubClickUpAuth,
      postDeficiencyTask(mockDb)
    );

    request(app)
      .post('/deficiencies/def123/clickup/task?notify=true&incognitoMode=true')
      .expect(201)
      .then(res => {
        expect(notificationStub.called).to.equal(false);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/deficiencies/:deficiencyId/clickup/task',
    stubAuth,
    stubClickUpAuth,
    postDeficiencyTask({
      batch: () => ({
        update: () => {},
        commit: () => Promise.resolve()
      }),
      collection: () => ({
        doc: () => ({})
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

function stubClickUpAuth(req, res, next) {
  req.clickupCredentials = { apiToken: 'valid_token' };
  next();
}