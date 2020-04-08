const got = require('got');
const xml2js = require('xml2js');
const assert = require('assert');

const { isArray } = Array;

const PREFIX = 'services: yardi:';
const YARDI_URL =
  'https://www.yardiasp14.com/21253beta/Webservices/itfServiceRequests.asmx';
const YARDI_ENVELOPE = Object.freeze({
  'soap:Envelope': {
    $: {
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
      'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
    },
    'soap:Body': {},
  },
});
const YARDI_QUERY_XMLNS =
  'http://tempuri.org/YSI.Interfaces.WebServices/ItfServiceRequests';
const YARDI_SEARCH_CONFIG_BOILERPLATE = Object.freeze({
  UserName: '',
  Password: '',
  ServerName: '',
  Database: '',
  Platform: 'SQL Server',
  YardiPropertyId: '',
  InterfaceEntity: '',
  InterfaceLicense: '',
  Address: '',
});
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

module.exports = {
  /**
   * POST to Yardi for all a property's residents & occupants
   * @param  {String} propertyCode
   * @param  {Object} yardiConfig
   * @return {Promise} - resolves {Object}
   */
  async getYardiPropertyResidents(propertyCode, yardiConfig) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property Yardi code'
    );
    assertYardiConfig(yardiConfig);

    const soapEnvelope = { ...YARDI_ENVELOPE };
    soapEnvelope['soap:Envelope']['soap:Body'].GetResident_Search = {
      $: {
        xmlns: YARDI_QUERY_XMLNS,
      },
      ...createYardyBody(propertyCode, yardiConfig),
    };

    const body = createYardXMLBody(soapEnvelope);
    let response = null;
    try {
      response = await got.post(YARDI_URL, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Content-Length': body.length,
          SOAPAction:
            'http://tempuri.org/YSI.Interfaces.WebServices/ItfServiceRequests/GetResident_Search',
        },
        body,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyResidents: Yardi request failed: ${err}`
      );
    }

    let parsed = null;
    try {
      parsed = await parseYardyResponse(response.body);
      parsed =
        parsed.GetResident_SearchResponse[0].GetResident_SearchResult[0]
          .CustomerSearch[0].Response[0].Customers[0].Customer;
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyResidents: XML Parsing failed: ${err}`
      );
    }

    const result = {
      residents: [],
      occupants: [],
    };

    parsed
      .filter(({ Identification: id }) => Boolean(id && id[0] && id[0].IDValue)) // Require resident ID
      .filter(({ Name: name }) => Boolean(name && name[0])) // Require resident name
      .forEach(customer => {
        const resident = createResidentFromYardiCustomer(customer);

        // Optional: Add Occupants
        if (
          customer.OtherOccupants &&
          isArray(customer.OtherOccupants) &&
          customer.OtherOccupants[0]
        ) {
          const occupants = customer.OtherOccupants.filter(
            ({ Identification: id }) => Boolean(id && id[0] && id[0].IDValue)
          ) // Require occupant ID
            .filter(({ Name: name }) => Boolean(name && name[0])) // Require occupant name
            .map(occupant =>
              createOccupantFromYardiOccupant(resident.id, occupant)
            );

          resident.occupants = occupants.map(({ id }) => id);
          result.occupants.push(...occupants);
        }

        result.residents.push(resident);
      });

    return result;
  },
};

/**
 * Global assertions on Yardi
 * configuration settings
 * @param {Object} conf
 */
function assertYardiConfig(conf) {
  const { userName, password, serverName, database, entity, license } =
    conf || {};
  assert(conf && typeof conf === 'object', 'has yardi config object');
  assert(
    userName && typeof userName === 'string',
    'has Yardi config "userName"'
  );
  assert(
    password && typeof password === 'string',
    'has Yardi config "password"'
  );
  assert(
    serverName && typeof serverName === 'string',
    'has Yardi config "serverName"'
  );
  assert(
    database && typeof database === 'string',
    'has Yardi config "database"'
  );
  assert(entity && typeof entity === 'string', 'has Yardi config "entity"');
  assert(license && typeof license === 'string', 'has Yardi config "license"');
}

/**
 * Create Yardi SOAP Body Query
 * @param  {String} propertyCode
 * @param  {Object} yardiConfig
 * @return {Object}
 */
function createYardyBody(propertyCode, yardiConfig) {
  const query = { ...YARDI_SEARCH_CONFIG_BOILERPLATE };
  query.YardiPropertyId = propertyCode;
  query.UserName = yardiConfig.userName;
  query.Password = yardiConfig.password;
  query.ServerName = yardiConfig.serverName;
  query.Database = yardiConfig.database;
  query.InterfaceEntity = yardiConfig.entity;
  query.InterfaceLicense = yardiConfig.license;
  return query;
}

/**
 * Converty Yardi JSON Body into XML
 * @param  {Object} soapEnvelope
 * @return {String} - XML payolad
 */
function createYardXMLBody(soapEnvelope) {
  const xmlBuilder = new xml2js.Builder();
  const xmlBody = xmlBuilder.buildObject(soapEnvelope);
  return xmlBody.replace(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<?xml version="1.0" encoding="utf-8"?>'
  );
}

/**
 * Parse an XML body into JSON
 * @param  {String} body
 * @return {Promise} - resolves {Object}
 */
function parseYardyResponse(body) {
  return new Promise((resolve, reject) => {
    xml2js.parseString(body, { trim: true }, (err, parsed) => {
      if (err) return reject(err);
      resolve(parsed['soap:Envelope']['soap:Body'][0]);
    });
  });
}

function createResidentFromYardiCustomer(customer) {
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
  const [name] = customer.Name;
  resident.firstName = name.FirstName[0] || '';
  resident.middleName = name.MiddleName ? name.MiddleName[0] : '';
  resident.lastName = name.LastName[0] || '';

  // Optional: Resident Email
  if (customer.Address && customer.Address[0]) {
    const [address] = customer.Address;
    resident.email = (address.Email && address.Email[0]) || '';
  }

  // Optional: Resident Lease Info
  if (customer.Lease && customer.Lease[0]) {
    const [lease] = customer.Lease;
    resident.leaseUnit =
      (lease.Identification[0] &&
        lease.Identification[0].IDValue &&
        lease.Identification[0].IDValue[0]) ||
      '';
    resident.leaseSqFt = `${parseFloat(lease.UnitSqFt[0] || '0')}`;
    resident.leaseFrom = lease.LeaseFromDate ? lease.LeaseFromDate[0] : '';
    resident.leaseTo = lease.LeaseToDate ? lease.LeaseToDate[0] : '';
    resident.moveIn = lease.ActualMoveIn ? lease.ActualMoveIn[0] : '';
  }

  // Optional: Phone Numbers
  if (customer.Phone && customer.Phone[0]) {
    Object.assign(resident, getYardiPhoneNumbers(customer.Phone[0]));
  }

  return resident;
}

/**
 * Create an Occupant from a Yardi Occupant
 * @param  {String} residentId
 * @param  {Object} srcOccupant
 * @return {Object}
 */
function createOccupantFromYardiOccupant(residentId, srcOccupant) {
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
    ? (srcOccupant.ResponsibleForLease[0] || '').toLowerCase() === 'true'
    : false;

  // Required: Occupant Name
  const [name] = srcOccupant.Name;
  occupant.firstName = name.FirstName[0] || '';
  occupant.middleName = name.MiddleName ? name.MiddleName[0] : '';
  occupant.lastName = name.LastName[0] || '';

  // Optional: Occupant Email
  if (srcOccupant.Address && srcOccupant.Address[0]) {
    const [address] = srcOccupant.Address;
    occupant.email = (address.Email && address.Email[0]) || '';
  }

  // Optional: Occupant Phone Numbers
  if (srcOccupant.Phone && srcOccupant.Phone[0]) {
    Object.assign(occupant, getYardiPhoneNumbers(srcOccupant.Phone[0]));
  }

  return occupant;
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
    result.officeNumber = officeNumber;
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
