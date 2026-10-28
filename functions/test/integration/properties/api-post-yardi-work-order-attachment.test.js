const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const bodyParser = require('body-parser');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');
const handler = require('../../../properties/api/post-property-yardi-work-order-attachment');

const PROPERTY = { code: 'prop' };
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe("Properties | API | POST Property's Yardi Work Order Attachment", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .post('/t/123/531779')
      .send({ data: PNG, extension: 'png' })
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].detail).to.equal(
      'Organization not configured for Yardi'
    );
  });

  it('rejects a non-numeric work order id', async () => {
    stubIntegration();
    const upload = sinon.stub(yardi, 'uploadYardiWorkOrderAttachment');

    const result = await request(createApp())
      .post('/t/123/abc')
      .send({ data: PNG, extension: 'png' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
    expect(upload.called).to.equal(false);
  });

  it('rejects an invalid attachment payload', async () => {
    stubIntegration();
    const upload = sinon.stub(yardi, 'uploadYardiWorkOrderAttachment');

    const result = await request(createApp())
      .post('/t/123/531779')
      .send({ data: 'nope!', bogus: true })
      .expect('Content-Type', /json/)
      .expect(400);

    const pointers = result.body.errors.map(({ source }) => source.pointer);
    expect(pointers).to.include('data');
    expect(pointers).to.include('extension');
    expect(pointers).to.include('bogus');
    expect(upload.called).to.equal(false);
  });

  it('returns a helpful error when Yardi rejects the attachment', async () => {
    stubIntegration();
    const err = Error('rejected');
    err.code = 'ERR_YARDI_ATTACHMENT_REJECTED';
    err.details = ['Invalid File Extension: exe'];
    sinon.stub(yardi, 'uploadYardiWorkOrderAttachment').rejects(err);

    const result = await request(createApp())
      .post('/t/123/531779')
      .send({ data: PNG, extension: 'exe' })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors).to.deep.equal([
      {
        detail: 'Invalid File Extension: exe',
        source: { pointer: 'attachment' },
      },
    ]);
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon
      .stub(yardi, 'uploadYardiWorkOrderAttachment')
      .rejects(Error('request timeout'));

    const result = await request(createApp())
      .post('/t/123/531779')
      .send({ data: PNG, extension: 'png' })
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error uploading work order attachment'
    );
  });

  it('uploads the attachment and returns the stored record', async () => {
    stubIntegration();
    const upload = sinon
      .stub(yardi, 'uploadYardiWorkOrderAttachment')
      .resolves({
        name: 'Attachment_531779_1.png',
        attachmentType: 'Work Order',
        description: 'Pool gate',
        extension: 'png',
      });

    const result = await request(createApp())
      .post('/t/123/531779')
      .send({ data: PNG, extension: 'png', description: 'Pool gate' })
      .expect('Content-Type', /json/)
      .expect(201);

    expect(upload.firstCall.args).to.deep.equal([
      'prop',
      { entity: 'test' },
      '531779',
      { data: PNG, extension: 'png', description: 'Pool gate' },
    ]);
    const { id, type, attributes } = result.body.data;
    expect(id).to.equal('Attachment_531779_1.png');
    expect(type).to.equal('work-order-attachment');
    expect(attributes.name).to.equal('Attachment_531779_1.png');
    expect(attributes.contentType).to.equal('image/png');
    expect(attributes.description).to.equal('Pool gate');
    expect(attributes.size).to.equal(70);
    expect(attributes.data).to.equal(undefined);
  });
});

function stubIntegration() {
  sinon
    .stub(systemModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', { entity: 'test' }));
  sinon
    .stub(integrationModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', {}));
}

function createApp() {
  const app = express();
  app.post(
    '/t/:propertyId/:workOrderId',
    bodyParser.json(),
    stubAuth,
    stubPropertyCode,
    yardiMiddleware({ collection: () => ({}) }),
    handler()
  );
  return app;
}

function stubAuth(req, res, next) {
  req.user = { id: '123' };
  next();
}

function stubPropertyCode(req, res, next) {
  req.property = PROPERTY;
  next();
}
