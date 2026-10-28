const { expect } = require('chai');
const toJsonApi = require('./work-order-attachment-json-api');

describe('Properties | Utils | Work Order Attachment JSON API', () => {
  const attachment = {
    name: 'Attachment_531779_1.PNG',
    attachmentType: 'Work Order',
    description: 'Pool gate',
    createdAt: '2026-10-28T12:38:52',
    data: 'aGVsbG8=',
    size: 5,
  };

  it('creates a record without file data by default', () => {
    expect(toJsonApi(attachment)).to.deep.equal({
      id: 'Attachment_531779_1.PNG',
      type: 'work-order-attachment',
      attributes: {
        name: 'Attachment_531779_1.PNG',
        extension: 'png',
        contentType: 'image/png',
        attachmentType: 'Work Order',
        description: 'Pool gate',
        createdAt: '2026-10-28T12:38:52',
        size: 5,
      },
    });
  });

  it('includes base64 data when requested', () => {
    expect(toJsonApi(attachment, true).attributes.data).to.equal('aGVsbG8=');
  });

  it('falls back to a generic content type', () => {
    const { contentType } = toJsonApi({ name: 'file.bin' }).attributes;
    expect(contentType).to.equal('application/octet-stream');
  });
});
