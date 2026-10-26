const assert = require('assert');

/**
 * Convert a Sparkle work order into
 * a JSON API formatted record
 * @param  {Object} workOrder
 * @return {Object}
 */
module.exports = workOrder => {
  assert(workOrder && typeof workOrder === 'object', 'has work order');
  assert(workOrder.id, 'has work order ID');

  const result = {
    id: `${workOrder.id}`,
    type: 'work-order',
    attributes: { ...workOrder },
  };

  if (workOrder.resident) {
    result.relationships = {
      resident: {
        data: { id: workOrder.resident, type: 'resident' },
      },
    };
  }

  // Remove ID and relationships
  // from record attributes
  delete result.attributes.id;
  delete result.attributes.resident;

  return result;
};
