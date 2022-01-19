const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const stubs = require('../../../test-helpers/stubs');
const uuid = require('../../../test-helpers/uuid');
const inspectionsModel = require('../../../models/inspections');
const errorsService = require('../../../services/errors');
const log = require('../../../utils/logger');
const createHandler = require('../../../inspections/pubsub/report-pdf-sync');

const DB = stubs.createFirestore();
const PUBSUB = stubs.createPubSubHandler();

describe('Inspections | Pubsub | Report PDF Sync', function() {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('does not send an error report when no inspection report PDFs have stalled', async () => {
    const expected = false;

    sinon.stub(inspectionsModel, 'query').resolves(stubs.wrapSnapshot([])); // none found
    const sendReport = sinon.stub(errorsService, 'report').resolves();

    await createHandler(DB, PUBSUB, 'topic');

    const actual = sendReport.called;
    expect(actual).to.equal(expected);
  });

  it('sends an error report summarizing the number of stalled inspection report PDFs', async () => {
    const expected = 'found 1 stalled inspection report PDF (system)';
    const inspection = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      inspectionReportStatus: 'queued',
      inspectionReportStatusChanged: 1, // passed max timeout
    });

    sinon
      .stub(inspectionsModel, 'query')
      .resolves(stubs.wrapSnapshot([inspection]));
    sinon.stub(inspectionsModel, 'updateRecord').resolves();
    const sendReport = sinon.stub(errorsService, 'report').resolves();

    await createHandler(DB, PUBSUB, 'topic');

    const result = sendReport.firstCall || { args: [] };
    const actual = result.args[0];
    expect(actual).to.equal(expected);
  });

  it('sets all stalled inspection report PDFs to completed with failure', async () => {
    const expected = ['completed_failure', 'completed_failure'];
    const inspectionQueued = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      inspectionReportStatus: 'queued',
      inspectionReportStatusChanged: 1, // passed max timeout
    });
    const inspectionGenerating = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      inspectionReportStatus: 'generating',
      inspectionReportStatusChanged: 1, // passed max timeout
    });

    const actual = [];
    sinon.stub(errorsService, 'report').resolves();
    sinon
      .stub(inspectionsModel, 'query')
      .resolves(stubs.wrapSnapshot([inspectionQueued, inspectionGenerating]));
    sinon.stub(inspectionsModel, 'updateRecord').callsFake((db, id, update) => {
      actual.push(update.inspectionReportStatus);
      return Promise.resolve();
    });

    await createHandler(DB, PUBSUB, 'topic');

    expect(actual).to.deep.equal(expected);
  });

  it('sets updated status change timestamp on all stalled inspection report PDFs', async () => {
    const expected = [true, true];
    const inspectionQueued = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      inspectionReportStatus: 'queued',
      inspectionReportStatusChanged: 1, // passed max timeout
    });
    const inspectionGenerating = mocking.createInspection({
      property: uuid(),
      inspectionCompleted: true,
      inspectionReportStatus: 'generating',
      inspectionReportStatusChanged: 1, // passed max timeout
    });

    const actual = [];
    const older = Math.round(Date.now() / 1000) - 1;
    sinon.stub(errorsService, 'report').resolves();
    sinon
      .stub(inspectionsModel, 'query')
      .resolves(stubs.wrapSnapshot([inspectionQueued, inspectionGenerating]));
    sinon.stub(inspectionsModel, 'updateRecord').callsFake((db, id, update) => {
      const changed = update.inspectionReportStatusChanged;
      actual.push(typeof changed === 'number' && changed > older);
      return Promise.resolve();
    });

    await createHandler(DB, PUBSUB, 'topic');

    expect(actual).to.deep.equal(expected);
  });
});
