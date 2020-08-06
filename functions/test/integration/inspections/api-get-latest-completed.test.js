const express = require('express');
const request = require('supertest');
const { expect } = require('chai');
const moment = require('moment');
const sinon = require('sinon');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const getLatest = require('../../../inspections/api/get-latest-completed');

const INSP_URL_PATH = config.clientApps.web.inspectionURL;
// const BLUESHIFT_TEMPLATE = config.inspections.blueshiftTemplateName;
const UNIX_DAY = 86400;
const TODAY_UNIX = Math.round(Date.now() / 1000);
const YESTURDAY_UNIX = TODAY_UNIX - UNIX_DAY;
const TWO_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 2;
const THREE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 3;
const FOUR_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 3;
const FIVE_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 5;
const SEVEN_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 7;
const ELEVEN_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 11;
const FIFTEEN_DAYS_AGO_UNIX = TODAY_UNIX - UNIX_DAY * 15;

describe('Inspections | API | GET Latest Completed', () => {
  afterEach(() => sinon.restore());

  it('rejects request with invalid other date', done => {
    request(createApp())
      .get(`/t?before=2020/06/05`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: "before" must be a valid past UNIX time.'
        );
        done();
      })
      .catch(done);
  });

  it('rejects request with bad property code', done => {
    const propertiesSnap = wrapSnapshot([]); // empty

    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);

    request(createApp())
      .get(`/t?propertyCode=bad`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'property with code: "bad" not found'
        );
        done();
      })
      .catch(done);
  });

  // it('returns latest completed inspection details for property', done => {
  //   const latest = TODAY_UNIX;
  //   const older = YESTURDAY_UNIX;
  //   const oldest = TWO_DAYS_AGO_UNIX;
  //   const property = createProperty();
  //   const propertiesSnap = wrapSnapshot([property]);
  //   const latestInspection = createInspection({
  //     id: 'expected',
  //     creationDate: latest - 1,
  //     completionDate: latest,
  //     score: 99,
  //     property: property.id,
  //   });
  //   const olderInspection = createInspection({
  //     id: 'older',
  //     creationDate: older - 1,
  //     completionDate: older,
  //     property: property.id,
  //   });
  //   const oldestInspection = createInspection({
  //     id: 'oldest',
  //     creationDate: oldest - 1,
  //     completionDate: oldest,
  //     property: property.id,
  //   });
  //
  //   const inspectionsSnap = wrapSnapshot([
  //     olderInspection,
  //     oldestInspection,
  //     latestInspection,
  //   ]);
  //   const expected = {
  //     data: {
  //       id: 'expected',
  //       type: 'inspection',
  //       attributes: {
  //         creationDate: latestInspection.creationDate,
  //         completionDate: latestInspection.completionDate,
  //         score: `${Math.round(latestInspection.score)}%`,
  //         inspectionReportURL: latestInspection.inspectionReportURL,
  //         inspectionURL: createInspectionUrl(
  //           latestInspection.property,
  //           'expected'
  //         ),
  //       },
  //     },
  //   };
  //
  //   // Stup requests
  //   sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
  //   sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);
  //
  //   request(createApp())
  //     .get('/t')
  //     .send()
  //     .expect('Content-Type', /application\/vnd.api\+json/)
  //     .expect(200)
  //     .then(res => {
  //       expect(res.body).to.deep.equal(expected);
  //       done();
  //     })
  //     .catch(done);
  // });
});

function createApp() {
  const app = express();
  app.get('/t', getLatest({ collection: () => {} }));
  return app;
}

function wrapSnapshot(payload = {}, id) {
  const forEach = fn => {
    return Object.keys(payload).forEach(plId =>
      fn(wrapSnapshot(payload[plId], plId))
    );
  };

  const result = {
    id: id || uuid(),
    exists: Boolean(payload),
    data: () => payload,
  };

  if (Array.isArray(payload)) {
    result.size = payload.length;
    result.docs = payload.map(pl => wrapSnapshot(pl, pl.id));
    result.forEach = forEach;
  }

  return result;
}

function createProperty(propConfig = {}) {
  return {
    id: uuid(),
    name: 'property',
    ...propConfig,
  };
}

function createInspection(inspConfig = {}) {
  const timestamp = TODAY_UNIX;

  return {
    id: uuid(),
    property: uuid(),
    inspectionCompleted: true,
    creationDate: timestamp,
    completionDate: timestamp + 5000,
    score: 100,
    templateName: 'test',
    template: { name: 'test' },
    inspectionReportURL: 'https://test.com/img.pdf',
    ...inspConfig,
  };
}

function createInspectionUrl(propertyId, inspId) {
  return INSP_URL_PATH.replace('{{propertyId}}', propertyId).replace(
    '{{inspectionId}}',
    inspId
  );
}
