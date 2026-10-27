const got = require('got');
const xml2js = require('xml2js');
const assert = require('assert');
const helpers = require('./utils/yardi-helpers');

const { isArray } = Array;

const PREFIX = 'services: yardi:';
// Fallback Voyager endpoint when the organization's
// Yardi configuration does not provide a `url`
const DEFAULT_YARDI_URL =
  'https://www.yardiasp14.com/21253beta/Webservices/itfServiceRequests.asmx';
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
// Token swapped for raw (unescaped) XML after
// the SOAP envelope has been serialized, used
// for parameters Yardi types as `<s:any />`
const RAW_XML_PLACEHOLDER = '__SPARKLE_RAW_XML__';
const LOGIN_FAILED_MSG = 'Login failed';
const NO_WORK_ORDERS_MSG = /no work orders found/i;

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

    const soapEnvelope = createYardiEnvelope();
    soapEnvelope['soap:Envelope']['soap:Body'].GetResident_Search = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      ...createYardyBody(propertyCode, yardiConfig),
    };

    const body = createYardXMLBody(soapEnvelope);
    const response = await postYardi(
      yardiConfig,
      'GetResident_Search',
      body,
      'getYardiPropertyResidents'
    );

    let parsed = null;
    let errorMsg = '';
    try {
      parsed = await parseYardyResponse(response.body);
      const result = getYardiResult(parsed, 'GetResident_Search');

      if (!result) {
        // Unpopulated body fields is Yardi
        // version of an unauthorized response
        errorMsg = LOGIN_FAILED_MSG;
      } else if (getYardiMessageError(result)) {
        errorMsg = getYardiMessageError(result);
      } else {
        parsed =
          result.CustomerSearch[0].Response[0].Customers[0].Customer || [];
        errorMsg = helpers.getYardiErrorMessages(parsed[0]).join(', ');
      }
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyResidents: XML Parsing failed: ${err}`
      );
    }

    // Abandon when error discovered
    // within response body
    if (errorMsg) {
      throw createYardiError('getYardiPropertyResidents', errorMsg);
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
   * POST to Yardi for a property's work orders,
   * open ones by default, optionally filtered
   * @param  {String} propertyCode
   * @param  {Object} yardiConfig
   * @param  {Object?} filters
   * @param  {String?} filters.openOrClosed - "open" (default) or "closed"
   * @param  {String?} filters.unit - Yardi unit code
   * @param  {String?} filters.resident - Yardi tenant code
   * @param  {String?} filters.status - current work order status
   * @param  {String?} filters.from - last modified on/after, YYYY-MM-DD
   * @param  {String?} filters.to - last modified on/before, YYYY-MM-DD
   * @return {Promise} - resolves {Object}
   */
  async getYardiPropertyWorkOrders(propertyCode, yardiConfig, filters = {}) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property Yardi code'
    );
    assertYardiConfig(yardiConfig);
    assert(filters && typeof filters === 'object', 'has filters object');

    const soapEnvelope = createYardiEnvelope();
    soapEnvelope['soap:Envelope']['soap:Body'].GetServiceRequest_Search = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      ...createYardyBody(propertyCode, yardiConfig),
      ...createYardiSearchFilters(filters),
    };

    const body = createYardXMLBody(soapEnvelope);
    const response = await postYardi(
      yardiConfig,
      'GetServiceRequest_Search',
      body,
      'getYardiPropertyWorkOrders'
    );

    let parsed = null;
    let errorMsg = '';
    try {
      parsed = await parseYardyResponse(response.body);
      const result = getYardiResult(parsed, 'GetServiceRequest_Search');

      if (!result) {
        // Unpopulated body fields is Yardi
        // version of an unauthorized response
        errorMsg = LOGIN_FAILED_MSG;
      } else if (getYardiMessageError(result)) {
        errorMsg = getYardiMessageError(result);
      } else {
        parsed = result.ServiceRequests[0].ServiceRequest || [];
        errorMsg = helpers.getYardiErrorMessages(parsed[0]).join(', ');

        // Yardi reports an empty search
        // result as an error record
        if (errorMsg.search(NO_WORK_ORDERS_MSG) > -1) {
          errorMsg = '';
          parsed = [];
        }
      }
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyWorkOrders: XML Parsing failed: ${err}`
      );
    }

    // Abandon when error discovered
    // within response body
    if (errorMsg) {
      const err = createYardiError('getYardiPropertyWorkOrders', errorMsg);

      // Unit filter does not exist in property
      if (errorMsg.search(/Could not find Unit/i) > -1) {
        err.code = 'ERR_NO_YARDI_UNIT';
      }

      throw err;
    }

    // Map parsed into usable JSON
    return {
      workOrders: parsed
        .filter(helpers.isValidYardiWorkOrder)
        .map(helpers.createWorkOrderFromYardi),
    };
  },

  /**
   * POST to Yardi for a single work order
   * belonging to a property
   * @param  {String} propertyCode
   * @param  {Object} yardiConfig
   * @param  {String} workOrderId
   * @return {Promise} - resolves {Object} work order
   */
  async getYardiPropertyWorkOrder(propertyCode, yardiConfig, workOrderId) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property Yardi code'
    );
    assertYardiConfig(yardiConfig);
    assert(
      workOrderId && /^\d+$/.test(`${workOrderId}`),
      'has numeric work order ID'
    );

    const soapEnvelope = createYardiEnvelope();
    soapEnvelope['soap:Envelope']['soap:Body'].GetServiceRequests = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      ...createYardyBody(propertyCode, yardiConfig),
      ServiceRequestIdArray: { long: [`${workOrderId}`] },
    };

    const body = createYardXMLBody(soapEnvelope);
    const response = await postYardi(
      yardiConfig,
      'GetServiceRequests',
      body,
      'getYardiPropertyWorkOrder'
    );

    let record = null;
    let errorMsg = '';
    try {
      const parsed = await parseYardyResponse(response.body);
      const result = getYardiResult(parsed, 'GetServiceRequests');

      if (!result) {
        errorMsg = LOGIN_FAILED_MSG;
      } else if (getYardiMessageError(result)) {
        errorMsg = getYardiMessageError(result);
      } else {
        record = (result.ServiceRequests[0].ServiceRequest || [])[0] || null;
        errorMsg = helpers.getYardiErrorMessages(record).join(', ');
      }
    } catch (err) {
      throw Error(
        `${PREFIX} getYardiPropertyWorkOrder: XML Parsing failed: ${err}`
      );
    }

    if (errorMsg) {
      throw createYardiError('getYardiPropertyWorkOrder', errorMsg);
    }

    if (!record || !helpers.isValidYardiWorkOrder(record)) {
      const err = Error(
        `${PREFIX} getYardiPropertyWorkOrder: work order "${workOrderId}" not found`
      );
      err.code = 'ERR_NO_YARDI_WORK_ORDER';
      throw err;
    }

    return helpers.createWorkOrderFromYardi(record);
  },

  /**
   * POST to Yardi to create a new work order
   * (when `workOrder.id` is unset) or edit an
   * existing work order (when `workOrder.id` is set)
   *
   * NOTE: Yardi silently creates a new work order
   * when given an unknown ID, so callers editing
   * should first verify the ID exists with
   * `getYardiPropertyWorkOrder`
   * @param  {String} propertyCode
   * @param  {Object} yardiConfig
   * @param  {Object} workOrder - Sparkle work order attributes
   * @return {Promise} - resolves {Object} work order as stored by Yardi
   */
  async createOrEditYardiWorkOrder(propertyCode, yardiConfig, workOrder) {
    assert(
      propertyCode && typeof propertyCode === 'string',
      'has property Yardi code'
    );
    assertYardiConfig(yardiConfig);
    assert(
      workOrder && typeof workOrder === 'object',
      'has work order attributes'
    );
    assert(
      !workOrder.id || /^\d+$/.test(`${workOrder.id}`),
      'has numeric work order ID when editing'
    );

    const soapEnvelope = createYardiEnvelope();
    soapEnvelope['soap:Envelope']['soap:Body'].CreateOrEditServiceRequests = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      ...createYardyBody(propertyCode, yardiConfig),
      ServiceRequestXml: RAW_XML_PLACEHOLDER,
    };

    // Yardi declares `ServiceRequestXml` as mixed
    // content (`<s:any />`) so the document must be
    // embedded as elements, never an escaped string
    const serviceRequestXml = helpers.createYardiServiceRequestXml(
      propertyCode,
      workOrder
    );
    const body = createYardXMLBody(soapEnvelope).replace(
      RAW_XML_PLACEHOLDER,
      () => serviceRequestXml
    );
    const response = await postYardi(
      yardiConfig,
      'CreateOrEditServiceRequests',
      body,
      'createOrEditYardiWorkOrder'
    );

    let record = null;
    let errorMsg = '';
    let rejections = [];
    try {
      const parsed = await parseYardyResponse(response.body);
      const result = getYardiResult(parsed, 'CreateOrEditServiceRequests');

      if (!result) {
        errorMsg = LOGIN_FAILED_MSG;
      } else if (getYardiMessageError(result)) {
        errorMsg = getYardiMessageError(result);
      } else {
        record = (result.ServiceRequests[0].ServiceRequest || [])[0] || null;
        rejections = helpers.getYardiErrorMessages(record);
      }
    } catch (err) {
      throw Error(
        `${PREFIX} createOrEditYardiWorkOrder: XML Parsing failed: ${err}`
      );
    }

    if (errorMsg) {
      throw createYardiError('createOrEditYardiWorkOrder', errorMsg);
    }

    // Yardi rejected the work order's content
    if (rejections.length) {
      const err = createYardiError(
        'createOrEditYardiWorkOrder',
        rejections.join(', ')
      );
      if (!err.code || err.code === 'ERR_YARDI_REQUEST') {
        err.code = 'ERR_YARDI_WORK_ORDER_REJECTED';
      }
      err.details = rejections;
      throw err;
    }

    if (!record || !helpers.isValidYardiWorkOrder(record)) {
      throw Error(
        `${PREFIX} createOrEditYardiWorkOrder: Yardi returned no work order`
      );
    }

    return helpers.createWorkOrderFromYardi(record);
  },

  /**
   * POST to Yardi for the organization's configured
   * work order values: priorities, categories,
   * statuses, status reasons and resolutions
   * @param  {Object} yardiConfig
   * @return {Promise} - resolves {Object}
   */
  async getYardiCustomValues(yardiConfig) {
    assertYardiConfig(yardiConfig);

    const soapEnvelope = createYardiEnvelope();
    const query = createYardyBody('', yardiConfig);
    delete query.YardiPropertyId;
    delete query.Address;
    soapEnvelope['soap:Envelope']['soap:Body'].GetCustomValues = {
      $: {
        xmlns: YARDI_XMLNS_ATTR,
      },
      ...query,
    };

    const body = createYardXMLBody(soapEnvelope);
    const response = await postYardi(
      yardiConfig,
      'GetCustomValues',
      body,
      'getYardiCustomValues'
    );

    let serviceRequests = null;
    let errorMsg = '';
    try {
      const parsed = await parseYardyResponse(response.body);
      const result = getYardiResult(parsed, 'GetCustomValues');

      if (!result) {
        errorMsg = LOGIN_FAILED_MSG;
      } else if (getYardiMessageError(result)) {
        errorMsg = getYardiMessageError(result);
      } else {
        serviceRequests = (result.ServiceRequests || [])[0] || {};
      }
    } catch (err) {
      throw Error(`${PREFIX} getYardiCustomValues: XML Parsing failed: ${err}`);
    }

    if (errorMsg) {
      throw createYardiError('getYardiCustomValues', errorMsg);
    }

    return helpers.createCustomValuesFromYardi(serviceRequests);
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
  assert(
    typeof conf.url === 'undefined' || typeof conf.url === 'string',
    'has string Yardi config "url" when provided'
  );
}

/**
 * Create a fresh SOAP envelope for a
 * single request, never shared between calls
 * @return {Object}
 */
function createYardiEnvelope() {
  return {
    'soap:Envelope': {
      $: {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        'xmlns:soap': 'http://schemas.xmlsoap.org/soap/envelope/',
      },
      'soap:Body': {},
    },
  };
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
 * Create the `GetServiceRequest_Search` filter
 * elements from Sparkle filter attributes, Yardi
 * expects MM/DD/YYYY dates and capitalized
 * "Open"/"Closed" values
 * @param  {Object} filters
 * @return {Object}
 */
function createYardiSearchFilters(filters) {
  const openOrClosed = `${filters.openOrClosed || 'open'}`.toLowerCase();
  assert(
    ['open', 'closed'].includes(openOrClosed),
    'has "open" or "closed" filter'
  );

  const result = {
    OpenOrClosed: openOrClosed === 'closed' ? 'Closed' : 'Open',
  };

  if (filters.unit) result.UnitCode = `${filters.unit}`;
  if (filters.resident) result.ResidentCode = `${filters.resident}`;
  if (filters.status) result.Status = `${filters.status}`;
  if (filters.from) result.FromDate = toYardiDate(filters.from);
  if (filters.to) result.ToDate = toYardiDate(filters.to);

  return result;
}

/**
 * Convert a YYYY-MM-DD date to
 * Yardi's MM/DD/YYYY search format
 * @param  {String} date
 * @return {String}
 */
function toYardiDate(date) {
  const match = `${date}`.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  assert(match, 'has YYYY-MM-DD date');
  return `${match[2]}/${match[3]}/${match[1]}`;
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
 * POST a SOAP request to Yardi, converting
 * transport failures and SOAP faults into
 * errors with a usable message
 * @param  {String} method - Yardi SOAP method name
 * @param  {String} body - XML payload
 * @param  {String} fnName - calling function (for logs)
 * @return {Promise} - resolves {Object} got response
 */
async function postYardi(yardiConfig, method, body, fnName) {
  try {
    return await got.post(getYardiUrl(yardiConfig), {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        SOAPAction: `${YARDI_XMLNS_ATTR}/${method}`,
      },
      body,
    });
  } catch (err) {
    const responseBody = (err.response && `${err.response.body}`) || '';
    const faultMatch = responseBody.match(
      /<faultstring>([\s\S]*?)<\/faultstring>/
    );

    if (faultMatch) {
      const fault = Error(
        `${PREFIX} ${fnName}: Yardi SOAP fault: ${faultMatch[1]
          .replace(/\s+/g, ' ')
          .trim()}`
      );
      fault.code = 'ERR_YARDI_SOAP_FAULT';
      throw fault;
    }

    throw Error(`${PREFIX} ${fnName}: Yardi request failed: ${err}`);
  }
}

/**
 * Resolve the Voyager web service URL for
 * an organization, falling back to the default
 * @param  {Object} yardiConfig
 * @return {String}
 */
function getYardiUrl(yardiConfig) {
  const url = yardiConfig && yardiConfig.url;
  return url && typeof url === 'string' ? url.trim() : DEFAULT_YARDI_URL;
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

/**
 * Lookup the `<Method>Result` payload of
 * a parsed Yardi SOAP body
 * @param  {Object} parsedBody
 * @param  {String} method
 * @return {Object|null}
 */
function getYardiResult(parsedBody, method) {
  const response = parsedBody && parsedBody[`${method}Response`];
  const result = response && response[0] && response[0][`${method}Result`];
  return (result && result[0]) || null;
}

/**
 * Lookup any top level error message Yardi
 * returns in place of a result, such as
 * "Login failed" for bad credentials
 * @param  {Object} result
 * @return {String}
 */
function getYardiMessageError(result) {
  const messages = result && result.Messages;
  const message = messages && messages[0] && messages[0].Message;
  if (!message || !isArray(message)) return '';
  return message
    .map(msg => `${msg && msg._ !== undefined ? msg._ : msg}`.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Create an error for a Yardi reported
 * problem, coded by the type of problem
 * @param  {String} fnName
 * @param  {String} errorMsg
 * @return {Error}
 */
function createYardiError(fnName, errorMsg) {
  const err = Error(`${PREFIX} ${fnName}: bad request: ${errorMsg}`);

  if (errorMsg.search(LOGIN_FAILED_MSG) > -1) {
    err.code = 'ERR_BAD_YARDI_CREDENTIALS';
  } else if (errorMsg.search(/Could not find Property/i) > -1) {
    err.code = 'ERR_NO_YARDI_PROPERTY';
  } else if (errorMsg.search(/Could not find WorkOrderId/i) > -1) {
    err.code = 'ERR_NO_YARDI_WORK_ORDER';
  } else {
    err.code = 'ERR_YARDI_REQUEST';
  }

  return err;
}
