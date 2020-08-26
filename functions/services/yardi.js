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
const YARDI_XMLNS_ATTR =
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
        xmlns: YARDI_XMLNS_ATTR,
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
    let errorMsg = '';
    try {
      parsed = await parseYardyResponse(response.body);

      if (
        !parsed ||
        !parsed.GetResident_SearchResponse ||
        !parsed.GetResident_SearchResponse[0] ||
        !parsed.GetResident_SearchResponse[0].GetResident_SearchResult ||
        !parsed.GetResident_SearchResponse[0].GetResident_SearchResult[0]
      ) {
        // Unpopulated body fields is Yardi
        // version of an unauthorized resopnse
        errorMsg = 'invalid credentials';
      } else {
        parsed =
          parsed.GetResident_SearchResponse[0].GetResident_SearchResult[0]
            .CustomerSearch[0].Response[0].Customers[0].Customer;
        errorMsg =
          (parsed[0] &&
            parsed[0].ErrorMessages &&
            parsed[0].ErrorMessages[0] &&
            parsed[0].ErrorMessages[0].Error &&
            parsed[0].ErrorMessages[0].Error[0]) ||
          '';
      }
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyResidents: XML Parsing failed: ${err}`
      );
    }

    // Abandon when error discovered
    // within response body
    if (errorMsg) {
      const err = Error(
        `${PREFIX} getYardiPropertyResidents: bad request: ${errorMsg}`
      );
      if (errorMsg.search('Could not find') > -1) {
        err.code = 'ERR_NO_YARDI_PROPERTY';
      }
      if (errorMsg.search('invalid credentials')) {
        err.code = 'ERR_BAD_YARDI_CREDENTIALS';
      }
      throw err;
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

  /**
   * POST to Yardi for all a property's work orders
   * @param  {String} propertyCode
   * @param  {Object} yardiConfig
   * @return {Promise} - resolves {Object}
   */
  async getYardiPropertyWorkOrders(propertyCode, yardiConfig) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property Yardi code'
    );
    assertYardiConfig(yardiConfig);

    const soapEnvelope = { ...YARDI_ENVELOPE };
    soapEnvelope['soap:Envelope']['soap:Body'].GetServiceRequest_Search = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      OpenOrClosed: 'Open',
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
            'http://tempuri.org/YSI.Interfaces.WebServices/ItfServiceRequests/GetServiceRequest_Search',
        },
        body,
      });
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyWorkOrders: Yardi request failed: ${err}`
      );
    }

    let parsed = null;
    let errorMsg = '';
    try {
      parsed = await parseYardyResponse(response.body);

      if (
        !parsed ||
        !parsed.GetServiceRequest_SearchResponse ||
        !parsed.GetServiceRequest_SearchResponse[0] ||
        !parsed.GetServiceRequest_SearchResponse[0]
          .GetServiceRequest_SearchResult ||
        !parsed.GetServiceRequest_SearchResponse[0]
          .GetServiceRequest_SearchResult[0]
      ) {
        // Unpopulated body fields is Yardi
        // version of an unauthorized resopnse
        errorMsg = 'invalid credentials';
      } else {
        parsed =
          parsed.GetServiceRequest_SearchResponse[0]
            .GetServiceRequest_SearchResult[0].ServiceRequests[0]
            .ServiceRequest;
        errorMsg =
          (parsed[0] &&
            parsed[0].ErrorMessages &&
            parsed[0].ErrorMessages[0] &&
            parsed[0].ErrorMessages[0].Error &&
            parsed[0].ErrorMessages[0].Error[0]) ||
          '';
      }
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyWorkOrders: XML Parsing failed: ${err}`
      );
    }

    // // Abandon when error discovered
    // // within response body
    if (errorMsg) {
      const err = Error(
        `${PREFIX} getYardiPropertyWorkOrders: bad request: ${errorMsg}`
      );
      if (errorMsg.search('Could not find') > -1) {
        err.code = 'ERR_NO_YARDI_PROPERTY';
      }
      if (errorMsg.search('invalid credentials')) {
        err.code = 'ERR_BAD_YARDI_CREDENTIALS';
      }
      throw err;
    }

    console.log(
      '>>> valid yardi work orders:',
      parsed.filter(helpers.isValidYardiWorkOrder).length
    );

    return parsed;

    // // Map parsed into usable JSON
    // return {
    //   workOrders: parsed
    //     .filter(helpers.isValidYardiWorkOrder)
    //     .map(helpers.createWorkOrderFromYardi),
    // };
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
