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
  origin: '',
  priority: '',
  unit: '',
  resident: '',
  updatedAt: '',
  createdAt: '',
  updatedBy: '',
  requestDate: '',
  permissionToEnter: '',
  tenantCaused: '',
  technicianNotes: '',
  description: '',
  problemNotes: '',
  requestorName: '',
  requestorPhone: '',
  requestorEmail: '',
};

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
   * Yardi Resident/Occupant record has
   * required attributes to be considered
   * usable by consuming clients
   * @param  {Object} record
   * @return {Boolean}
   */
  isValidYardiWorkOrder(record = {}) {
    const { ServiceRequestId: id, UnitCode: unit } = record;
    return Boolean(id && id[0]) && Boolean(unit && unit[0]);
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

  _getYardiPhoneNumbers: getYardiPhoneNumbers,
};

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
