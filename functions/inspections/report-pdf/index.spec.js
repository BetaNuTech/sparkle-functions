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
const { createStorage } = require('../../test-helpers/stubs');
const config = require('../../config');
const storageService = require('../../services/storage');

const MAX_TIMEOUT = config.inspection.reportPdfGenerationMaxTimeout;
const MAX_INSPECTION_BYTE_SIZE = config.inspection.reportPdfMemoryInBytes;
const DB = firebase.createFirestoreStub();
const STORAGE = createStorage();
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
  OversizedStorageError,
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof BadInspectionError;
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    const nowUnix = Math.round(Date.now() / 1000);
    const inspection = createInspection({
      property: propertyId,
      inspectionReportStatus: 'generating',
      inspectionReportStatusChanged: nowUnix - MAX_TIMEOUT + 1, // not past timeout
    });

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));

    let result = null;
    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof GeneratingReportError;
    expect(actual).to.equal(expected);
  });

  it('allows regenerating an in progress PDF report when past max generation timeout', async () => {
    const expected = 'generating';
    const propertyId = uuid();
    const inspectionId = uuid();
    const nowUnix = Math.round(Date.now() / 1000);
    const inspection = createInspection({
      property: propertyId,
      inspectionReportStatus: 'generating',
      inspectionReportStatusChanged: nowUnix - MAX_TIMEOUT - 1,
    });
    const property = mocking.createProperty();

    // Stubs
    let actual = '';
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').callsFake((db, id, update) => {
      actual = update.inspectionReportStatus;
      return Promise.reject(Error('fail'));
    });

    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {} // eslint-disable-line

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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof UnfoundPropertyError;
    expect(actual).to.equal(expected);
  });

  it('rejects generating an inspection when its storage data is too large for allocated memory', async () => {
    const expected = true;
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
      .resolves(MAX_INSPECTION_BYTE_SIZE);

    let result = null;
    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {
      result = err;
    }

    const actual = result instanceof OversizedStorageError;
    expect(actual).to.equal(expected);
  });

  it('should return immediately after error checks in dry run mode', async () => {
    const expected = false;
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
    const upsertRecord = sinon
      .stub(inspectionsModel, 'upsertRecord')
      .resolves();

    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId, '', '', true);
    } catch (err) {} // eslint-disable-line

    const actual = upsertRecord.called;
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').callsFake((db, id, update) => {
      actual = update.inspectionReportStatus;
      return Promise.reject(Error('err'));
    });

    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {} // eslint-disable-line

    expect(actual).to.equal(expected);
  });

  it('sets an eligible inspection report status change timestamp when set to generating', async () => {
    const expected = true;
    const propertyId = uuid();
    const inspectionId = uuid();
    const inspection = createInspection({ property: propertyId });
    const property = mocking.createProperty();
    delete inspection.inspectionReportStatusChanged; // sanity check

    // Stubs
    let actual = false;
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').callsFake((db, id, update) => {
      actual = Boolean(update.inspectionReportStatusChanged);
      return Promise.reject(Error('err'));
    });

    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
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
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon.stub(createReportPdf._proto, 'generatePdf').rejects(Error('err'));

    let result = null;
    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon
      .stub(createReportPdf._proto, 'generatePdf')
      .resolves(Buffer.from([0]));
    sinon.stub(uploader, 's3').rejects(Error('fail'));

    let result = null;
    try {
      await reportPdf.regenerate(DB, STORAGE, inspectionId);
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
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspectionsModel, 'upsertRecord').resolves();
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon
      .stub(createReportPdf._proto, 'generatePdf')
      .resolves(Buffer.from([0]));
    sinon.stub(uploader, 's3').resolves('/url/test');
    sinon.stub(notificationsModel, 'addRecord').rejects(Error('fail'));

    let result = null;
    try {
      result = await reportPdf.regenerate(DB, STORAGE, inspectionId);
    } catch (err) {} // eslint-disable-line

    const actual = [
      Boolean(result.inspection),
      Boolean(result.warnings.length),
    ];
    expect(actual).to.deep.equal(expected);
  });

  it("updates inspections report date with its' updated last date", async () => {
    const expected = 485671;
    const inspectionId = uuid();
    const propertyId = uuid();
    const inspection = createInspection({
      property: propertyId,
      updatedLastDate: expected,
    });
    const property = mocking.createProperty();

    // Stubs
    sinon
      .stub(inspectionsModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(inspectionId, inspection));
    sinon
      .stub(propertiesModel, 'findRecord')
      .resolves(firebase.createDocSnapshot(propertyId, property));
    sinon.stub(storageService, 'calculateInspectionFolderByteSize').resolves(0);
    sinon.stub(inspImages, 'download').resolves({ template: { items: {} } });
    sinon
      .stub(createReportPdf._proto, 'generatePdf')
      .resolves(Buffer.from([0]));
    sinon.stub(uploader, 's3').resolves('/url/test');
    sinon.stub(notificationsModel, 'addRecord').rejects(Error('fail'));
    const upsert = sinon.stub(inspectionsModel, 'upsertRecord').resolves();

    await reportPdf.regenerate(DB, STORAGE, inspectionId);

    const result = upsert.secondCall || { args: [] };
    const updatePayload = result.args[2] || {};
    const actual = updatePayload.inspectionReportUpdateLastDate || 0;
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
