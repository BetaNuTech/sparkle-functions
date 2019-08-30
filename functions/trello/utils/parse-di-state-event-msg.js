/**
 * Extracts data from topic: `deficient-item-status-update` message
 * @param  {Object} message
 * @return {String[]}
 */
module.exports = message => {
  const err = Error('Badly formed message');
  const path =
    message && message.data
      ? Buffer.from(message.data, 'base64').toString()
      : '';

  if (!path) {
    throw err;
  }

  const [propertyId, deficientItemId, , deficientItemState] = path.split('/');

  if (!propertyId || !deficientItemId || !deficientItemState) {
    throw err;
  }

  return [propertyId, deficientItemId, deficientItemState];
};
