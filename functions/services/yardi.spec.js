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

    it('resolves a common area work order Yardi returns without a unit', async () => {
      sinon.stub(got, 'post').resolves({
        body: createCreateResponse(
          createServiceRequest({
            ServiceRequestId: '531779',
            UnitCode: undefined,
            TenantCode: undefined,
          })
        ),
      });

      const actual = await yardi.createOrEditYardiWorkOrder('prop', CONFIG, {
        briefDescription: 'Pool gate latch',
      });

      expect(actual.id).to.equal('531779');
      expect(actual.unit).to.equal('');
      expect(actual.resident).to.equal('');
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

    it('resolves a common area work order that has no unit', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequests',
          `<ServiceRequests xmlns="">${createServiceRequest({
            ServiceRequestId: '531779',
            UnitCode: undefined,
            TenantCode: undefined,
          })}</ServiceRequests>`
        ),
      });

      const actual = await yardi.getYardiPropertyWorkOrder(
        'prop',
        CONFIG,
        '531779'
      );

      expect(actual.id).to.equal('531779');
      expect(actual.unit).to.equal('');
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

    it('keeps common area work orders that have no unit in the list', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          `<ServiceRequests xmlns="">${createServiceRequest({
            ServiceRequestId: '1',
          })}${createServiceRequest({
            ServiceRequestId: '2',
            UnitCode: undefined,
            TenantCode: undefined,
          })}</ServiceRequests>`
        ),
      });

      const { workOrders } = await yardi.getYardiPropertyWorkOrders(
        'prop',
        CONFIG
      );

      expect(workOrders.map(({ id }) => id)).to.deep.equal(['1', '2']);
      expect(workOrders[1].unit).to.equal('');
    });

    it('resolves an empty list when Yardi finds no matching work orders', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<ServiceRequests xmlns=""><ServiceRequest HasAttachments="false"><ErrorMessages><Error>There are no work orders found for these input values.</Error></ErrorMessages></ServiceRequest></ServiceRequests>'
        ),
      });

      const actual = await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
        openOrClosed: 'open',
        unit: '1-103',
      });

      expect(actual).to.deep.equal({ workOrders: [] });
    });

    it('rejects with a not-configured error when the interface is disabled for the property', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<ServiceRequests xmlns=""><ServiceRequest HasAttachments="false"><ErrorMessages><Error>Interface Sapphire Standard is not Configured for property 1003yanc</Error></ErrorMessages></ServiceRequest></ServiceRequests>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('1003yanc', CONFIG);
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_YARDI_PROPERTY_NOT_CONFIGURED');
    });

    it('rejects with a unit error when the unit filter is unknown', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetServiceRequest_Search',
          '<ServiceRequests xmlns=""><ServiceRequest HasAttachments="false"><ErrorMessages><Error>Could not find Unit:zz-none in Property:prop</Error></ErrorMessages></ServiceRequest></ServiceRequests>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
          unit: 'zz-none',
        });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_NO_YARDI_UNIT');
    });
  });

  describe('getYardiWorkOrderAttachments', () => {
    const ATTACHMENTS_XML =
      '<ServiceRequestAttachments xmlns=""><ServiceRequest ID="531779"><Attachments><Attachment Date="2026-10-28T12:38:52"><Name AttachmentType="Work Order" AttachmentDescription="Pool gate">Attachment_531779_1.png</Name><Value>aGVsbG8=</Value></Attachment><Attachment Date="2026-10-28T12:40:00"><Name AttachmentType="Work Order" AttachmentDescription="">Attachment_531779_2.pdf</Name><Value>JVBERi0=</Value></Attachment></Attachments></ServiceRequest></ServiceRequestAttachments>';

    it('requests the attachments with the property ID and work order ID', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse('GetAttachments', ATTACHMENTS_XML),
      });

      await yardi.getYardiWorkOrderAttachments('prop', CONFIG, '531779');

      const { body, headers } = post.firstCall.args[1];
      const compact = body.replace(/\s+/g, '');
      expect(headers.SOAPAction).to.contain('/GetAttachments');
      expect(compact).to.contain('<PropertyID>prop</PropertyID>');
      expect(compact).to.contain('<ServiceRequestId>531779</ServiceRequestId>');
      expect(compact).to.contain(`<Password>${CONFIG.password}</Password>`);
    });

    it('resolves every attachment with its details and base64 data', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse('GetAttachments', ATTACHMENTS_XML),
      });

      const actual = await yardi.getYardiWorkOrderAttachments(
        'prop',
        CONFIG,
        '531779'
      );

      expect(actual.map(({ name }) => name)).to.deep.equal([
        'Attachment_531779_1.png',
        'Attachment_531779_2.pdf',
      ]);
      expect(actual[0]).to.deep.equal({
        name: 'Attachment_531779_1.png',
        attachmentType: 'Work Order',
        description: 'Pool gate',
        createdAt: '2026-10-28T12:38:52',
        data: 'aGVsbG8=',
        size: 5,
      });
    });

    it('resolves an empty list when Yardi has no attachments', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetAttachments',
          '<ServiceRequestAttachments xmlns=""><ServiceRequest ID="531779"><Attachments><Attachment Date="0001-01-01T00:00:00"><Name>No attachments found for Service Request 531779 in Property prop or no access to Service Request Property prop.</Name><Value /></Attachment></Attachments></ServiceRequest></ServiceRequestAttachments>'
        ),
      });

      const actual = await yardi.getYardiWorkOrderAttachments(
        'prop',
        CONFIG,
        '531779'
      );

      expect(actual).to.deep.equal([]);
    });

    it('rejects with a credentials error when Yardi login fails', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetAttachments',
          '<Messages xmlns=""><Message messageType="Error">Login failed. Please check login credentials and try again.</Message></Messages>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiWorkOrderAttachments('prop', CONFIG, '531779');
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_BAD_YARDI_CREDENTIALS');
    });
  });

  describe('uploadYardiWorkOrderAttachment', () => {
    const SUCCESS_XML =
      '<ImportAttach xmlns=""><DocumentAttachment><Result>Successful:Attachment_531779_3.jpg</Result></DocumentAttachment></ImportAttach>';

    it('sends the file with the import method field names and the default attachment type', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse('ImportWorkOrderDocumentExt', SUCCESS_XML),
      });

      await yardi.uploadYardiWorkOrderAttachment('prop', CONFIG, '531779', {
        data: 'aGVsbG8=',
        extension: '.JPG',
        description: 'Leaking <pipe>',
      });

      const { body, headers } = post.firstCall.args[1];
      const compact = body.replace(/\s+/g, '');
      expect(headers.SOAPAction).to.contain('/ImportWorkOrderDocumentExt');
      expect(compact).to.contain(`<DataBase>${CONFIG.database}</DataBase>`);
      expect(compact).to.contain('<WorkOrderId>531779</WorkOrderId>');
      expect(compact).to.contain('<PropertyCode>prop</PropertyCode>');
      expect(compact).to.contain('<AttachmentType>WorkOrder</AttachmentType>');
      expect(compact).to.contain('<Attachment>aGVsbG8=</Attachment>');
      expect(compact).to.contain('<Extension>jpg</Extension>');
      expect(compact).to.contain(
        '<Description>Leaking&lt;pipe&gt;</Description>'
      );
      expect(compact).to.not.contain('YardiPropertyId');
    });

    it('uses the organization attachment type when configured', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse('ImportWorkOrderDocumentExt', SUCCESS_XML),
      });

      await yardi.uploadYardiWorkOrderAttachment(
        'prop',
        { ...CONFIG, attachmentType: 'SRDocument' },
        '531779',
        { data: 'aGVsbG8=', extension: 'jpg' }
      );

      const compact = post.firstCall.args[1].body.replace(/\s+/g, '');
      expect(compact).to.contain('<AttachmentType>SRDocument</AttachmentType>');
    });

    it('resolves the stored file name Yardi reports', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse('ImportWorkOrderDocumentExt', SUCCESS_XML),
      });

      const actual = await yardi.uploadYardiWorkOrderAttachment(
        'prop',
        CONFIG,
        '531779',
        { data: 'aGVsbG8=', extension: 'jpg', description: 'Leak' }
      );

      expect(actual).to.deep.equal({
        name: 'Attachment_531779_3.jpg',
        attachmentType: 'Work Order',
        description: 'Leak',
        extension: 'jpg',
      });
    });

    it("rejects with Yardi's message when the upload is not accepted", async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'ImportWorkOrderDocumentExt',
          '<ImportAttach xmlns=""><DocumentAttachment><Result>Unsuccessful:Could not find configured Attachment Type Work Order</Result></DocumentAttachment></ImportAttach>'
        ),
      });

      let actual = null;
      try {
        await yardi.uploadYardiWorkOrderAttachment('prop', CONFIG, '531779', {
          data: 'aGVsbG8=',
          extension: 'jpg',
        });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_YARDI_ATTACHMENT_REJECTED');
      expect(actual.details).to.deep.equal([
        'Could not find configured Attachment Type Work Order',
      ]);
    });

    it('rejects an invalid file extension result', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'ImportWorkOrderDocumentExt',
          '<ImportAttach xmlns=""><DocumentAttachment><Result>Invalid File Extension: exe</Result></DocumentAttachment></ImportAttach>'
        ),
      });

      let actual = null;
      try {
        await yardi.uploadYardiWorkOrderAttachment('prop', CONFIG, '531779', {
          data: 'aGVsbG8=',
          extension: 'exe',
        });
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_YARDI_ATTACHMENT_REJECTED');
      expect(actual.details[0]).to.contain('Invalid File Extension');
    });
  });

  describe('getYardiCustomValues', () => {
    const CUSTOM_VALUES_XML = `<ServiceRequests xmlns="" xsi="http://www.w3.org/2001/XMLSchema-instance"><CustomValues><Categories><Category><Name>Electrical</Name><SubCategory>Breakers</SubCategory><SubCategory>Wiring</SubCategory></Category><Category><Name>Building Exterior</Name></Category></Categories><Approvers><Warning>There are no Approvers set up in this database.</Warning></Approvers><Priorities><Priority>High</Priority><Priority>Low</Priority></Priorities><Statuses><Status Type="Standard"><Status>Call</Status><Status>Canceled</Status></Status></Statuses><Status Type="Custom"><Status>Parts Ordered</Status></Status><Reasons><Reason Status="On Hold" Required="true">Duplicate Work Order</Reason><Reason Status="Request Reassignment" Required="false">Need new vendor</Reason></Reasons></CustomValues><Resolutions><Resolution>General Repairs</Resolution></Resolutions><Employees /></ServiceRequests>`;

    it('requests custom values with the login block and no property', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse('GetCustomValues', CUSTOM_VALUES_XML),
      });

      await yardi.getYardiCustomValues(CONFIG);

      const { body, headers } = post.firstCall.args[1];
      expect(headers.SOAPAction).to.contain('/GetCustomValues');
      expect(body).to.contain('<UserName>user</UserName>');
      expect(body).to.contain('<InterfaceLicense>license</InterfaceLicense>');
      expect(body).to.not.contain('YardiPropertyId');
    });

    it('resolves the organization work order values', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse('GetCustomValues', CUSTOM_VALUES_XML),
      });

      const actual = await yardi.getYardiCustomValues(CONFIG);

      expect(actual).to.deep.equal({
        priorities: ['High', 'Low'],
        categories: [
          { name: 'Electrical', subCategories: ['Breakers', 'Wiring'] },
          { name: 'Building Exterior', subCategories: [] },
        ],
        statuses: [
          { name: 'Call', type: 'standard' },
          { name: 'Canceled', type: 'standard' },
          { name: 'Parts Ordered', type: 'custom' },
        ],
        reasons: [
          { status: 'On Hold', reason: 'Duplicate Work Order', required: true },
          {
            status: 'Request Reassignment',
            reason: 'Need new vendor',
            required: false,
          },
        ],
        resolutions: ['General Repairs'],
      });
    });

    it('resolves empty lists when Yardi returns warnings instead of values', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetCustomValues',
          '<ServiceRequests xmlns=""><CustomValues><Categories /><Priorities /><Statuses /><Reasons /></CustomValues><Resolutions><Warning>There are no Resolutions set up in this database.</Warning></Resolutions></ServiceRequests>'
        ),
      });

      const actual = await yardi.getYardiCustomValues(CONFIG);

      expect(actual).to.deep.equal({
        priorities: [],
        categories: [],
        statuses: [],
        reasons: [],
        resolutions: [],
      });
    });

    it('rejects with a credentials error when Yardi login fails', async () => {
      sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetCustomValues',
          '<Messages xmlns=""><Message messageType="Error">Login failed. Please check login credentials and try again.</Message></Messages>'
        ),
      });

      let actual = null;
      try {
        await yardi.getYardiCustomValues(CONFIG);
      } catch (err) {
        actual = err;
      }

      expect(actual.code).to.equal('ERR_BAD_YARDI_CREDENTIALS');
    });
  });

  describe('Voyager URL', () => {
    it('posts to the default Voyager endpoint when no url is configured', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createSoapResponse(
          'GetCustomValues',
          '<ServiceRequests xmlns=""><CustomValues /></ServiceRequests>'
        ),
      });

      await yardi.getYardiCustomValues(CONFIG);

      expect(post.firstCall.args[0]).to.equal(
        'https://www.yardiasp14.com/21253beta/Webservices/itfServiceRequests.asmx'
      );
    });

    it('posts to the configured Voyager endpoint when a url is provided', async () => {
      const post = sinon.stub(got, 'post').resolves({
        body: createCreateResponse(createServiceRequest()),
      });
      const url =
        'https://example.yardi.test/client/Webservices/itfServiceRequests.asmx';

      await yardi.createOrEditYardiWorkOrder(
        'prop',
        { ...CONFIG, url: ` ${url} ` },
        { unit: '101' }
      );

      expect(post.firstCall.args[0]).to.equal(url);
    });

    it('rejects a non-string url configuration', async () => {
      let actual = null;
      try {
        await yardi.getYardiCustomValues({ ...CONFIG, url: 42 });
      } catch (err) {
        actual = err;
      }
      expect(actual).to.be.an('error');
    });
  });

  describe('getYardiPropertyWorkOrders filters', () => {
    const EMPTY = createSoapResponse(
      'GetServiceRequest_Search',
      '<ServiceRequests xmlns=""></ServiceRequests>'
    );

    it('searches open work orders by default', async () => {
      const post = sinon.stub(got, 'post').resolves({ body: EMPTY });
      await yardi.getYardiPropertyWorkOrders('prop', CONFIG);
      const { body } = post.firstCall.args[1];
      expect(body).to.contain('<OpenOrClosed>Open</OpenOrClosed>');
      expect(body).to.not.contain('<UnitCode>');
      expect(body).to.not.contain('<FromDate>');
    });

    it('searches closed work orders when requested', async () => {
      const post = sinon.stub(got, 'post').resolves({ body: EMPTY });
      await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
        openOrClosed: 'closed',
      });
      expect(post.firstCall.args[1].body).to.contain(
        '<OpenOrClosed>Closed</OpenOrClosed>'
      );
    });

    it('passes unit, resident and status filters to Yardi', async () => {
      const post = sinon.stub(got, 'post').resolves({ body: EMPTY });
      await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
        unit: '1-103',
        resident: 't0225029',
        status: 'Scheduled',
      });
      const { body } = post.firstCall.args[1];
      expect(body).to.contain('<UnitCode>1-103</UnitCode>');
      expect(body).to.contain('<ResidentCode>t0225029</ResidentCode>');
      expect(body).to.contain('<Status>Scheduled</Status>');
    });

    it('converts YYYY-MM-DD dates to the MM/DD/YYYY format Yardi expects', async () => {
      const post = sinon.stub(got, 'post').resolves({ body: EMPTY });
      await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
        from: '2026-10-01',
        to: '2026-10-26',
      });
      const { body } = post.firstCall.args[1];
      expect(body).to.contain('<FromDate>10/01/2026</FromDate>');
      expect(body).to.contain('<ToDate>10/26/2026</ToDate>');
    });

    it('rejects an unknown open/closed filter', async () => {
      sinon.stub(got, 'post').resolves({ body: EMPTY });
      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
          openOrClosed: 'all',
        });
      } catch (err) {
        actual = err;
      }
      expect(actual).to.be.an('error');
    });

    it('rejects a malformed date filter', async () => {
      sinon.stub(got, 'post').resolves({ body: EMPTY });
      let actual = null;
      try {
        await yardi.getYardiPropertyWorkOrders('prop', CONFIG, {
          from: '10/01/2026',
        });
      } catch (err) {
        actual = err;
      }
      expect(actual).to.be.an('error');
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
    .filter(tag => attrs[tag] !== undefined)
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
