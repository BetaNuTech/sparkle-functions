const assert = require('assert');
const Schema = require('validate');

// Maximum lengths defined by Yardi's
// Itf_ServiceRequest.xsd, which Voyager
// does not enforce itself
const LENGTHS = Object.freeze({
  unit: 8,
  resident: 8,
  vendor: 12,
  origin: 10,
  briefDescription: 35,
  description: 1500,
  priority: 30,
  category: 30,
  subCategory: 30,
  accessNotes: 1500,
  problemNotes: 1500,
  technicianNotes: 1500,
  requestorName: 200,
  requestorPhone: 20,
  requestorEmail: 80,
  dueDate: 19,
  status: 30,
  reason: 100,
  resolution: 50,
});

const BOOLEANS = Object.freeze(['permissionToEnter', 'tenantCaused']);
// Yardi employee codes, sent as a list;
// an empty list clears the assignment
const LISTS = Object.freeze(['assignees']);
const EMPLOYEE_CODE = /^[A-Za-z0-9_.-]{1,10}$/;

/**
 * Build a schema for work order attributes
 * NOTE: no attribute is required, a work order
 * without a unit is a property (common area) request
 * @return {Schema}
 */
function createSchema() {
  const definition = {};

  Object.keys(LENGTHS).forEach(attr => {
    definition[attr] = {
      type: String,
      required: false,
      length: { max: LENGTHS[attr] },
    };
  });

  BOOLEANS.forEach(attr => {
    definition[attr] = { type: Boolean, required: false };
  });

  return new Schema(definition, { strip: false });
}

const schemaInstance = createSchema();
const ATTRIBUTES = Object.freeze([
  ...Object.keys(LENGTHS),
  ...BOOLEANS,
  ...LISTS,
]);

/**
 * Validate work order attributes for
 * a create or an update request
 * @param  {Object} workOrder
 * @param  {Boolean?} isUpdate
 * @return {Object[]} errors [{path: String, message: String}]
 */
module.exports = (workOrder, isUpdate = false) => {
  assert(workOrder && typeof workOrder === 'object', 'has work order object');
  assert(typeof isUpdate === 'boolean', 'has update flag');
  const clone = JSON.parse(JSON.stringify(workOrder));
  LISTS.forEach(attr => delete clone[attr]);
  const errors = schemaInstance
    .validate(clone)
    .map(({ path, message }) => ({ path, message }));

  // Assignees: list of unique Yardi employee codes
  if (workOrder.assignees !== undefined) {
    const { assignees } = workOrder;
    if (!Array.isArray(assignees)) {
      errors.push({
        path: 'assignees',
        message: 'assignees must be a list of employee codes',
      });
    } else if (
      assignees.some(
        code => typeof code !== 'string' || !EMPLOYEE_CODE.test(code)
      )
    ) {
      errors.push({
        path: 'assignees',
        message: 'assignees must be employee codes of 1 to 10 characters',
      });
    } else if (new Set(assignees).size !== assignees.length) {
      errors.push({
        path: 'assignees',
        message: 'assignees must not repeat an employee',
      });
    }
  }

  // Reject unknown attributes
  Object.keys(workOrder)
    .filter(attr => !ATTRIBUTES.includes(attr))
    .forEach(attr => {
      errors.push({ path: attr, message: `${attr} is not a valid attribute` });
    });

  // Reject empty payloads
  if (!Object.keys(workOrder).length) {
    errors.push({ path: '', message: 'at least one attribute is required' });
  }

  return errors;
};

module.exports.ATTRIBUTES = ATTRIBUTES;
