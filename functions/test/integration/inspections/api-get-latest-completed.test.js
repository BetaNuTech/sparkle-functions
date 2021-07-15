const express = require('express');
const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const config = require('../../../config');
const uuid = require('../../../test-helpers/uuid');
const stubs = require('../../../test-helpers/stubs');
const propertiesModel = require('../../../models/properties');
const inspectionsModel = require('../../../models/inspections');
const getLatest = require('../../../inspections/api/get-latest-completed');

const INSP_URL_PATH = config.clientApps.web.inspectionURL;
const TODAY_UNIX = Math.round(Date.now() / 1000);

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
    const propertiesSnap = stubs.wrapSnapshot([]); // empty

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

  it('applies custom before value to inspection query', done => {
    const expected = Math.round(Date.now() / 1000) - 10000;
    const inspectionsSnap = stubs.wrapSnapshot([]); // empty
    let actual = 0;

    // Stup requests
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .callsFake((_, beforeQuery) => {
        actual = beforeQuery;
        return Promise.resolve(inspectionsSnap);
      });

    request(createApp())
      .get(`/t?before=${expected}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('applies template name param to inspection query', done => {
    const expected = 'test_name';
    const inspectionsSnap = stubs.wrapSnapshot([]); // empty
    let actual = '';

    // Stup requests
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .callsFake((_, before, query) => {
        actual = query.templateName ? query.templateName[1] : 'error';
        return Promise.resolve(inspectionsSnap);
      });

    request(createApp())
      .get(`/t?templateName=${expected}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('applies discovered property from provided code to inspection query', done => {
    const expected = uuid();
    const propCode = 'propcode';
    const property = createProperty({ id: expected, code: propCode });
    const propertiesSnap = stubs.wrapSnapshot([property]);
    const inspectionsSnap = stubs.wrapSnapshot([]); // empty
    let actual = '';

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesSnap);
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .callsFake((_, before, query) => {
        actual = query.property ? query.property[1] : 'error';
        return Promise.resolve(inspectionsSnap);
      });

    request(createApp())
      .get(`/t?propertyCode=${propCode}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(() => {
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns an empty response when no inspections can be found', done => {
    const expected = [];
    const inspectionsSnap = stubs.wrapSnapshot([]); // empty

    // Stup requests
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .resolves(inspectionsSnap);

    request(createApp())
      .get(`/t`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        const actual = res.body.data;
        expect(actual).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('returns latest completed inspection as a JSON-API document', done => {
    const latest = TODAY_UNIX;
    const property = createProperty();
    const propertySnap = stubs.wrapSnapshot(property);
    const inspection = createInspection({
      id: 'expected',
      creationDate: latest - 1,
      completionDate: latest,
      score: 99,
      property: property.id,
    });
    const inspectionsSnap = stubs.wrapSnapshot([inspection]);
    const expected = {
      data: {
        id: 'expected',
        type: 'inspection',
        attributes: {
          creationDate: inspection.creationDate,
          completionDate: inspection.completionDate,
          score: `${Math.round(inspection.score)}%`,
          templateName: inspection.templateName,
          inspectionReportURL: inspection.inspectionReportURL,
          inspectionURL: createInspectionUrl(inspection.property, 'expected'),
        },
      },
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreFindRecord').resolves(propertySnap);
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .resolves(inspectionsSnap);

    request(createApp())
      .get('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        delete res.body.included; // ignore included property
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it("returns inspection's property as an included JSON-API document", done => {
    const latest = TODAY_UNIX;
    const propertyId = 'expected';
    const inspection = createInspection({
      creationDate: latest - 1,
      completionDate: latest,
      score: 99,
      property: propertyId,
    });
    const inspectionsSnap = stubs.wrapSnapshot([inspection]);
    const property = createProperty({
      id: propertyId,
      lastInspectionDate: inspection.creationDate,
      lastInspectionScore: inspection.score,
      numOfDeficientItems: 1,
      numOfOverdueDeficientItems: 1,
    });
    const propertySnap = stubs.wrapSnapshot(property);
    const expected = {
      included: [
        {
          id: propertyId,
          type: 'property',
          attributes: {
            name: property.name,
            code: property.code,
            lastInspectionDate: property.lastInspectionDate,
            lastInspectionScore: property.lastInspectionScore,
            numOfInspections: property.numOfInspections,
            numOfDeficientItems: property.numOfDeficientItems,
            numOfOverdueDeficientItems: property.numOfOverdueDeficientItems,
            numOfRequiredActionsForDeficientItems:
              property.numOfRequiredActionsForDeficientItems,
            numOfFollowUpActionsForDeficientItems:
              property.numOfFollowUpActionsForDeficientItems,
          },
        },
      ],
    };

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreFindRecord').resolves(propertySnap);
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .resolves(inspectionsSnap);

    request(createApp())
      .get('/t')
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(res => {
        delete res.body.data; // ignore primary data
        expect(res.body).to.deep.equal(expected);
        done();
      })
      .catch(done);
  });

  it('does not re-request a property that has been previously discovered', done => {
    const expected = false;
    const inspection = createInspection();
    const inspectionsSnap = stubs.wrapSnapshot([inspection]);
    const property = createProperty();
    const propertySnap = stubs.wrapSnapshot(property);
    const propertiesQuerySnap = stubs.wrapSnapshot([property]);

    // Stup requests
    sinon.stub(propertiesModel, 'firestoreQuery').resolves(propertiesQuerySnap);
    sinon
      .stub(inspectionsModel, 'firestoreLatestCompletedQuery')
      .resolves(inspectionsSnap);
    const propertyLookup = sinon
      .stub(propertiesModel, 'firestoreFindRecord')
      .resolves(propertySnap);

    request(createApp())
      .get(`/t?propertyCode=${encodeURI(property.code)}`)
      .send()
      .expect('Content-Type', /application\/vnd.api\+json/)
      .expect(200)
      .then(() => {
        const actual = propertyLookup.called;
        expect(actual).to.equal(expected);
        done();
      })
      .catch(done);
  });
});

function createApp() {
  const app = express();
  app.get('/t', getLatest({ collection: () => {} }));
  return app;
}

function createProperty(propConfig = {}) {
  return {
    id: uuid(),
    name: 'name',
    code: 'code',
    lastInspectionDate: 0,
    lastInspectionScore: 0,
    numOfInspections: 0,
    numOfDeficientItems: 0,
    numOfOverdueDeficientItems: 0,
    numOfRequiredActionsForDeficientItems: 0,
    numOfFollowUpActionsForDeficientItems: 0,
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
