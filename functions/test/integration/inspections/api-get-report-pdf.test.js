const express = require('express');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const getPdf = require('../../../inspections/api/get-report-pdf');

describe('Inspections | API | GET Report PDF', () => {
  afterEach(() => sinon.restore());

  it('rejects request for non-existent inspection', async () => {
    let body = null;
    const inspectionId = uuid();

    // Stubs
    sinon.stub(inspectionsModel, 'firestoreFindRecord').resolves(createSnap());

    await request(createApp())
      .get(`/${inspectionId}`)
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
      .stub(inspectionsModel, 'firestoreFindRecord')
      .resolves(createSnap(inspection));

    await request(createApp())
      .get(`/${inspectionId}`)
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

  it('rejects request for non-existent associated property', async () => {
    let body = null;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });

    // Stubs
    sinon
      .stub(inspectionsModel, 'firestoreFindRecord')
      .resolves(createSnap(inspection));
    sinon.stub(propertiesModel, 'firestoreFindRecord').resolves(createSnap());

    await request(createApp())
      .get(`/${inspectionId}`)
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
});

function createApp() {
  const app = express();
  app.get('/:inspection', getPdf({ collection: () => {} }));
  return app;
}

function createSnap(data) {
  return {
    exists: Boolean(data),
    data: () => data,
  };
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
