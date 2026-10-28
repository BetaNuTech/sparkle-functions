const assert = require('assert');

const { isArray } = Array;

const RESIDENT_ATTRS = {
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  status: '',
  yardiStatus: '',
  leaseUnit: '',
  leaseSqFt: 0,
  leaseFrom: '',
  leaseTo: '',
  moveIn: '',
  officeNumber: '',
  mobileNumber: '',
  homeNumber: '',
  eviction: false,
  paymentPlan: false,
  paymentPlanDelinquent: false,
  lastNote: '',
  lastNoteUpdatedAt: 0,
  totalOwed: 0,
  totalCharges: 0,
  occupants: [],
};

const OCCUPANT_ATTRS = {
  resident: '', // relationship
  firstName: '',
  lastName: '',
  middleName: '',
  email: '',
  relationship: '',
  officeNumber: '',
  mobileNumber: '',
  homeNumber: '',
  responsibleForLease: false,
};

const WORK_ORDER_ATTRS = {
  status: '',
  category: '',
  subCategory: '',
  origin: '',
  priority: '',
  unit: '',
  resident: '',
  vendor: '',
  updatedAt: '',
  createdAt: '',
  updatedBy: '',
  requestDate: '',
  permissionToEnter: '',
  tenantCaused: '',
  technicianNotes: '',
  briefDescription: '',
  description: '',
  problemNotes: '',
  accessNotes: '',
  requestorName: '',
  requestorPhone: '',
  requestorEmail: '',
  dueDate: '',
  reason: '',
  resolution: '',
};

// Yardi Service Request elements in the exact
// order required by the Itf_ServiceRequest.xsd
// sequence, mapped from Sparkle work order attributes
const SERVICE_REQUEST_ELEMENTS = Object.freeze([
  ['ServiceRequestId', 'id'],
  ['Origin', 'origin'],
  ['PropertyCode', 'property'],
  ['UnitCode', 'unit'],
  ['TenantCode', 'resident'],
  ['VendorCode', 'vendor'],
  ['ServiceRequestBriefDescription', 'briefDescription'],
  ['ServiceRequestFullDescription', 'description'],
  ['Priority', 'priority'],
  ['Category', 'category'],
  ['SubCategory', 'subCategory'],
  ['HasPermissionToEnter', 'permissionToEnter'],
  ['AccessNotes', 'accessNotes'],
  ['ProblemDescriptionNotes', 'problemNotes'],
  ['TechnicianNotes', 'technicianNotes'],
  ['TenantCaused', 'tenantCaused'],
  ['RequestorName', 'requestorName'],
  ['RequestorPhoneNumber', 'requestorPhone'],
  ['RequestorEmail', 'requestorEmail'],
  ['DueDate', 'dueDate'],
  ['CurrentStatus', 'status'],
  ['Resolution', 'resolution'],
  ['Reason', 'reason'],
]);

module.exports = {
  /**
   * Yardi Resident/Occupant record has
   * required attributes to be considered
   * usable by consuming clients
   * @param  {Object} record
   * @return {Boolean}
   */
  isValidYardiResidentOccupant(record = {}) {
    const { Identification: id, Name: name } = record;
    const { FirstName: firstName, LastName: lastName, MiddleName: middleName } =
      (name && name[0]) || {};
    return (
      Boolean(id && id[0] && id[0].IDValue && id[0].IDValue[0]) &&
      (Boolean(firstName && firstName[0]) ||
        Boolean(lastName && lastName[0]) ||
        Boolean(middleName && middleName[0]))
    );
  },

  /**
   * Create resident record from Yardi "customer"
   * @param  {Object} customer
   * @return {Object}
   */
  createResidentFromYardiCustomer(customer) {
    const resident = { ...RESIDENT_ATTRS };

    // Required: Resident ID & Status
    const [identification] = customer.Identification;
    resident.id = identification.IDValue[0];
    resident.status = (identification.Status
      ? identification.Status[0]
      : ''
    ).toLowerCase();
    resident.yardiStatus = (identification.YardiStatus
      ? identification.YardiStatus[0]
      : ''
    ).toLowerCase();

    // Required: Resident Name
    if (isYardiEntry(customer.Name)) {
      const [name] = customer.Name;
      resident.firstName = (name.FirstName && name.FirstName[0]) || '';
      resident.middleName = (name.MiddleName && name.MiddleName[0]) || '';
      resident.lastName = (name.LastName && name.LastName[0]) || '';
    }

    // Optional: Resident Email
    if (isYardiEntry(customer.Address)) {
      const [address] = customer.Address;
      resident.email = (address.Email && address.Email[0]) || '';
    }

    // Optional: Resident Lease Info
    if (isYardiEntry(customer.Lease)) {
      const [lease] = customer.Lease;
      resident.leaseUnit =
        (lease.Identification &&
          lease.Identification[0] &&
          lease.Identification[0].IDValue &&
          lease.Identification[0].IDValue[0]) ||
        '';
      resident.leaseSqFt = lease.UnitSqFt
        ? `${parseFloat(lease.UnitSqFt[0] || '0')}`
        : '0';
      resident.leaseFrom =
        (lease.LeaseFromDate && lease.LeaseFromDate[0]) || '';
      resident.leaseTo = (lease.LeaseToDate && lease.LeaseToDate[0]) || '';
      resident.moveIn = (lease.ActualMoveIn && lease.ActualMoveIn[0]) || '';
    }

    // Optional: Phone Numbers
    if (isYardiEntry(customer.Phone)) {
      Object.assign(resident, getYardiPhoneNumbers(customer.Phone[0]));
    }

    return resident;
  },

  /**
   * Create an Occupant from a Yardi Occupant
   * @param  {String} residentId
   * @param  {Object} srcOccupant
   * @return {Object}
   */
  createOccupantFromYardiOccupant(residentId, srcOccupant) {
    assert(residentId && typeof residentId === 'string', 'has resident ID');

    const occupant = { ...OCCUPANT_ATTRS };

    // Required: Resident ID & Status
    const [identification] = srcOccupant.Identification;
    occupant.id = identification.IDValue[0];
    occupant.resident = residentId;
    occupant.relationship = (identification.Relationship
      ? identification.Relationship[0]
      : ''
    ).toLowerCase();

    // Required: Responsible for lease
    occupant.responsibleForLease = srcOccupant.ResponsibleForLease
      ? `${srcOccupant.ResponsibleForLease[0] || ''}`.toLowerCase() === 'true'
      : false;

    // Required: Occupant Name
    if (isYardiEntry(srcOccupant.Name)) {
      const [name] = srcOccupant.Name;
      occupant.firstName = (name.FirstName && name.FirstName[0]) || '';
      occupant.middleName = (name.MiddleName && name.MiddleName[0]) || '';
      occupant.lastName = (name.LastName && name.LastName[0]) || '';
    }

    // Optional: Occupant Email
    if (isYardiEntry(srcOccupant.Address)) {
      const [address] = srcOccupant.Address;
      occupant.email = (address.Email && address.Email[0]) || '';
    }

    // Optional: Occupant Phone Numbers
    if (isYardiEntry(srcOccupant.Phone)) {
      Object.assign(occupant, getYardiPhoneNumbers(srcOccupant.Phone[0]));
    }

    return occupant;
  },

  /**
   * Yardi Service Request record has
   * required attributes to be considered
   * usable by consuming clients
   * NOTE: a unit is optional, property level
   * (common area) requests have no UnitCode
   * @param  {Object} record
   * @return {Boolean}
   */
  isValidYardiWorkOrder(record = {}) {
    const { ServiceRequestId: id } = record;
    return Boolean(id && id[0]);
  },

  /**
   * Create a Work Order from a Yardi Service Request
   * @param  {Object} src
   * @return {Object}
   */
  createWorkOrderFromYardi(src) {
    const result = { ...WORK_ORDER_ATTRS };

    result.id = src.ServiceRequestId[0];

    if (isYardiValue(src.CurrentStatus)) {
      result.status = `${src.CurrentStatus[0]}`.toLowerCase();
    }

    if (isYardiValue(src.Category)) {
      result.category = `${src.Category[0]}`.toLowerCase();
    }

    if (isYardiValue(src.SubCategory)) {
      result.subCategory = `${src.SubCategory[0]}`;
    }

    if (isYardiValue(src.VendorCode)) {
      result.vendor = `${src.VendorCode[0]}`;
    }

    if (isYardiValue(src.ServiceRequestBriefDescription)) {
      result.briefDescription = src.ServiceRequestBriefDescription[0];
    }

    if (isYardiValue(src.AccessNotes)) {
      result.accessNotes = src.AccessNotes[0];
    }

    if (isYardiValue(src.DueDate)) {
      result.dueDate = src.DueDate[0];
    }

    if (isYardiValue(src.Reason)) {
      result.reason = src.Reason[0];
    }

    if (isYardiValue(src.Resolution)) {
      result.resolution = src.Resolution[0];
    }

    if (isYardiValue(src.Origin)) {
      result.origin = `${src.Origin[0]}`;
    }

    if (isYardiValue(src.Priority)) {
      result.priority = `${src.Priority[0]}`.toLowerCase();
    }

    if (isYardiValue(src.UnitCode)) {
      result.unit = `${src.UnitCode[0]}`;
    }

    if (isYardiValue(src.TenantCode)) {
      result.resident = `${src.TenantCode[0]}`;
    }

    if (isYardiValue(src.UpdatedBy)) {
      result.updatedBy = src.UpdatedBy[0];
    }

    if (isYardiValue(src.ServiceRequestDate)) {
      result.requestDate = src.ServiceRequestDate[0];
    }

    if (isYardiValue(src.HasPermissionToEnter)) {
      result.permissionToEnter =
        `${src.HasPermissionToEnter[0]}`.toLowerCase() === 'true';
    }

    if (isYardiValue(src.TenantCaused)) {
      result.tenantCaused = `${src.TenantCaused[0]}`.toLowerCase() === 'true';
    }

    if (isYardiValue(src.TechnicianNotes)) {
      result.technicianNotes = src.TechnicianNotes[0];
    }

    if (isYardiValue(src.ServiceRequestFullDescription)) {
      result.description = src.ServiceRequestFullDescription[0];
    }

    if (isYardiValue(src.ProblemDescriptionNotes)) {
      result.problemNotes = src.ProblemDescriptionNotes[0];
    }

    if (isYardiValue(src.RequestorName)) {
      result.requestorName = src.RequestorName[0];
    }

    if (isYardiValue(src.RequestorPhoneNumber)) {
      result.requestorPhone = parsePhoneNumber(src.RequestorPhoneNumber[0]);
    }

    if (isYardiValue(src.RequestorEmail)) {
      result.requestorEmail = src.RequestorEmail[0];
    }

    if (isYardiValue(src.UpdateDate)) {
      const updateAtDateIso = `${src.UpdateDate[0].replace(/Z$/, '')}Z`;
      result.updatedAt = Math.round(new Date(updateAtDateIso).getTime() / 1000);
    }

    if (
      src.StatusHistory &&
      src.StatusHistory[0] &&
      src.StatusHistory[0].Status &&
      src.StatusHistory[0].Status[0] &&
      src.StatusHistory[0].Status[0].$ &&
      src.StatusHistory[0].Status[0].$.TimeStamp
    ) {
      const createdIso = src.StatusHistory[0].Status[0].$.TimeStamp;
      const createdDateIso = `${createdIso.replace(/Z$/, '')}Z`;
      result.createdAt = Math.round(new Date(createdDateIso).getTime() / 1000);
    }

    return result;
  },

  /**
   * Create the Yardi `ServiceRequests` XML document
   * consumed by the `CreateOrEditServiceRequests`
   * SOAP method from Sparkle work order attributes.
   * A missing/falsey `id` requests a new service request.
   * Elements are written in the XSD sequence order and
   * only attributes with a value are included.
   * @param  {String} propertyCode
   * @param  {Object} workOrder
   * @return {String} - XML
   */
  createYardiServiceRequestXml(propertyCode, workOrder) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property code'
    );
    assert(workOrder && typeof workOrder === 'object', 'has work order');

    const source = { ...workOrder, property: propertyCode };
    if (!source.id) source.id = '0';

    const elements = SERVICE_REQUEST_ELEMENTS.filter(([, attr]) =>
      hasValue(source[attr])
    ).map(([tag, attr]) => `<${tag}>${escapeXml(source[attr])}</${tag}>`);

    return `<ServiceRequests xmlns=""><ServiceRequest>${elements.join(
      ''
    )}</ServiceRequest></ServiceRequests>`;
  },

  /**
   * Collect any error messages Yardi embedded
   * in a parsed service request record
   * @param  {Object} record - parsed Yardi ServiceRequest
   * @return {String[]}
   */
  getYardiErrorMessages(record) {
    const messages = (record || {}).ErrorMessages;
    if (!messages || !isArray(messages) || !messages[0]) return [];
    const errors = messages[0].Error;
    if (!errors || !isArray(errors)) return [];
    return errors
      .map(err => `${err && err._ !== undefined ? err._ : err}`.trim())
      .filter(Boolean);
  },

  /**
   * Create the organization's work order custom
   * values from a parsed Yardi `GetCustomValues`
   * `ServiceRequests` payload
   * @param  {Object} src - parsed `ServiceRequests` element
   * @return {Object}
   */
  createCustomValuesFromYardi(src) {
    const source = src && typeof src === 'object' ? src : {};
    const customValues = firstEntry(source.CustomValues) || {};
    const result = {
      priorities: [],
      categories: [],
      statuses: [],
      reasons: [],
      resolutions: [],
    };

    // Priorities
    result.priorities = yardiTextValues(
      (firstEntry(customValues.Priorities) || {}).Priority
    );

    // Categories & their sub categories
    const categories = (firstEntry(customValues.Categories) || {}).Category;
    result.categories = (isArray(categories) ? categories : [])
      .map(category => ({
        name: yardiTextValues(category.Name)[0] || '',
        subCategories: yardiTextValues(category.SubCategory),
      }))
      .filter(({ name }) => name);

    // Statuses: standard groups live under `Statuses`
    // while custom groups are a sibling `Status` element
    // (older plug-ins place custom groups beside `CustomValues`)
    const statusGroups = [
      ...toArray((firstEntry(customValues.Statuses) || {}).Status),
      ...toArray(customValues.Status),
      ...toArray(source.Status),
    ];
    statusGroups.forEach(group => {
      if (!group || typeof group !== 'object') return;
      const type = `${(group.$ && group.$.Type) || ''}`.toLowerCase();
      yardiTextValues(group.Status).forEach(name => {
        result.statuses.push({ name, type: type || 'standard' });
      });
    });

    // Reasons for statuses
    const reasons = (firstEntry(customValues.Reasons) || {}).Reason;
    result.reasons = toArray(reasons)
      .map(reason => ({
        status: `${(reason && reason.$ && reason.$.Status) || ''}`,
        reason: yardiText(reason),
        required:
          `${(reason && reason.$ && reason.$.Required) || ''}`.toLowerCase() ===
          'true',
      }))
      .filter(({ reason }) => reason);

    // Resolutions (Yardi returns a `Warning` when none configured)
    result.resolutions = yardiTextValues(
      (firstEntry(source.Resolutions) || {}).Resolution
    );

    return result;
  },

  /**
   * Create work order attachment records from a
   * parsed Yardi `GetAttachments` `ServiceRequestAttachments`
   * payload, dropping Yardi's "No attachments found" placeholder
   * @param  {Object} src - parsed `ServiceRequestAttachments` element
   * @return {Object[]} - [{name, attachmentType, description, createdAt, data, size}]
   */
  createAttachmentsFromYardi(src) {
    const serviceRequest = firstEntry((src || {}).ServiceRequest) || {};
    const attachments = toArray(
      (firstEntry(serviceRequest.Attachments) || {}).Attachment
    );

    return attachments
      .map(attachment => {
        const attrs = (attachment && attachment.$) || {};
        const nameEl = firstEntry((attachment || {}).Name);
        const nameAttrs = (nameEl && nameEl.$) || {};
        const name = yardiText(nameEl);
        const data = yardiText(toArray((attachment || {}).Value)[0]).replace(
          /\s+/g,
          ''
        );
        return {
          name,
          attachmentType: `${nameAttrs.AttachmentType || ''}`,
          description: `${nameAttrs.AttachmentDescription || ''}`,
          createdAt: `${attrs.Date || ''}`,
          data,
          size: Buffer.from(data, 'base64').length,
        };
      })
      .filter(
        ({ name, createdAt }) =>
          Boolean(name) &&
          !/^No attachments found/i.test(name) &&
          !/^0001-01-01/.test(createdAt)
      );
  },

  /**
   * Read the outcome of a Yardi `ImportWorkOrderDocumentExt`
   * `ImportAttach` payload: "Successful:<file name>" or a failure message
   * @param  {Object} src - parsed `ImportAttach` element
   * @return {Object} - {success: Boolean, name: String, message: String}
   */
  createAttachmentImportResultFromYardi(src) {
    const document = firstEntry((src || {}).DocumentAttachment) || {};
    const message = yardiText(toArray(document.Result)[0]).trim();
    const success = /^Successful:/i.test(message);
    return {
      success,
      name: success ? message.replace(/^Successful:/i, '').trim() : '',
      message: success ? '' : message.replace(/^Unsuccessful:/i, '').trim(),
    };
  },

  _getYardiPhoneNumbers: getYardiPhoneNumbers,
  _escapeXml: escapeXml,
};

/**
 * First object entry of a parsed Yardi array
 * @param  {Any} entry
 * @return {Object|null}
 */
function firstEntry(entry) {
  return isYardiEntry(entry) ? entry[0] : null;
}

/**
 * Coerce a parsed Yardi value to an array
 * @param  {Any} value
 * @return {Array}
 */
function toArray(value) {
  if (isArray(value)) return value;
  return typeof value === 'undefined' || value === null ? [] : [value];
}

/**
 * Text content of a parsed Yardi node, which
 * is a string or an object with `_` when
 * the node has attributes
 * @param  {Any} node
 * @return {String}
 */
function yardiText(node) {
  if (node && typeof node === 'object') {
    return `${typeof node._ === 'undefined' ? '' : node._}`.trim();
  }
  return typeof node === 'undefined' || node === null ? '' : `${node}`.trim();
}

/**
 * Non-empty text values of a parsed Yardi node list
 * @param  {Any} nodes
 * @return {String[]}
 */
function yardiTextValues(nodes) {
  return toArray(nodes)
    .map(yardiText)
    .filter(Boolean);
}

/**
 * Attribute has a value worth
 * sending to Yardi (booleans included)
 * @param  {Any}  value
 * @return {Boolean}
 */
function hasValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  return Boolean(value && `${value}`.trim());
}

/**
 * Escape text for use in an XML element
 * @param  {Any} value
 * @return {String}
 */
function escapeXml(value) {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse Yardi Numbers & remove duplicates
 * according to priority
 * @param  {Object} phone - Yardi phone POJO
 * @return {Object}
 */
function getYardiPhoneNumbers(phone) {
  const result = {};

  const officeNumber = parsePhoneNumber(
    (phone.OfficeNumber && phone.OfficeNumber[0]) || ''
  );
  const homeNumber = parsePhoneNumber(
    (phone.HomeNumber && phone.HomeNumber[0]) || ''
  );
  const mobileNumber = parsePhoneNumber(
    (phone.MobileNumber && phone.MobileNumber[0]) || ''
  );

  // Add any unique office number (no mobile/home dups)
  if (
    officeNumber &&
    officeNumber !== mobileNumber &&
    officeNumber !== homeNumber
  ) {
    result.officeNumber = officeNumber;
  }

  // Add any unique home number (no mobile dup)
  if (homeNumber && homeNumber !== mobileNumber) {
    result.homeNumber = homeNumber;
  }

  // Add any unique mobile number (highest priority)
  if (mobileNumber) {
    result.mobileNumber = mobileNumber;
  }

  return result;
}

/**
 * Remove formatting characters
 * from phone numbers
 * @param  {String} phone
 * @return {String}
 */
function parsePhoneNumber(phone) {
  return phone.replace(/[(|)|\s|+|\-|A-Z|a-z]/g, '');
}

/**
 * Value is an acceptable Yardi
 * object/entry with a truethy value
 * @param  {Any}  entry
 * @return {Boolean}
 */
function isYardiEntry(entry) {
  return Boolean(
    entry && isArray(entry) && entry[0] && typeof entry[0] === 'object'
  );
}

/**
 * Value is an acceptable Yardi value
 * @param  {Any} value
 * @return {Boolean}
 */
function isYardiValue(value) {
  return Boolean(value && isArray(value) && typeof value[0] !== 'undefined');
}
