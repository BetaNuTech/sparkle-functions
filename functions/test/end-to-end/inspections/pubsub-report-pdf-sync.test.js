const sinon = require('sinon');
const { expect } = require('chai');
const uuid = require('../../../test-helpers/uuid');
const mocking = require('../../../test-helpers/mocking');
const { cleanDb } = require('../../../test-helpers/firebase');
const inspectionsModel = require('../../../models/inspections');
const errorsService = require('../../../services/errors');
const { fs: db, test, cloudFunctions } = require('../../setup');

describe('Inspections | Pubsub | Report PDF Sync', function() {
  afterEach(() => {
    sinon.restore();
    return cleanDb(null, db);
  });

  it("should transition all stalled inspection's report PDFs to completed with failure", async function() {
    const expected = ['completed_failure', 'completed_failure'];
    const inspectionOneId = uuid();
    const inspectionTwoId = uuid();
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

    // Stubs
    sinon.stub(errorsService, 'report').resolves();

    // Setup database
    await inspectionsModel.createRecord(db, inspectionOneId, inspectionQueued);
    await inspectionsModel.createRecord(
      db,
      inspectionTwoId,
      inspectionGenerating
    );

    // Execute
    await test.wrap(cloudFunctions.reportPdfSync)({});

    // Get Results
    const actual = [];
    const resultOneSnap = await inspectionsModel.findRecord(
      db,
      inspectionOneId
    );
    const resultTwoSnap = await inspectionsModel.findRecord(
      db,
      inspectionTwoId
    );
    const resultOne = resultOneSnap.data() || {};
    const resultTwo = resultTwoSnap.data() || {};
    actual.push(resultOne.inspectionReportStatus || '');
    actual.push(resultTwo.inspectionReportStatus || '');

    // Get Result
    expect(actual).to.deep.equal(expected);
  });
});
