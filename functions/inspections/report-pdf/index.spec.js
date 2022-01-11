const sinon = require('sinon');
const { expect } = require('chai');
const propertiesModel = require('../../models/properties');
const inspectionsModel = require('../../models/inspections');
const notificationsModel = require('../../models/notifications');
const reportPdf = require('./index');
const createReportPdf = require('./create');
const uploader = require('./uploader');
const inspImages = require('./inspection-images');
const mocking = require('../../test-helpers/mocking');
const uuid = require('../../test-helpers/uuid');
const firebase = require('../../test-helpers/firebase');

const DB = firebase.createFirestoreStub();
const {
  UnexpectedError,
  UnfoundInspectionError,
  BadInspectionError,
  IncompleteInspectionError,
  GeneratingReportError,
  ReportUpToDateError,
  UnfoundPropertyError,
  GenerationFailError,
  ReportUrlLookupError,
} = reportPdf;

describe('Inspections | Report PDF', () => {
  afterEach(() => sinon.restore());

  it('rejects failed inspection lookup with unexpected error', async () => {
    const expected = true;
    const inspectionId = uuid();

    // Stubs
    sinon.stub(inspectionsModel, 'findRecord').rejects(Error('oops'));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof UnexpectedError;
    expect(actual).to.equal(expected);
  });

  it('rejects non-existent inspection with unfound inspection error', async () => {
    const expected = true;
    const inspectionId = uuid();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof UnfoundInspectionError;
    expect(actual).to.equal(expected);
  });

  it('rejects inspection without property with bad inspection error', async () => {
    const expected = true;
    const inspectionId = uuid();
    const inspection = createInspection({ property: '' });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof BadInspectionError;
    expect(actual).to.equal(expected);
  });

  it('uses an optional inspection when provided', async () => {
    const expected = true;
    const inspectionId = uuid();
    const inspection = createInspection();
    delete inspection.property; // cause bad inspection error

    // Stubs
    const findRecord = sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    let result = null;
    try {
      await reportPdf.regenerate(
        DB,
        inspectionId,
        false,
        uuid(),
        'testor',
        'test@email.co',
        inspection
      );
    } catch (err) {
      result = err;
    }

    // Rejects with bad inspection
    // error and does not call find record
    const actual =
      result instanceof BadInspectionError && findRecord.called === false;
    expect(actual).to.equal(expected);
  });

  it('rejects for incomplete inspection with incomplete inspection error', async () => {
    const expected = true;
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

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof IncompleteInspectionError;
    expect(actual).to.equal(expected);
  });

  it('rejects for an inspection already generating a report with a generating report error', async () => {
    const expected = true;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({
      property: propertyId,
      inspectionReportStatus: 'generating',
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof GeneratingReportError;
    expect(actual).to.equal(expected);
  });

  it('reject for an inspection with a report already up to date with a report up to date error', async () => {
    const expected = true;
    const now = Math.round(Date.now() / 1000);
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({
      property: propertyId,
      updatedLastDate: now - 1,
      inspectionReportURL: '/test',
      inspectionReportStatus: 'completed_success',
      inspectionReportUpdateLastDate: now,
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof ReportUpToDateError;
    expect(actual).to.equal(expected);
  });

  it('rejects for a non-existent associated property with a unfound property error', async () => {
    const expected = true;
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

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof UnfoundPropertyError;
    expect(actual).to.equal(expected);
  });

  it('sets an eligible inspection report status to generating', async () => {
    const expected = 'generating';
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    let actual = '';
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(inspectionsModel, 'upsertRecord').callsFake((db, id, update) => {
      actual = update.inspectionReportStatus;
      return Promise.reject(Error('err'));
    });

    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {} // eslint-disable-line

    expect(actual).to.equal(expected);
  });

  it('sets inspection report status to failed when attachment did not load', async () => {
    const expected = 'completed_failure';
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    let actual = '';
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(inspectionsModel, 'upsertRecord')
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .callsFake((db, id, update) => {
        actual = update.inspectionReportStatus;
        return Promise.reject(Error('err'));
      });
    sinon.stub(inspImages, 'download').rejects(Error('err'));

    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {} // eslint-disable-line

    expect(actual).to.equal(expected);
  });

  it('sets inspection report status to failed upon report generation failure', async () => {
    const expected = 'completed_failure';
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    let actual = '';
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon
      .stub(inspectionsModel, 'upsertRecord')
      .onFirstCall()
      .resolves()
      .onSecondCall()
      .callsFake((db, id, update) => {
        actual = update.inspectionReportStatus;
        return Promise.resolve();
      });
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon.stub(createReportPdf._proto, 'generatePdf').rejects(Error('err'));

    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {} // eslint-disable-line

    expect(actual).to.equal(expected);
  });

  it('rejects for a failed report generation with a unfound property error', async () => {
    const expected = true;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon.stub(createReportPdf._proto, 'generatePdf').rejects(Error('err'));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof GenerationFailError;
    expect(actual).to.equal(expected);
  });

  it('rejects for a failed report URL download with a report URL lookup error', async () => {
    const expected = true;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon
      .stub(createReportPdf._proto, 'generatePdf')
      .resolves(Buffer.from([0]));
    sinon.stub(uploader, 's3').rejects(Error('fail'));

    let result = null;
    try {
      await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof ReportUrlLookupError;
    expect(actual).to.equal(expected);
  });

  it('resolves an inspection and a list of warnings', async () => {
    const expected = [true, true];
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon
      .stub(createReportPdf._proto, 'generatePdf')
      .resolves(Buffer.from([0]));
    sinon.stub(uploader, 's3').resolves('/url/test');
    sinon.stub(notificationsModel, 'addRecord').rejects(Error('fail'));

    let result = null;
    try {
      result = await reportPdf.regenerate(DB, inspectionId);
    } catch (err) {} // eslint-disable-line

    const actual = [
      Boolean(result.inspection),
      Boolean(result.warnings.length),
    ];
    expect(actual).to.deep.equal(expected);
  });
});

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
