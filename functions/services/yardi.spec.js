const { expect } = require('chai');
const sinon = require('sinon');
const got = require('got');
const yardi = require('./yardi');

const CONFIG = {
  userName: 'user',
  password: 'pass',
  serverName: 'server',
  database: 'db',
  entity: 'Sparkle',
  license: 'license',
};

describe('Services | Yardi', () => {
  afterEach(() => sinon.restore());

  describe('createOrEditYardiWorkOrder', () => {
    it('embeds the service request document as raw XML, not an escaped string', async () => {
      const post = sinon
        .stub(got, 'post')
        .resolves({ body: createCreateResponse(createServiceRequest()) });

      await yardi.createOrEditYardiWorkOrder('prop', CONFIG, {
        unit: '101',
        briefDescription: 'test',
      });

      const [url, { body, headers }] = post.firstCall.args;
      expect(url).to.contain('itfServiceRequests.asmx');
      expect(headers.SOAPAction).to.contain('/CreateOrEditServiceRequests');
      expect(body).to.contain(
        '<ServiceRequestXml><ServiceRequests xmlns=""><ServiceRequest><ServiceRequestId>0</ServiceRequestId><PropertyCode>prop</PropertyCode><UnitCode>101</UnitCode>'
      );
      expect(body).to.not.contain('&lt;ServiceRequests');
      expect(body).to.not.contain('__SPARKLE_RAW_XML__');
    });

    it('sends the credentials and property in the request', async () => {
      const post = sinon
        .stub(got, 'post')
        .resolves({ body: createCreateResponse(createServiceRequest()) });

      await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '101' });

      const { body } = post.firstCall.args[1];
      expect(body).to.contain('<UserName>user</UserName>');
      expect(body).to.contain('<Password>pass</Password>');
      expect(body).to.contain('<YardiPropertyId>prop</YardiPropertyId>');
      expect(body).to.contain('<InterfaceEntity>Sparkle</InterfaceEntity>');
      expect(body).to.contain('<InterfaceLicense>license</InterfaceLicense>');
    });

    it('still escapes text within the embedded document', async () => {
      const post = sinon
        .stub(got, 'post')
        .resolves({ body: createCreateResponse(createServiceRequest()) });

      await yardi.createOrEditYardiWorkOrder('prop', CONFIG, {
        unit: '101',
        description: 'a < b & c',
      });

      const { body } = post.firstCall.args[1];
      expect(body).to.contain(
        '<ServiceRequestFullDescription>a &lt; b &amp; c</ServiceRequestFullDescription>'
      );
    });

    it('resolves the work order Yardi returns', async () => {
      sinon.stub(got, 'post').resolves({
        body: createCreateResponse(
          createServiceRequest({
            ServiceRequestId: '531772',
            Priority: 'Low',
            CurrentStatus: 'Call',
          })
        ),
      });

      const actual = await yardi.createOrEditYardiWorkOrder('prop', CONFIG, {
        unit: '101',
      });

      expect(actual.id).to.equal('531772');
      expect(actual.unit).to.equal('101');
      expect(actual.priority).to.equal('low');
      expect(actual.status).to.equal('call');
    });

    it('rejects with every Yardi error message when the work order is rejected', async () => {
      sinon.stub(got, 'post').resolves({
        body: createCreateResponse(
          `<ServiceRequest HasAttachments="false"><ServiceRequestId>0</ServiceRequestId><PropertyCode>prop</PropertyCode><UnitCode>ZZ</UnitCode><ErrorMessages><Error>Could not find Unit:ZZ in Property:prop</Error><Error>Could not find Priority:Urgent</Error></ErrorMessages></ServiceRequest>`
        ),
      });

      let actual = null;
      try {
        await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: 'ZZ' });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_YARDI_WORK_ORDER_REJECTED');
      expect(actual.details).to.deep.equal([
        'Could not find Unit:ZZ in Property:prop',
        'Could not find Priority:Urgent',
      ]);
    });

    it('rejects with a property error when the property is unknown', async () => {
      sinon.stub(got, 'post').resolves({
        body: createCreateResponse(
          `<ServiceRequest><ServiceRequestId>0</ServiceRequestId><ErrorMessages><Error>Could not find Property:prop</Error></ErrorMessages></ServiceRequest>`
        ),
      });

      let actual = null;
      try {
        await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '1' });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_NO_YARDI_PROPERTY');
    });

    it('rejects with a credentials error when Yardi login fails', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'CreateOrEditServiceRequests',
          '<Messages xmlns=""><Message messageType="Error">Login failed. Please check login credentials and try again.</Message></Messages>'
        ),
      });

      let actual = null;
      try {
        await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '1' });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_BAD_YARDI_CREDENTIALS');
    });

    it('rejects with a SOAP fault error when Yardi cannot read the request', async () => {
      const httpErr = Error('Response code 500 (Internal Server Error)');
      httpErr.response = {
        body:
          '<soap:Envelope><soap:Body><soap:Fault><faultcode>soap:Client</faultcode><faultstring>Server was unable to read request. ---&gt; There is an error in XML document (30, 21).</faultstring></soap:Fault></soap:Body></soap:Envelope>',
      };
      sinon.stub(got, 'post').rejects(httpErr);

      let actual = null;
      try {
        await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '1' });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_YARDI_SOAP_FAULT');
      expect(actual.message).to.contain('unable to read request');
    });

    it('rejects without a code when the request fails to send', async () => {
      sinon.stub(got, 'post').rejects(Error('ECONNRESET'));

      let actual = null;
      try {
        await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '1' });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal(undefined);
      expect(actual.message).to.contain('Yardi request failed');
    });
  });

  describe('getYardiPropertyWorkOrder', () => {
    it('requests the work order by ID', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequests',
          `<ServiceRequests xmlns="">${createServiceRequest({
            ServiceRequestId: '42',
          })}</ServiceRequests>`
        ),
      });

      const actual = await yardi.getYardiPropertyWorkOrder(
        'prop',
        CONFIG,
        '42'
      );

      const { body, headers } = post.firstCall.args[1];
      expect(headers.SOAPAction).to.contain('/GetServiceRequests');
      expect(body.replace(/\s+/g, '')).to.contain(
        '<ServiceRequestIdArray><long>42</long></ServiceRequestIdArray>'
      );
      expect(actual.id).to.equal('42');
      expect(actual.unit).to.equal('101');
    });

    it('rejects with a not found error for an unknown work order', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequests',
          '<ServiceRequests xmlns=""><ServiceRequest HasAttachments="false"><ServiceRequestId>999</ServiceRequestId><ErrorMessages><Error>Could not find WorkOrderId:999 in Property:prop.</Error></ErrorMessages></ServiceRequest></ServiceRequests>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrder('prop', CONFIG, '999');
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_NO_YARDI_WORK_ORDER');
    });

    it('rejects a non-numeric work order ID', async () => {
      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrder('prop', CONFIG, 'abc');
      } catch (err) {
        actual = err;
      }
      expect(actual).to.be.an('error');
    });
  });

  describe('getYardiPropertyWorkOrders', () => {
    it('rejects with a property error when property code is unknown', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<ServiceRequests xmlns=""><ServiceRequest HasAttachments="false"><ErrorMessages><Error>Could not find Property:nope</Error></ErrorMessages></ServiceRequest></ServiceRequests>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('nope', CONFIG);
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_NO_YARDI_PROPERTY');
    });

    it('rejects with a credentials error when Yardi login fails', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<Messages xmlns=""><Message messageType="Error">Login failed. Please check login credentials and try again.</Message></Messages>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('prop', CONFIG);
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_BAD_YARDI_CREDENTIALS');
    });

    it('rejects with a credentials error when Yardi returns an empty result', async () => {
      sinon.stub(got, 'post').resolves({
        body:
          '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetServiceRequest_SearchResponse xmlns="http://tempuri.org/YSI.Interfaces.WebServices/ItfServiceRequests"></GetServiceRequest_SearchResponse></soap:Body></soap:Envelope>',
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('prop', CONFIG);
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_BAD_YARDI_CREDENTIALS');
    });
  });

  describe('SOAP envelope isolation', () => {
    it('does not leak one operation into the body of the next request', async () => {
      const post = sinon.stub(got, 'post');
      post.onCall(0).resolves({
        body: createSoapResponse(
          'GetResident_Search',
          '<CustomerSearch xmlns=""><Response><Customers></Customers></Response></CustomerSearch>'
        ),
      });
      post.onCall(1).resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<ServiceRequests xmlns=""></ServiceRequests>'
        ),
      });
      post.onCall(2).resolves({
        body: createCreateResponse(createServiceRequest()),
      });

      await yardi.getYardiPropertyResidents('prop', CONFIG);
      await yardi.getYardiPropertyWorkOrders('prop', CONFIG);
      await yardi.createOrEditYardiWorkOrder('prop', CONFIG, { unit: '101' });

      const residentsBody = post.getCall(0).args[1].body;
      const workOrdersBody = post.getCall(1).args[1].body;
      const createBody = post.getCall(2).args[1].body;

      expect(residentsBody).to.not.contain('GetServiceRequest_Search');
      expect(workOrdersBody).to.not.contain('GetResident_Search');
      expect(createBody).to.not.contain('GetResident_Search');
      expect(createBody).to.not.contain('GetServiceRequest_Search');
    });
  });
});

function createServiceRequest(overrides = {}) {
  const attrs = {
    ServiceRequestId: '1',
    PropertyCode: 'prop',
    UnitCode: '101',
    TenantCode: 't0001',
    ServiceRequestBriefDescription: 'brief',
    Priority: 'Low',
    Category: 'Miscellaneous',
    CurrentStatus: 'Call',
    UpdateDate: '2026-10-26T17:06:11',
    ...overrides,
  };
  const elements = Object.keys(attrs)
    .map(tag => `<${tag}>${attrs[tag]}</${tag}>`)
    .join('');
  return `<ServiceRequest HasAttachments="false">${elements}<StatusHistory><Status Type="Call" TimeStamp="2026-10-26T17:06:11" /></StatusHistory></ServiceRequest>`;
}

function createCreateResponse(serviceRequestXml) {
  return createSoapResponse(
    'CreateOrEditServiceRequests',
    `<ServiceRequests xmlns="">${serviceRequestXml}</ServiceRequests>`
  );
}

function createSoapResponse(method, resultXml) {
  return `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><soap:Body><${method}Response xmlns="http://tempuri.org/YSI.Interfaces.WebServices/ItfServiceRequests"><${method}Result>${resultXml}</${method}Result></${method}Response></soap:Body></soap:Envelope>`;
}
