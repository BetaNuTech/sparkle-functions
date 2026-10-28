const assert = require('assert');

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB decoded (JSON body limit is 10 MB)
const MAX_DESCRIPTION = 100;
const EXTENSION = /^[a-z0-9]{1,8}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const ATTRIBUTES = Object.freeze(['data', 'extension', 'description']);

/**
 * Validate a work order attachment
 * upload request payload
 * @param  {Object} attachment - {data: base64, extension, description?}
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = attachment => {
  assert(attachment && typeof attachment === 'object', 'has attachment object');
  const errors = [];
  const { data, extension, description } = attachment;

  if (!data || typeof data !== 'string') {
    errors.push({ path: 'data', message: 'data is required' });
  } else if (data.length % 4 !== 0 || !BASE64.test(data)) {
    errors.push({ path: 'data', message: 'data must be a base64 string' });
  } else if (Buffer.from(data, 'base64').length > MAX_BYTES) {
    errors.push({
      path: 'data',
      message: `data must be ${MAX_BYTES / 1024 / 1024} MB or smaller`,
    });
  }

  const normalizedExt = `${extension || ''}`.replace(/^\./, '').toLowerCase();
  if (!extension || typeof extension !== 'string') {
    errors.push({ path: 'extension', message: 'extension is required' });
  } else if (!EXTENSION.test(normalizedExt)) {
    errors.push({
      path: 'extension',
      message: 'extension must be a file extension such as jpg, png or pdf',
    });
  }

  if (description !== undefined && typeof description !== 'string') {
    errors.push({ path: 'description', message: 'description must be text' });
  } else if (description && description.length > MAX_DESCRIPTION) {
    errors.push({
      path: 'description',
      message: `description must be ${MAX_DESCRIPTION} characters or fewer`,
    });
  }

  Object.keys(attachment)
    .filter(attr => !ATTRIBUTES.includes(attr))
    .forEach(attr => {
      errors.push({ path: attr, message: `${attr} is not a valid attribute` });
    });

  return errors;
};

module.exports.MAX_BYTES = MAX_BYTES;
