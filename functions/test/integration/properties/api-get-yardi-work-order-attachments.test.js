const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');
const handler = require('../../../properties/api/get-property-yardi-work-order-attachments');

const PROPERTY = { code: 'prop' };
const ATTACHMENT = {
  name: 'Attachment_531779_1.png',
  attachmentType: 'Work Order',
  description: 'Pool gate',
  createdAt: '2026-10-28T12:38:52',
  data: 'aGVsbG8=',
  size: 5,
};

describe("Properties | API | GET Property's Yardi Work Order Attachments", () => {
  afterEach(() => sinon.restore());

  it('returns an error when yardi credentials are not configured', async () => {
    sinon.stub(systemModel, 'findYardi').rejects(Error('not found'));

    const result = await request(createApp())
      .get('/t/123/531779')
      .send()
      .expect('Content-Type', /json/)
      .expect(403);

    expect(result.body.errors[0].detail).to.equal(
      'Organization not configured for Yardi'
    );
  });

  it('rejects a non-numeric work order id', async () => {
    stubIntegration();
    const list = sinon.stub(yardi, 'getYardiWorkOrderAttachments');

    const result = await request(createApp())
      .get('/t/123/abc')
      .send()
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
    expect(list.called).to.equal(false);
  });

  it('returns a helpful error when Yardi credentials rejected', async () => {
    stubIntegration();
    const err = Error('bad credentials');
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
    sinon.stub(yardi, 'getYardiWorkOrderAttachments').rejects(err);

    const result = await request(createApp())
      .get('/t/123/531779')
      .send()
      .expect('Content-Type', /json/)
      .expect(407);

    expect(result.body.errors[0].detail).to.contain('credentials not accepted');
  });

  it('returns a helpful error when Yardi request fails', async () => {
    stubIntegration();
    sinon
      .stub(yardi, 'getYardiWorkOrderAttachments')
      .rejects(Error('request timeout'));

    const result = await request(createApp())
      .get('/t/123/531779')
      .send()
      .expect('Content-Type', /json/)
      .expect(500);

    expect(result.body.errors[0].detail).to.contain(
      'Unexpected error fetching work order attachments'
    );
  });

  it('lists attachments as JSON API records without file data', async () => {
    stubIntegration();
    const list = sinon
      .stub(yardi, 'getYardiWorkOrderAttachments')
      .resolves([ATTACHMENT]);

    const result = await request(createApp())
      .get('/t/123/531779')
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    expect(list.firstCall.args).to.deep.equal([
      'prop',
      { entity: 'test' },
      '531779',
    ]);
    expect(result.body).to.deep.equal({
      data: [
        {
          id: 'Attachment_531779_1.png',
          type: 'work-order-attachment',
          attributes: {
            name: 'Attachment_531779_1.png',
            extension: 'png',
            contentType: 'image/png',
            attachmentType: 'Work Order',
            description: 'Pool gate',
            createdAt: '2026-10-28T12:38:52',
            size: 5,
          },
        },
      ],
    });
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
  app.get(
    '/t/:propertyId/:workOrderId',
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
