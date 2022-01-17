const { expect } = require('chai');
const sinon = require('sinon');
const mocking = require('../../../test-helpers/mocking');
const {
  createFirestore,
  createPubSubHandler,
  createSnapshot,
  createStorage,
} = require('../../../test-helpers/stubs');
const uuid = require('../../../test-helpers/uuid');
const usersModel = require('../../../models/users');
const reportPdf = require('../../../inspections/report-pdf');
const log = require('../../../utils/logger');
const createHandler = require('../../../inspections/pubsub/generate-report-pdf');

describe('Inspections | Pubsub | Generate Report PDF', function() {
  beforeEach(() => {
    sinon.stub(log, 'info').callsFake(() => true);
    sinon.stub(log, 'error').callsFake(() => true);
  });
  afterEach(() => sinon.restore());

  it('sets generates report in incognito mode when author identifier not provided in event message', async () => {
    const expected = true;
    const inspectionId = uuid();
    const message = Buffer.from(`${inspectionId}`).toString('base64');

    const regenerate = sinon
      .stub(reportPdf, 'regenerate')
      .resolves({ warnings: [] });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      createStorage(),
      'topic'
    );

    const actual = (regenerate.firstCall || { args: [] }).args[3] || undefined;
    expect(actual).to.equal(expected);
  });

  it('provides author details when author identifier provided in event message', async () => {
    const authorId = uuid();
    const inspectionId = uuid();
    const firstName = 'Jake';
    const lastName = 'Johnson';
    const email = 'jake@gmail.com';
    const expected = [false, authorId, `${firstName} ${lastName}`, email];
    const message = Buffer.from(`${inspectionId}/${authorId}`).toString(
      'base64'
    );
    const user = mocking.createUser({ firstName, lastName, email });

    sinon
      .stub(usersModel, 'findRecord')
      .resolves(createSnapshot(authorId, user));
    const regenerate = sinon
      .stub(reportPdf, 'regenerate')
      .resolves({ warnings: [] });

    await createHandler(
      createFirestore(),
      createPubSubHandler({ data: message }),
      createStorage(),
      'topic'
    );

    const actual = (regenerate.firstCall || { args: [] }).args.slice(3);
    expect(actual).to.deep.equal(expected);
  });
});
