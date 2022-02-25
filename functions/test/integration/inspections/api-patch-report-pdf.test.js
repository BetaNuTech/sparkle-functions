const express = require('express');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const handler = require('../../../inspections/api/patch-report-pdf');
const mocking = require('../../../test-helpers/mocking');
const log = require('../../../utils/logger');
const storageService = require('../../../services/storage');
const firebase = require('../../../test-helpers/firebase');
const stubs = require('../../../test-helpers/stubs');

const DB = stubs.createFirestore();
const STORAGE = stubs.createStorage();
const PUBLISHER = stubs.createPublisher();

describe('Inspections | API | PATCH Report PDF', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('rejects request for non-existent inspection', async () => {
    let body = null;
    const inspectionId = uuid();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        body = res.body;
      });

    expect(body.errors[0].detail).to.contain(
      `inspection "${inspectionId}" could not be found`
    );
  });

  it('rejects request for inspection without property association', async () => {
    let body = null;
    const inspectionId = uuid();
    const inspection = createInspection({ property: '' });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        body = res.body;
      });

    expect(body.errors[0].detail).to.contain(
      `inspection "${inspectionId}" not associated with a property`
    );
  });

  it('rejects request for incomplete inspection', async () => {
    let body = null;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({
      property: propertyId,
      inspectionCompleted: false,
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        body = res.body;
      });

    expect(body.errors[0].detail).to.contain(
      `inspection "${inspectionId}" not completed`
    );
  });

  it("immediately resolves inspection when its' report is already generating", async () => {
    let body = null;
    const nowUnix = Math.round(Date.now() / 1000);
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({
      property: propertyId,
      inspectionReportStatus: 'generating',
      inspectionReportStatusChanged: nowUnix - 1, // not past timeout
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(202)
      .then(res => {
        body = res.body;
      });

    expect(body.data.attributes.inspectionReportStatus).to.equal('generating');
  });

  it('immediately returns inspection report attributes when already up to date', async () => {
    let body = null;
    const now = Math.round(Date.now() / 1000);
    const expected = {
      inspectionReportURL: '/test',
      inspectionReportStatus: 'completed_success',
      inspectionReportUpdateLastDate: now,
    };
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({
      property: propertyId,
      updatedAt: now,
      ...expected,
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        body = res.body;
      });

    expect(body.data.attributes).to.deep.equal(expected);
  });

  it('rejects request for non-existent associated property', async () => {
    let body = null;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId));

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        body = res.body;
      });

    expect(body.errors[0].detail).to.contain(
      `associated property "${propertyId}" could not be recovered`
    );
  });

  it('rejects generating an inspection when its storage data is too large for allocated memory', async () => {
    let body = null;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(storageService, 'calculateInspectionFolderByteSize')
      .resolves(Infinity);

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        body = res.body;
      });

    expect(body.errors[0].detail).to.contain(
      `inspection "${inspectionId}" is oversized, please contact an admin`
    );
  });

  it('updates an eligible inspection into the PDF reporting queue', async () => {
    const expected = {
      inspectionReportStatus: 'queued',
      inspectionReportStatusChanged: 1, // updated from truethy source
    };
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    let actual = {};
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(PUBLISHER, 'publish').resolves();
    sinon.stub(inspectionsModel, 'updateRecord').callsFake((db, id, update) => {
      actual = update;
      // Update dynamic portion
      if (actual.inspectionReportStatusChanged) {
        expected.inspectionReportStatusChanged =
          actual.inspectionReportStatusChanged;
      }
      return Promise.resolve();
    });

    const result = await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    expect(actual, 'db write').to.deep.equal(expected);
    expect(result.body.data.attributes, 'payload').to.deep.equal(expected);
  });

  it('publishes request to generate a PDF report after successfully add it into the queue', async () => {
    const expected = true;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'updateRecord').resolves();
    const publish = sinon.stub(PUBLISHER, 'publish').resolves();

    await request(createApp())
      .patch(`/${inspectionId}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(201);

    const actual = publish.called;
    expect(actual).to.deep.equal(expected);
  });
});

function createApp() {
  const app = express();
  app.patch('/:inspectionId', handler(DB, STORAGE, PUBLISHER));
  return app;
}

function createInspection(inspConfig = {}) {
  const timestamp = Math.round(Date.now() / 1000);

  return {
    id: uuid(),
    property: uuid(),
    inspectionCompleted: true,
    creationDate: timestamp,
    completionDate: timestamp + 5000,
    score: 100,
    templateName: 'test',
    template: { name: 'test' },
    inspectionReportURL: 'https://test.com/img.pdf',
    ...inspConfig,
  };
}
