const express = require('express');
const request = require('supertest');
const { expect } = require('chai');
const moment = require('moment');
const sinon = require('sinon');
const config = require('../../../config');
const getLatest = require('../../../properties/api/get-latest-completed-inspection');
const uuid = require('../../../test-helpers/uuid');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');

const INSP_URL_PATH = config.clientApps.web.inspectionURL;
const BLUESHIFT_TEMPLATE = config.inspections.blueshiftTemplateName;
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

describe('Properties | API | GET Latest Inspection', () => {
  afterEach(() => sinon.restore());

  it('rejects request with invalid other date', done => {
    request(createApp())
      .get(`/test?other_date=2020/06/05`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(400)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'Bad Request: "other_date" must be a valid UNIX time.'
        );
        done();
      })
      .catch(done);
  });

  it('rejects with unfound error when no property found for code', done => {
    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(wrapSnapshot([]));

    request(createApp())
      .get('/test')
      .send()
      .expect(404)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain('code lookup, not found.');
        done();
      })
      .catch(done);
  });

  it('rejects with unfound error when no inspections found for property', done => {
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const inspectionsSnap = wrapSnapshot([]);

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(404)
      .then(res => {
        expect(res.body.errors[0].detail).to.contain(
          'no inspections exist yet.'
        );
        done();
      })
      .catch(done);
  });

  it('returns latest completed inspection details for property', done => {
    const latest = TODAY_UNIX;
    const older = YESTURDAY_UNIX;
    const oldest = TWO_DAYS_AGO_UNIX;
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'expected',
      creationDate: latest - 1,
      completionDate: latest,
      score: 99,
      property: property.id,
    });
    const olderInspection = createInspection({
      id: 'older',
      creationDate: older - 1,
      completionDate: older,
      property: property.id,
    });
    const oldestInspection = createInspection({
      id: 'oldest',
      creationDate: oldest - 1,
      completionDate: oldest,
      property: property.id,
    });

    const inspectionsSnap = wrapSnapshot([
      olderInspection,
      oldestInspection,
      latestInspection,
    ]);
    const expected = {
      data: {
        id: 'expected',
        type: 'inspection',
        attributes: {
          creationDate: latestInspection.creationDate,
          completionDate: latestInspection.completionDate,
          score: `${Math.round(latestInspection.score)}%`,
          inspectionReportURL: latestInspection.inspectionReportURL,
          inspectionURL: createInspectionUrl(
            latestInspection.property,
            'expected'
          ),
        },
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should return compliance alerts when inspection was created over 10 days ago', done => {
    const latest = ELEVEN_DAYS_AGO_UNIX;
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'expected',
      creationDate: latest,
      completionDate: latest + 1,
      score: 99,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([latestInspection]);
    const alert = `Blueshift Product Inspection OVERDUE (Last: ${localFormattedDate(
      latestInspection.creationDate
    )}, Completed: ${localFormattedDate(latestInspection.completionDate)}).`;
    const expected = { meta: { alert, complianceAlert: alert } };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        // Ignore non-compliance properties
        delete res.body.data;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should return alert when inspection score is below 90', done => {
    const latest = TWO_DAYS_AGO_UNIX;
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'expected',
      creationDate: latest,
      completionDate: latest + 1,
      score: 89,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([latestInspection]);
    const expected = {
      meta: {
        alert: 'POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!',
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        // Ignore non-compliance properties
        delete res.body.data;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should append alert of poor inspection score to alert of an overdue inspection', done => {
    const latest = ELEVEN_DAYS_AGO_UNIX;
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'expected',
      creationDate: latest,
      completionDate: latest + 1,
      score: 89,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([latestInspection]);
    const alert = `Blueshift Product Inspection OVERDUE (Last: ${localFormattedDate(
      latestInspection.creationDate
    )}, Completed: ${localFormattedDate(latestInspection.completionDate)}).`;
    const expected = {
      meta: {
        alert: `${alert} POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!`,
        complianceAlert: alert,
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        // Ignore non-compliance properties
        delete res.body.data;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should append alert when overdue inspection took more than 3 days to complete', done => {
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'expected',
      creationDate: ELEVEN_DAYS_AGO_UNIX,
      completionDate: SEVEN_DAYS_AGO_UNIX,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([latestInspection]);
    const alert = `Blueshift Product Inspection OVERDUE (Last: ${localFormattedDate(
      latestInspection.creationDate
    )}, Completed: ${localFormattedDate(
      latestInspection.completionDate
    )}). Over 3-day max duration, please start and complete inspection within 3 days.`;
    const expected = {
      meta: {
        alert,
        complianceAlert: alert,
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get('/test')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        // Ignore non-compliance properties
        delete res.body.data;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should return additional inspection completed before a specified date', done => {
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'latest',
      creationDate: TWO_DAYS_AGO_UNIX,
      completionDate: YESTURDAY_UNIX,
      property: property.id,
    });
    const latestByDateInspection = createInspection({
      id: 'latest-by-date',
      creationDate: FIVE_DAYS_AGO_UNIX,
      completionDate: THREE_DAYS_AGO_UNIX,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([
      latestInspection,
      latestByDateInspection,
    ]);
    const expected = {
      included: [
        {
          id: 'latest-by-date',
          type: 'inspection',
          attributes: {
            creationDate: latestByDateInspection.creationDate,
            completionDate: latestByDateInspection.completionDate,
            score: `${Math.round(latestByDateInspection.score)}%`,
            inspectionReportURL: latestByDateInspection.inspectionReportURL,
            inspectionURL: createInspectionUrl(
              latestByDateInspection.property,
              'latest-by-date'
            ),
          },
        },
      ],
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get(`/test?other_date=${THREE_DAYS_AGO_UNIX}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        delete res.body.data;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('should return any alerts for inspection completed before a given date', done => {
    const property = createProperty();
    const propertiesSnap = wrapSnapshot([property]);
    const latestInspection = createInspection({
      id: 'latest',
      creationDate: TWO_DAYS_AGO_UNIX,
      completionDate: YESTURDAY_UNIX,
      property: property.id,
    });
    const latestByDateInspection = createInspection({
      id: 'latest-by-date',
      score: 89,
      creationDate: FIFTEEN_DAYS_AGO_UNIX,
      completionDate: FOUR_DAYS_AGO_UNIX,
      property: property.id,
    });
    const inspectionsSnap = wrapSnapshot([
      latestInspection,
      latestByDateInspection,
    ]);
    const alert = `Blueshift Product Inspection OVERDUE (Last: ${localFormattedDate(
      latestByDateInspection.creationDate
    )}, Completed: ${localFormattedDate(
      latestByDateInspection.completionDate
    )}). Over 3-day max duration, please start and complete inspection within 3 days.`;
    const expected = {
      meta: {
        alertIncluded: `${alert} POOR RECENT INSPECTION RESULTS. DOUBLE CHECK PRODUCT PROBLEM!`,
        complianceAlertIncluded: alert,
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon.stub(inspectionsModel, 'firestoreQuery').resolves(inspectionsSnap);

    request(createApp())
      .get(`/test?other_date=${THREE_DAYS_AGO_UNIX}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        delete res.body.data;
        delete res.body.included;
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get('/:propertyCode', getLatest({ collection: () => {} }));
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
