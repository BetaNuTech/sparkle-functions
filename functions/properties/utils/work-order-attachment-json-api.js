const assert = require('assert');

const CONTENT_TYPES = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  txt: 'text/plain',
});

/**
 * Convert a work order attachment into a
 * JSON API record, file data is only included
 * when requested (it can be megabytes)
 * @param  {Object} attachment
 * @param  {Boolean?} includeData
 * @return {Object}
 */
module.exports = (attachment, includeData = false) => {
  assert(attachment && typeof attachment === 'object', 'has attachment');
  assert(attachment.name, 'has attachment name');
  const extension = `${attachment.name}`
    .split('.')
    .pop()
    .toLowerCase();

  const attributes = {
    name: attachment.name,
    extension,
    contentType: CONTENT_TYPES[extension] || 'application/octet-stream',
    attachmentType: attachment.attachmentType || '',
    description: attachment.description || '',
    createdAt: attachment.createdAt || '',
    size: typeof attachment.size === 'number' ? attachment.size : 0,
  };

  if (includeData) {
    attributes.data = attachment.data || '';
  }

  return {
    id: attachment.name,
    type: 'work-order-attachment',
    attributes,
  };
};
