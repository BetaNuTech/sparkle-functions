const request = require('supertest');
const { expect } = require('chai');
const moment = require('moment');
const sinon = require('sinon');
const config = require('../../../config');
const createApp = require('../../../inspections/api/get-latest-completed');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');

const INSP_URL_PATH = config.clientApps.web.inspectionURL;
const BLUESHIFT_TEMPLATE = config.inspections.blueshiftTemplateName;
const UNIX_DAY = 86400;
const TODAY_UNIX = Math.round(Date.now() / 1000);
const YESTURDAY_UNIX = TODAY_UNIX - UNIX_DAY;
const EIGHT_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 8;
const NINE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 9;
const TEN_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 10;
const ELEVEN_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 11;

describe('Properties | API | GET Latest Inspection', () => {
  afterEach(() => sinon.restore());

  // it('rejects request without property code', done => {
  //   request(createApp(stubDb()))
  //     .get('/')
  //     .send()
  //     .expect(400)
  //     .then(res => {
  //       expect(res.text).to.contain('Bad Request. Missing Parameters.');
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('rejects with unfound error when no property found for code', done => {
  //   const propertiesSnap = wrapSnapshot(null);
  //
  //   // Stup requests
  //   sinon.stub(propertiesModel, 'realtimeQueryByCode').resolves(propertiesSnap);
  //
  //   request(createApp(stubDb()))
  //     .get('/?cobalt_code=test')
  //     .send()
  //     .expect(404)
  //     .then(res => {
  //       expect(res.text).to.contain('code lookup, not found.');
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('rejects with unfound error when no inspections found for property', done => {
  //   const properties = { [uuid()]: { name: 'test' } };
  //   const propertiesSnap = wrapSnapshot(properties);
  //   const inspectionsSnap = wrapSnapshot(null);
  //
  //   // Stup requests
  //   sinon.stub(propertiesModel, 'realtimeQueryByCode').resolves(propertiesSnap);
  //   sinon.stub(inspectionsModel, 'queryByProperty').resolves(inspectionsSnap);
  //
  //   request(createApp(stubDb()))
  //     .get('/?cobalt_code=test')
  //     .send()
  //     .expect(404)
  //     .then(res => {
  //       expect(res.text).to.contain('no inspections exist yet.');
  //       done();
  //     })
  //     .catch(done);
  // });
  //
  // it('returns latest completed inspection details for property', done => {
  //   const propertyId = uuid();
  //   const properties = { [propertyId]: { name: 'test' } };
  //   const propertiesSnap = wrapSnapshot(properties);
  //   const latest = TODAY_UNIX;
  //   const oldest = YESTURDAY_UNIX;
  //   const latestInspection = createInspection({
  //     creationDate: latest - 1,
  //     completionDate: latest,
  //     score: 99,
  //     property: propertyId,
  //   });
  //   const inspections = {
  //     older: createInspection({
  //       creationDate: oldest - 1,
  //       completionDate: oldest,
  //       property: propertyId,
  //     }),
  //     incomplete: createInspection({
  //       creationDate: latest - 1,
  //       completionDate: latest,
  //       inspectionCompleted: false,
  //       property: propertyId,
  //     }),
  //     expected: latestInspection,
  //   };
  //   const inspectionsSnap = wrapSnapshot(inspections);
  //   const expected = {
  //     creationDate: localFormattedDate(latestInspection.creationDate),
  //     completionDate: localFormattedDate(latestInspection.completionDate),
  //     score: `${latestInspection.score}%`,
  //     inspectionReportURL: latestInspection.inspectionReportURL,
  //     inspectionURL: createInspectionUrl(latestInspection.property, 'expected'),
  //   };
  //
  //   // Stup requests
  //   sinon.stub(propertiesModel, 'realtimeQueryByCode').resolves(propertiesSnap);
  //   sinon.stub(inspectionsModel, 'queryByProperty').resolves(inspectionsSnap);
  //
  //   request(createApp(stubDb()))
  //     .get('/?cobalt_code=test')
  //     .send()
  //     .expect('Content-Type', /json/)
  //     .expect(200)
  //     .then(res => {
  //       expect(res.body).to.deep.equal(expected);
  //       done();
  //     })
  //     .catch(done);
  // });

  it('should return compliance alerts when inspection was over 7 days ago', done => {
    const propertyId = uuid();
    const properties = { [propertyId]: { name: 'test' } };
    const propertiesSnap = wrapSnapshot(properties);
    const latest = TEN_DAYS_AGO_UNIX;
    const oldest = ELEVEN_DAYS_AGO_UNIX;
    const latestInspection = createInspection({
      creationDate: latest - 1,
      completionDate: latest,
      score: 99,
      property: propertyId,
    });
    const inspections = {
      older: createInspection({
        creationDate: oldest - 1,
        completionDate: oldest,
        property: propertyId,
      }),
      incomplete: createInspection({
        creationDate: latest - 1,
        completionDate: latest,
        inspectionCompleted: false,
        property: propertyId,
      }),
      expected: latestInspection,
    };
    const inspectionsSnap = wrapSnapshot(inspections);
    const alert = `Blueshift Product Inspection OVERDUE (Last: ${localFormattedDate(
      latestInspection.creationDate
    )}, Completed: ${localFormattedDate(latestInspection.completionDate)}).`;
    const expected = { alert, complianceAlert: alert };

    // Stup requests
    sinon.stub(propertiesModel, 'realtimeQueryByCode').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'queryByProperty').resolves(inspectionsSnap);

    request(createApp(stubDb()))
      .get('/?cobalt_code=test')
      .send()
      .expect('Content-Type', /json/)
      .expect(200)
      .then(res => {
        // Ignore non-compliance properties
        delete res.body.creationDate;
        delete res.body.completionDate;
        delete res.body.score;
        delete res.body.inspectionReportURL;
        delete res.body.inspectionURL;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  // it('should return compliance alerts when inspection score is below 90', done => {});
  // it('should return addition inspection completed before a specified date', done => {});
});

function stubDb() {
  return { ref: () => {} };
}

function wrapSnapshot(payload = {}, key) {
  return {
    key: key || uuid(),
    hasChildren: () => true,
    exists: () => Boolean(payload),
    val: () => payload,
    forEach: fn => {
      return Object.keys(payload).forEach(id =>
        fn(wrapSnapshot(payload[id], id))
      );
    },
  };
}

function createInspection(inspConfig = {}) {
  const timestamp = TODAY_UNIX;

  return {
    inspectionCompleted: true,
    creationDate: timestamp,
    completionDate: timestamp + 5000,
    score: 100,
    property: uuid(),
    templateName: BLUESHIFT_TEMPLATE,
    template: { name: BLUESHIFT_TEMPLATE },
    inspectionReportURL: 'https://test.com/img.pdf',
    ...inspConfig,
  };
}

function localFormattedDate(unixTimestamp) {
  return moment(unixTimestamp * 1000).format('MM/DD/YY');
}

function createInspectionUrl(propertyId, inspId) {
  return INSP_URL_PATH.replace('{{propertyId}}', propertyId).replace(
    '{{inspectionId}}',
    inspId
  );
}
