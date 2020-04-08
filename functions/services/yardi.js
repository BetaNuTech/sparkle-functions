const got = require('got');
const xml2js = require('xml2js');
const assert = require('assert');
const helpers = require('./utils/yardi-helpers');

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

    parsed.filter(helpers.isValidYardiResidentOccupant).forEach(customer => {
      const resident = helpers.createResidentFromYardiCustomer(customer);

      // Append any occupants
      if (
        customer.OtherOccupants &&
        isArray(customer.OtherOccupants) &&
        customer.OtherOccupants[0]
      ) {
        const occupants = customer.OtherOccupants.filter(
          helpers.isValidYardiResidentOccupant
        ).map(occupant =>
          helpers.createOccupantFromYardiOccupant(resident.id, occupant)
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
