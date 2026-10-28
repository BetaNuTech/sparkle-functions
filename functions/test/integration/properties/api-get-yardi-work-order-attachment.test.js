const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const systemModel = require('../../../models/system');
const integrationModel = require('../../../models/integrations');
const firebase = require('../../../test-helpers/firebase');
const yardi = require('../../../services/yardi');
const yardiMiddleware = require('../../../properties/middleware/yardi-integration');
const handler = require('../../../properties/api/get-property-yardi-work-order-attachment');

const PROPERTY = { code: 'prop' };
const ATTACHMENT = {
  name: 'Attachment_531779_1.png',
  attachmentType: 'Work Order',
  description: 'Pool gate',
  createdAt: '2026-10-28T12:38:52',
  data: 'aGVsbG8=',
  size: 5,
};

describe("Properties | API | GET Property's Yardi Work Order Attachment", () => {
  afterEach(() => sinon.restore());

  it('rejects a non-numeric work order id', async () => {
    stubIntegration();

    const result = await request(createApp())
      .get('/t/123/abc/Attachment_1.png')
      .send()
      .expect('Content-Type', /json/)
      .expect(400);

    expect(result.body.errors[0].source.pointer).to.equal('workOrderId');
  });

  it('returns a not found error for an unknown attachment name', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiWorkOrderAttachments').resolves([ATTACHMENT]);

    const result = await request(createApp())
      .get('/t/123/531779/Attachment_531779_9.png')
      .send()
      .expect('Content-Type', /json/)
      .expect(404);

    expect(result.body.errors[0].source.pointer).to.equal('attachmentName');
  });

  it('returns the attachment with its base64 data', async () => {
    stubIntegration();
    sinon.stub(yardi, 'getYardiWorkOrderAttachments').resolves([ATTACHMENT]);

    const result = await request(createApp())
      .get('/t/123/531779/attachment_531779_1.PNG')
      .send()
      .expect('Content-Type', /json/)
      .expect(200);

    expect(result.body.data.id).to.equal('Attachment_531779_1.png');
    expect(result.body.data.attributes.data).to.equal('aGVsbG8=');
    expect(result.body.data.attributes.contentType).to.equal('image/png');
  });
});

function stubIntegration() {
  sinon
    .stub(systemModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', {}));
  sinon
    .stub(integrationModel, 'findYardi')
    .resolves(firebase.createDocSnapshot('yardi', {}));
}

function createApp() {
  const app = express();
  app.get(
    '/t/:propertyId/:workOrderId/:attachmentName',
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
