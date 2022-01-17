// const express = require('express');
// const request = require('supertest');
// const { expect } = require('chai');
const sinon = require('sinon');
// const uuid = require('../../../test-helpers/uuid');
// const propertiesModel = require('../../../models/properties');
// const inspectionsModel = require('../../../models/inspections');
// const notificationsModel = require('../../../models/notifications');
// const handler = require('../../../inspections/api/patch-report-pdf');
// const createReportPdf = require('../../../inspections/report-pdf/create');
// const uploader = require('../../../inspections/report-pdf/uploader');
// const mocking = require('../../../test-helpers/mocking');
// const inspImages = require('../../../inspections/report-pdf/inspection-images');
const log = require('../../../utils/logger');
// const firebase = require('../../../test-helpers/firebase');

describe('Inspections | API | PATCH Report PDF', () => {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  // it('rejects request for non-existent inspection', async () => {
  //   let body = null;
  //   const inspectionId = uuid();

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(400)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.errors[0].detail).to.contain(
  //     `inspection "${inspectionId}" could not be found`
  //   );
  // });

  // it('rejects request for inspection without property association', async () => {
  //   let body = null;
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: '' });

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(400)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.errors[0].detail).to.contain(
  //     `inspection "${inspectionId}" not associated with a property`
  //   );
  // });

  // it('rejects request for incomplete inspection', async () => {
  //   let body = null;
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({
  //     property: propertyId,
  //     inspectionCompleted: false,
  //   });

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(400)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.errors[0].detail).to.contain(
  //     `inspection "${inspectionId}" not completed`
  //   );
  // });

  // it("immediately resolves inspection when its' report is already generating", async () => {
  //   let body = null;
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({
  //     property: propertyId,
  //     inspectionReportStatus: 'generating',
  //   });

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(202)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.data.attributes.inspectionReportStatus).to.equal('generating');
  // });

  // it('immediately returns inspection report attributes when already up to date', async () => {
  //   let body = null;
  //   const now = Math.round(Date.now() / 1000);
  //   const expected = {
  //     inspectionReportURL: '/test',
  //     inspectionReportStatus: 'completed_success',
  //     inspectionReportUpdateLastDate: now,
  //   };
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({
  //     property: propertyId,
  //     updatedLastDate: now - 1,
  //     ...expected,
  //   });

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(200)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.data.attributes).to.deep.equal(expected);
  // });

  // it('rejects request for non-existent associated property', async () => {
  //   let body = null;
  //   const inspectionId = uuid();
  //   const propertyId = uuid();
  //   const inspection = createInspection({ property: propertyId });

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(400)
  //     .then(res => {
  //       body = res.body;
  //     });

  //   expect(body.errors[0].detail).to.contain(
  //     `associated property "${propertyId}" could not be recovered`
  //   );
  // });

  // it('sets inspection report status to generating', async () => {
  //   const expected = 'generating';
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   let actual = '';
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon.stub(inspectionsModel, 'upsertRecord').callsFake((db, id, update) => {
  //     actual = update.inspectionReportStatus;
  //     return Promise.reject(Error('err'));
  //   });

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500);

  //   expect(actual).to.equal(expected);
  // });

  // it('sets inspection report status to failed when attachment did not load', async () => {
  //   const expected = 'completed_failure';
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   let actual = '';
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .callsFake((db, id, update) => {
  //       actual = update.inspectionReportStatus;
  //       return Promise.reject(Error('err'));
  //     });
  //   sinon.stub(inspImages, 'download').rejects(Error('err'));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.equal('unexpected error');
  //     });

  //   expect(actual).to.equal(expected);
  // });

  // it('sets inspection report status to failed upon report generation failure', async () => {
  //   const expected = 'completed_failure';
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   let actual = '';
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .callsFake((db, id, update) => {
  //       actual = update.inspectionReportStatus;
  //       return Promise.resolve();
  //     });
  //   sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
  //   sinon.stub(createReportPdf._proto, 'generatePdf').rejects(Error('err'));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.equal(
  //         'Inspection PDF generation failed'
  //       );
  //     });

  //   expect(actual).to.equal(expected);
  // });

  // it('sets inspection report status to failed report fails to upload', async () => {
  //   const expected = 'completed_failure';
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   let actual = '';
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .callsFake((db, id, update) => {
  //       actual = update.inspectionReportStatus;
  //       return Promise.resolve();
  //     });
  //   sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
  //   sinon
  //     .stub(createReportPdf._proto, 'generatePdf')
  //     .resolves(Buffer.from([0]));
  //   sinon.stub(uploader, 's3').rejects(Error('err'));

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.equal(
  //         'Inspection Report PDF did not save'
  //       );
  //     });

  //   expect(actual).to.equal(expected);
  // });

  // it('sets inspection report status to failed when inspection write fails', async () => {
  //   const expected = 'completed_failure';
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   let actual = '';
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .rejects() // write success
  //     .onThirdCall()
  //     .callsFake((db, id, update) => {
  //       actual = update.inspectionReportStatus;
  //       return Promise.resolve();
  //     });
  //   sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
  //   sinon
  //     .stub(createReportPdf._proto, 'generatePdf')
  //     .resolves(Buffer.from([0]));
  //   sinon.stub(uploader, 's3').resolves('/url/test');

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(500)
  //     .then(res => {
  //       expect(res.body.errors[0].detail).to.equal('unexpected error');
  //     });

  //   expect(actual).to.equal(expected);
  // });

  // it('sends notification upon successful PDF report creation', async () => {
  //   const expected = true;
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .resolves();
  //   sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
  //   sinon
  //     .stub(createReportPdf._proto, 'generatePdf')
  //     .resolves(Buffer.from([0]));
  //   sinon.stub(uploader, 's3').resolves('/url/test');
  //   const result = sinon.stub(notificationsModel, 'addRecord').resolves();

  //   await request(createApp())
  //     .patch(`/${inspectionId}`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(201);

  //   const actual = result.called;
  //   expect(actual).to.equal(expected);
  // });

  // it('does not send notification in incognito mode', async () => {
  //   const expected = false;
  //   const propertyId = uuid();
  //   const inspectionId = uuid();
  //   const inspection = createInspection({ property: propertyId });
  //   const property = mocking.createProperty();

  //   // Stubs
  //   sinon
  //     .stub(inspectionsModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(inspectionId, inspection));
  //   sinon
  //     .stub(propertiesModel, 'findRecord')
  //     .resolves(firebase.createDocSnapshot(propertyId, property));
  //   sinon
  //     .stub(inspectionsModel, 'upsertRecord')
  //     .onFirstCall()
  //     .resolves()
  //     .onSecondCall()
  //     .resolves();
  //   sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
  //   sinon
  //     .stub(createReportPdf._proto, 'generatePdf')
  //     .resolves(Buffer.from([0]));
  //   sinon.stub(uploader, 's3').resolves('/url/test');
  //   const result = sinon.stub(notificationsModel, 'addRecord').resolves();

  //   await request(createApp())
  //     .patch(`/${inspectionId}?incognitoMode=true`)
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(201);

  //   const actual = result.called;
  //   expect(actual).to.equal(expected);
  // });
});

// function createApp() {
//   const app = express();
//   app.patch('/:inspectionId', handler({ collection: () => {} }));
//   return app;
// }

// function createInspection(inspConfig = {}) {
//   const timestamp = Math.round(Date.now() / 1000);

//   return {
//     id: uuid(),
//     property: uuid(),
//     inspectionCompleted: true,
//     creationDate: timestamp,
//     completionDate: timestamp + 5000,
//     score: 100,
//     templateName: 'test',
//     template: { name: 'test' },
//     inspectionReportURL: 'https://test.com/img.pdf',
//     ...inspConfig,
//   };
// }
